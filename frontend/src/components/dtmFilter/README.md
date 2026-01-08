# DTM Filter Tool

Browser-based DTM (Digital Terrain Model) filter tool that removes vegetation and buildings from elevation GeoTIFF files (DSM/DEM) to create bare-earth DTMs.

## Features

- **Frontend-only processing**: All processing happens in the browser, no backend required
- **Progressive Morphological Filter (PMF)**: Implements an efficient PMF algorithm for DTM extraction
- **Efficient algorithms**: Uses sliding window min/max filters with deque (double-ended queue) for O(n) complexity
- **GeoTIFF support**: Reads and processes single-band GeoTIFF files (Float32, Int16, Uint16)
- **Preserves georeferencing**: Maintains projection and georeferencing information (when output format supports it)

## Usage

```tsx
import DTMFilterTool from './components/dtmFilter/DTMFilterTool';

function App() {
  return <DTMFilterTool />;
}
```

## Parameters

- **Sensitivity Multiplier** (0.5-3.0, default: 1.0): Controls filter sensitivity. Higher values remove more features (vegetation/buildings).
- **Number of Iterations** (50-500, default: 200): Number of filter iterations. More iterations = smoother results but slower processing.

## Algorithm

The tool implements a Progressive Morphological Filter (PMF):

1. Iteratively increases window size from `wMin=3` to `wMax=51` (odd sizes only)
2. For each iteration:
   - Computes morphological opening (erosion followed by dilation)
   - Calculates difference: `d = Z - opening`
   - Applies threshold: `T = sensitivity × (baseThreshold + slopeFactor × w × cellSize)`
   - Where `d > T`, clamps elevation: `Z = min(Z, opening + T)`

## Technical Details

### Morphological Operations

Uses efficient 1D sliding window min/max filters applied separably (rows then columns) to achieve 2D morphological operations:
- **Erosion**: Min filter
- **Dilation**: Max filter  
- **Opening**: Erosion followed by dilation

### Complexity

- Time: O(n × w) where n = number of pixels, w = max window size
- Space: O(n) for output buffer, O(w) for deque

### Limitations

- Currently uses inline processing (blocks UI thread). For large files, consider implementing Web Worker
- Output format: Currently outputs raw Float32Array. Full GeoTIFF writing with georeferencing requires a TIFF writer library
- Memory: Limited by browser memory (recommended max ~100M pixels)

## Future Improvements

- [ ] Proper Web Worker implementation with Vite bundling
- [ ] Full GeoTIFF output with georeferencing (requires TIFF writer library)
- [ ] Preview mode with downsampling for large rasters
- [ ] Multi-threaded processing using OffscreenCanvas
- [ ] Cloud Optimized GeoTIFF (COG) support

## Dependencies

- `geotiff` (already in package.json)
- React
- Material-UI (MUI)

## Notes

The worker implementation (`dtmFilterWorker.ts`) is currently a placeholder. The tool uses inline processing from `dtmFilterProcessor.ts`. To enable proper worker support:

1. Configure Vite to handle worker.ts files
2. Set up proper message passing between main thread and worker
3. Transfer ArrayBuffers efficiently to avoid copying












