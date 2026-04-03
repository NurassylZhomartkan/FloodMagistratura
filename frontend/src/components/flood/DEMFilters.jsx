// frontend/src/components/flood/DEMFilters.jsx
// Компонент для управления фильтрами DEM

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  CircularProgress,
  RadioGroup,
  Radio,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import InfoIcon from '@mui/icons-material/Info';

/**
 * Компонент для управления фильтрами DEM
 * 
 * @param {Object} props
 * @param {boolean} props.open - Открыт ли главный диалог фильтров
 * @param {Function} props.onClose - Callback при закрытии главного диалога
 * @param {Function} props.onApplyFilter - Callback при применении фильтра (filterType, params)
 * @param {boolean} props.hasFilterHistory - Есть ли история примененных фильтров
 * @param {Function} props.onUndo - Callback для отмены всех фильтров
 */
export default function DEMFilters({
  open,
  onClose,
  onApplyFilter,
  hasFilterHistory,
  onUndo,
}) {
  const { t } = useTranslation();
  // Состояния для главного диалога
  const [dtmFilterDialogOpen, setDtmFilterDialogOpen] = useState(false);
  const [noiseFilterDialogOpen, setNoiseFilterDialogOpen] = useState(false);
  const [hydroCorrectionDialogOpen, setHydroCorrectionDialogOpen] = useState(false);
  const [fillDemHolesDialogOpen, setFillDemHolesDialogOpen] = useState(false);

  // Состояния для параметров DTM Filter
  const [sensitivityMultiplier, setSensitivityMultiplier] = useState('1.0');
  const [numberOfIterations, setNumberOfIterations] = useState('200');
  const [dtmFilterLoading, setDtmFilterLoading] = useState(false);
  const [dtmFilterError, setDtmFilterError] = useState(null);

  // Состояния для параметров Noise Filter
  const [filterSize, setFilterSize] = useState('10');
  const [spatialTolerance, setSpatialTolerance] = useState('5');
  const [valueTolerance, setValueTolerance] = useState('1');
  const [noiseFilterLoading, setNoiseFilterLoading] = useState(false);

  // Состояния для параметров Hydro Correction
  const [delta, setDelta] = useState('0.0');
  const [hydroIterations, setHydroIterations] = useState('40');
  const [hydroCorrectionLoading, setHydroCorrectionLoading] = useState(false);
  const [hydroCorrectionError, setHydroCorrectionError] = useState(null);

  // Состояния для параметров Fill DEM Holes
  const [fillMethod, setFillMethod] = useState('nearest-neighbor');
  const [fillDemHolesLoading, setFillDemHolesLoading] = useState(false);

  // Обработчик применения DTM Filter
  const handleApplyDtmFilter = async () => {
    setDtmFilterLoading(true);
    setDtmFilterError(null);
    
    try {
      // Валидация параметров
      const sensitivity = parseFloat(sensitivityMultiplier);
      const iterations = parseInt(numberOfIterations, 10);
      
      if (isNaN(sensitivity) || sensitivity <= 0) {
        throw new Error('Sensitivity Multiplier должен быть положительным числом');
      }
      
      if (isNaN(iterations) || iterations < 1) {
        throw new Error('Number of Iterations должен быть целым числом больше 0');
      }
      
      const params = {
        sensitivityMultiplier: sensitivity,
        numberOfIterations: iterations,
      };
      
      // Ждем успешного применения фильтра
      await onApplyFilter('DTM_FILTER', params);
      
      // Закрываем диалог только после успешного применения
      setDtmFilterDialogOpen(false);
    } catch (error) {
      console.error('Ошибка при применении DTM фильтра:', error);
      setDtmFilterError(error.message || t('demFilters.filterError'));
      // Не закрываем диалог при ошибке
    } finally {
      setDtmFilterLoading(false);
    }
  };

  // Обработчик применения Noise Filter
  const handleApplyNoiseFilter = async () => {
    setNoiseFilterLoading(true);
    try {
      const params = {
        filterSize: parseInt(filterSize, 10),
        spatialTolerance: parseFloat(spatialTolerance),
        valueTolerance: parseFloat(valueTolerance),
      };
      await onApplyFilter('NOISE_FILTER', params);
      setNoiseFilterDialogOpen(false);
    } finally {
      setNoiseFilterLoading(false);
    }
  };

  // Обработчик применения Hydro Correction
  const handleApplyHydroCorrection = async () => {
    setHydroCorrectionLoading(true);
    setHydroCorrectionError(null);
    try {
      // Валидация параметров
      const deltaValue = parseFloat(delta);
      const iterations = parseInt(hydroIterations, 10);
      
      if (isNaN(deltaValue) || deltaValue < 0) {
        throw new Error(t('demFilters.deltaError'));
      }
      
      if (isNaN(iterations) || iterations < 1) {
        throw new Error(t('demFilters.hydroIterationsError'));
      }
      
      const params = {
        delta: deltaValue,
        numberOfIterations: iterations,
      };
      
      await onApplyFilter('HYDRO_CORRECTION', params);
      setHydroCorrectionDialogOpen(false);
    } catch (error) {
      console.error('Ошибка при применении гидрологической коррекции:', error);
      setHydroCorrectionError(error.message || t('demFilters.filterError'));
    } finally {
      setHydroCorrectionLoading(false);
    }
  };

  // Обработчик применения Fill DEM Holes
  const handleApplyFillDemHoles = async () => {
    setFillDemHolesLoading(true);
    try {
      const params = {
        fillMethod: fillMethod,
      };
      await onApplyFilter('FILL_DEM_HOLES', params);
      setFillDemHolesDialogOpen(false);
    } finally {
      setFillDemHolesLoading(false);
    }
  };

  return (
    <>
      {/* Главный диалог фильтров */}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pb: 1,
          fontWeight: 600,
        }}>
          {t('demFilters.title')}
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                onClose();
                setDtmFilterDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                backgroundColor: 'primary.main',
                color: '#FFFFFF',
                py: 1.5,
                background: 'linear-gradient(180deg, #0077B6 0%, #0369A1 100%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                '&:hover': {
                  background: 'linear-gradient(180deg, #0369A1 0%, #023E8A 100%)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                },
              }}
            >
              {t('demFilters.dtmFilter')}
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                onClose();
                setNoiseFilterDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                backgroundColor: 'primary.main',
                color: '#FFFFFF',
                py: 1.5,
                background: 'linear-gradient(180deg, #0077B6 0%, #0369A1 100%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                '&:hover': {
                  background: 'linear-gradient(180deg, #0369A1 0%, #023E8A 100%)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                },
              }}
            >
              {t('demFilters.noiseFilter')}
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                onClose();
                setHydroCorrectionDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                backgroundColor: 'primary.main',
                color: '#FFFFFF',
                py: 1.5,
                background: 'linear-gradient(180deg, #0077B6 0%, #0369A1 100%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                '&:hover': {
                  background: 'linear-gradient(180deg, #0369A1 0%, #023E8A 100%)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                },
              }}
            >
              {t('demFilters.hydroCorrection')}
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                onClose();
                setFillDemHolesDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                backgroundColor: 'primary.main',
                color: '#FFFFFF',
                py: 1.5,
                background: 'linear-gradient(180deg, #0077B6 0%, #0369A1 100%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                '&:hover': {
                  background: 'linear-gradient(180deg, #0369A1 0%, #023E8A 100%)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                },
              }}
            >
              {t('demFilters.fillDemHoles')}
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={onUndo}
              disabled={!hasFilterHistory}
              sx={{
                textTransform: 'none',
                backgroundColor: hasFilterHistory ? 'primary.main' : 'text.disabled',
                color: '#FFFFFF',
                py: 1.5,
                background: hasFilterHistory
                  ? 'linear-gradient(180deg, #0077B6 0%, #0369A1 100%)'
                  : 'none',
                boxShadow: hasFilterHistory ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                '&:hover': {
                  background: hasFilterHistory
                    ? 'linear-gradient(180deg, #0369A1 0%, #023E8A 100%)'
                    : 'text.disabled',
                  boxShadow: hasFilterHistory ? '0 4px 8px rgba(0,0,0,0.3)' : 'none',
                },
                '&:disabled': {
                  backgroundColor: 'text.disabled',
                  color: '#FFFFFF',
                },
              }}
            >
              {t('demFilters.undo')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Диалог DTM Filter */}
      <Dialog
        open={dtmFilterDialogOpen}
        onClose={() => {
          if (!dtmFilterLoading) {
            setDtmFilterDialogOpen(false);
            setDtmFilterError(null);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pb: 1,
          fontWeight: 600,
        }}>
          Apply DTM filter
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Apply DTM filter that attempts to remove vegetation and buildings from the elevation data.
            </Typography>

            <TextField
              label="Sensitivity multiplier"
              type="number"
              value={sensitivityMultiplier}
              onChange={(e) => setSensitivityMultiplier(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main' }}
                      title="Information about sensitivity multiplier"
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                step: '0.1',
                min: '0',
              }}
            />

            <TextField
              label="Number of Iterations"
              type="number"
              value={numberOfIterations}
              onChange={(e) => setNumberOfIterations(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main' }}
                      title="Information about number of iterations"
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                step: '1',
                min: '1',
              }}
            />
            
            {dtmFilterError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {dtmFilterError}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => {
              setDtmFilterDialogOpen(false);
              setDtmFilterError(null);
            }}
            variant="contained"
            disabled={dtmFilterLoading}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {t('common.close')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleApplyDtmFilter}
            variant="contained"
            disabled={dtmFilterLoading}
            startIcon={dtmFilterLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {dtmFilterLoading ? t('demFilters.loading') : t('demFilters.apply')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог Noise Filter */}
      <Dialog
        open={noiseFilterDialogOpen}
        onClose={() => setNoiseFilterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pb: 1,
          fontWeight: 600,
          textAlign: 'center',
        }}>
          Apply Bilateral Gaussian Filter to eliminate noise. This also reduces details.
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 150 }}>
                Filter Size (pixels):
              </Typography>
              <TextField
                type="number"
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                sx={{ flex: 1 }}
                inputProps={{
                  step: '1',
                  min: '1',
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 150 }}>
                Spatial tolerance:
              </Typography>
              <TextField
                type="number"
                value={spatialTolerance}
                onChange={(e) => setSpatialTolerance(e.target.value)}
                sx={{ flex: 1 }}
                inputProps={{
                  step: '0.1',
                  min: '0',
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 150 }}>
                Value tolerance:
              </Typography>
              <TextField
                type="number"
                value={valueTolerance}
                onChange={(e) => setValueTolerance(e.target.value)}
                sx={{ flex: 1 }}
                inputProps={{
                  step: '0.1',
                  min: '0',
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setNoiseFilterDialogOpen(false)}
            variant="contained"
            disabled={noiseFilterLoading}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {t('common.close')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleApplyNoiseFilter}
            variant="contained"
            disabled={noiseFilterLoading}
            startIcon={noiseFilterLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {noiseFilterLoading ? t('demFilters.loading') : t('demFilters.apply')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог Hydro Correction */}
      <Dialog
        open={hydroCorrectionDialogOpen}
        onClose={() => {
          if (!hydroCorrectionLoading) {
            setHydroCorrectionDialogOpen(false);
            setHydroCorrectionError(null);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pb: 1,
          fontWeight: 600,
        }}>
          Apply Hydrological Correction
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Apply hydrological correction to remove local depressions caused by data errors. This also removes all reservoirs.
            </Typography>

            <TextField
              label="Delta (minimum elevation increase per pixel distance)"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main' }}
                      title="Delta: 0.0 = classic flat fill (can create large flat lakes). > 0 = enforces a tiny downhill gradient so filled areas drain (reduces flats). Typical values: 0.0 to 0.01"
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                step: '0.001',
                min: '0',
              }}
            />

            <TextField
              label="Number of iterations"
              type="number"
              value={hydroIterations}
              onChange={(e) => setHydroIterations(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main' }}
                      title="Number of iterations: kept for UI compatibility. Priority-Flood algorithm does not require iterations (single pass, deterministic)."
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                step: '1',
                min: '1',
              }}
            />
            
            {hydroCorrectionError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {hydroCorrectionError}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => {
              setHydroCorrectionDialogOpen(false);
              setHydroCorrectionError(null);
            }}
            variant="contained"
            disabled={hydroCorrectionLoading}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {t('common.close')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleApplyHydroCorrection}
            variant="contained"
            disabled={hydroCorrectionLoading}
            startIcon={hydroCorrectionLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {hydroCorrectionLoading ? t('demFilters.loading') : t('demFilters.apply')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог Fill DEM Holes */}
      <Dialog
        open={fillDemHolesDialogOpen}
        onClose={() => setFillDemHolesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pb: 1,
        }}>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Select a method to fill missing values in the DEM:
            </Typography>

            <RadioGroup
              value={fillMethod}
              onChange={(e) => setFillMethod(e.target.value)}
              sx={{ gap: 2 }}
            >
              <FormControlLabel
                value="nearest-neighbor"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography>Nearest-neighbor</Typography>
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main', p: 0.5 }}
                      title="Information about nearest-neighbor method"
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
              <FormControlLabel
                value="ocean-edge-classification"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography>Ocean edge classification</Typography>
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main', p: 0.5 }}
                      title="Information about ocean edge classification method"
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
            </RadioGroup>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setFillDemHolesDialogOpen(false)}
            variant="contained"
            disabled={fillDemHolesLoading}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {t('common.close')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleApplyFillDemHoles}
            variant="contained"
            disabled={fillDemHolesLoading}
            startIcon={fillDemHolesLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              backgroundColor: 'primary.main',
              color: '#FFFFFF',
              background: 'linear-gradient(180deg, #0077B6 0%, #0369A1 100%)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              '&:hover': {
                background: 'linear-gradient(180deg, #0369A1 0%, #023E8A 100%)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              },
            }}
          >
            {fillDemHolesLoading ? t('demFilters.loading') : t('demFilters.apply')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

