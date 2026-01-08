import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  InputAdornment,
  IconButton,
  Stack,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import { fromArrayBuffer } from 'geotiff';
import type { DTMFilterConfig, GeoTIFFMetadata, WorkerMessage, ProcessingProgress } from './types';

// Note: Web Worker implementation would require additional Vite configuration
// For now, we use inline processing which works but blocks the UI thread
// For production use, consider:
// 1. Setting up worker.ts plugin in vite.config
// 2. Or using a bundler that properly handles worker modules

export default function DTMFilterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [originalMetadata, setOriginalMetadata] = useState<GeoTIFFMetadata | null>(null);
  const [originalData, setOriginalData] = useState<Float32Array | null>(null);
  const [filteredData, setFilteredData] = useState<Float32Array | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [sensitivityMultiplier, setSensitivityMultiplier] = useState<string>('1.0');
  const [numberOfIterations, setNumberOfIterations] = useState<string>('200');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  // Cleanup worker on unmount
  React.useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.toLowerCase().match(/\.(tif|tiff)$/)) {
      setError('Please select a .tif or .tiff file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setFilteredData(null);
    setDownloadUrl(null);
    setProgress(null);

    try {
      // Read GeoTIFF
      const arrayBuffer = await selectedFile.arrayBuffer();
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();

      // Check if single band
      const numBands = image.getSamplesPerPixel();
      if (numBands !== 1) {
        setError(`Multi-band GeoTIFF not supported. Found ${numBands} bands.`);
        return;
      }

      // Read raster data
      const rasters = await image.readRasters({ interleave: false });
      const rasterData = rasters[0] as Float32Array | Int16Array | Uint16Array;

      // Convert to Float32Array if needed
      let floatData: Float32Array;
      if (rasterData instanceof Float32Array) {
        floatData = rasterData;
      } else {
        floatData = new Float32Array(rasterData.length);
        for (let i = 0; i < rasterData.length; i++) {
          floatData[i] = rasterData[i];
        }
      }

      // Check raster size
      const width = image.getWidth();
      const height = image.getHeight();
      const pixelCount = width * height;

      if (pixelCount > 100_000_000) {
        setError(`Raster too large: ${pixelCount} pixels. Maximum supported: 100M pixels.`);
        return;
      }

      // Extract georeferencing
      const fileDirectory = image.fileDirectory;
      const geoKeys = image.getGeoKeys();
      
      // Extract ModelPixelScale
      let pixelScale: [number, number, number] = [1, 1, 0];
      if (fileDirectory.ModelPixelScale) {
        pixelScale = fileDirectory.ModelPixelScale as [number, number, number];
      } else if (fileDirectory.PixelScale) {
        pixelScale = fileDirectory.PixelScale as [number, number, number];
      }

      // Extract ModelTiepoint
      let modelTiepoint: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
      if (fileDirectory.ModelTiepoint) {
        modelTiepoint = fileDirectory.ModelTiepoint as [number, number, number, number, number, number];
      }

      // Extract NoData value
      const noDataValue = fileDirectory.GDAL_NODATA
        ? parseFloat(fileDirectory.GDAL_NODATA as string)
        : fileDirectory.NoData
        ? (fileDirectory.NoData as number)
        : null;

      const metadata: GeoTIFFMetadata = {
        width,
        height,
        data: floatData,
        noDataValue,
        pixelScale,
        modelTiepoint,
        geoKeys,
        fileDirectory,
        crs: image.getProjection()?.code || null,
      };

      setOriginalMetadata(metadata);
      setOriginalData(floatData);
    } catch (err: any) {
      setError(`Error reading GeoTIFF: ${err.message}`);
      console.error(err);
    }
  }, []);

  const handleFilter = useCallback(async () => {
    if (!originalData || !originalMetadata) {
      setError('Please select a GeoTIFF file first');
      return;
    }

    // Validate parameters
    const sensitivity = parseFloat(sensitivityMultiplier);
    const iterations = parseInt(numberOfIterations, 10);

    if (isNaN(sensitivity) || sensitivity < 0.5 || sensitivity > 3.0) {
      setError('Sensitivity multiplier must be between 0.5 and 3.0');
      return;
    }

    if (isNaN(iterations) || iterations < 50 || iterations > 500) {
      setError('Number of iterations must be between 50 and 500');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(null);
    setFilteredData(null);

    try {
      // Create worker (we'll use inline processing for now since worker setup is complex)
      // For production, use a proper worker setup
      
      // For now, we'll do inline processing (not ideal for large files, but works)
      // In production, you'd use the worker:
      
      const config: DTMFilterConfig = {
        sensitivityMultiplier: sensitivity,
        numberOfIterations: iterations,
        baseThreshold: 0.5,
        slopeFactor: 0.05,
        wMin: 3,
        wMax: 51,
      };

      // Import processing function directly (inline processing)
      // Note: This blocks the UI thread. For large files, consider using Web Worker
      // However, worker setup requires additional configuration in Vite
      const { applyDTMFilter } = await import('./dtmFilterProcessor');
      
      // Create a progress callback
      const progressCallback = (prog: ProcessingProgress) => {
        setProgress(prog);
      };

      // Apply filter
      const filtered = applyDTMFilter(
        originalData,
        originalMetadata.width,
        originalMetadata.height,
        config,
        progressCallback
      );

      setFilteredData(filtered);
      setIsProcessing(false);
      setProgress({
        current: config.numberOfIterations,
        total: config.numberOfIterations,
        percentage: 100,
        stage: 'Complete',
      });

      // Create download URL
      const blob = new Blob([filtered.buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err: any) {
      setError(`Error applying filter: ${err.message}`);
      console.error(err);
      setIsProcessing(false);
    }
  }, [originalData, originalMetadata, sensitivityMultiplier, numberOfIterations]);

  const handleDownload = useCallback(() => {
    if (!filteredData || !downloadUrl) return;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file
      ? file.name.replace(/\.(tif|tiff)$/i, '_dtm_filtered.tif')
      : 'dtm_filtered.tif';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredData, downloadUrl, file]);

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        DTM Filter Tool
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Remove vegetation and buildings from elevation GeoTIFF (DSM/DEM) to create a bare-earth DTM.
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <Stack spacing={3}>
          {/* File Upload */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Input GeoTIFF
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              fullWidth
              sx={{ mb: 1 }}
            >
              {file ? file.name : 'Select GeoTIFF File (.tif, .tiff)'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".tif,.tiff"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
            {originalMetadata && (
              <Typography variant="caption" color="text.secondary">
                Size: {originalMetadata.width} × {originalMetadata.height} pixels
              </Typography>
            )}
          </Box>

          {/* Parameters */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Filter Parameters
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Sensitivity Multiplier"
                type="number"
                value={sensitivityMultiplier}
                onChange={(e) => setSensitivityMultiplier(e.target.value)}
                inputProps={{
                  min: 0.5,
                  max: 3.0,
                  step: 0.1,
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" title="Controls filter sensitivity. Higher values remove more features.">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="Range: 0.5 - 3.0, Default: 1.0"
                fullWidth
              />
              <TextField
                label="Number of Iterations"
                type="number"
                value={numberOfIterations}
                onChange={(e) => setNumberOfIterations(e.target.value)}
                inputProps={{
                  min: 50,
                  max: 500,
                  step: 1,
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" title="Number of filter iterations. More iterations = smoother results but slower processing.">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="Range: 50 - 500, Default: 200"
                fullWidth
              />
            </Stack>
          </Box>

          {/* Error Display */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Progress */}
          {isProcessing && progress && (
            <Box>
              <Typography variant="body2" gutterBottom>
                {progress.stage} ({progress.percentage}%)
              </Typography>
              <LinearProgress variant="determinate" value={progress.percentage} />
            </Box>
          )}

          {/* Filter Button */}
          <Button
            variant="contained"
            size="large"
            startIcon={<FilterAltIcon />}
            onClick={handleFilter}
            disabled={!originalData || isProcessing}
            fullWidth
          >
            {isProcessing ? 'Processing...' : 'Apply DTM Filter'}
          </Button>

          {/* Download Button */}
          {filteredData && downloadUrl && (
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              fullWidth
            >
              Download Filtered DTM GeoTIFF
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

