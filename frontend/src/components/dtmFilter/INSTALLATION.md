# DTM Filter Tool - Installation & Usage

## Quick Start

The DTM Filter Tool is already integrated into the application. Access it at:

```
http://127.0.0.1:5173/app/dtm-filter
```

## Files Created

### Core Files
- `types.ts` - TypeScript type definitions
- `morphologyUtils.ts` - Morphological operations (erosion, dilation, opening)
- `dtmFilterProcessor.ts` - Core DTM filter algorithm
- `DTMFilterTool.tsx` - React UI component
- `geotiffWriter.ts` - GeoTIFF writing utilities (placeholder)
- `dtmFilterWorker.ts` - Web Worker (placeholder for future implementation)

### Page
- `pages/DTMFilterPage.tsx` - Page wrapper for the tool

### Documentation
- `README.md` - Detailed documentation
- `INSTALLATION.md` - This file

## Dependencies

All required dependencies are already in `package.json`:
- `geotiff` - GeoTIFF reading
- `react` - UI framework
- `@mui/material` - UI components
- `@mui/icons-material` - Icons

## Usage

1. Start the development server:
   ```bash
   cd frontend
   npm run dev
   ```

2. Navigate to: `http://127.0.0.1:5173/app/dtm-filter`

3. Upload a GeoTIFF file (.tif or .tiff)

4. Adjust parameters:
   - Sensitivity Multiplier (0.5-3.0)
   - Number of Iterations (50-500)

5. Click "Apply DTM Filter"

6. Download the filtered result

## Notes

- **Processing**: Currently uses inline processing (blocks UI thread). For large files, this may cause the page to become unresponsive temporarily.
- **Output**: Downloads filtered data as raw binary Float32Array. To create a proper GeoTIFF with georeferencing, use external tools or implement a TIFF writer library.
- **Memory**: Recommended maximum file size ~100M pixels (e.g., 10000×10000)

## Future Enhancements

- [ ] Web Worker implementation for non-blocking processing
- [ ] Full GeoTIFF output with georeferencing
- [ ] Preview mode with downsampling
- [ ] Progress indication improvements
- [ ] Multi-threaded processing using OffscreenCanvas










