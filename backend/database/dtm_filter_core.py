"""
Core DTM filter implementation for GeoTIFF processing in memory.
"""
import numpy as np
import rasterio
from rasterio.io import MemoryFile
from scipy.ndimage import grey_opening
import logging

logger = logging.getLogger(__name__)


def _ensure_odd(x: int) -> int:
    """Ensure the value is odd (required for morphological operations)."""
    return x if x % 2 == 1 else x + 1


def apply_dtm_filter_geotiff_bytes(
    geotiff_bytes: bytes,
    sensitivity_multiplier: float = 1.0,
    iterations: int = 200,
    base_threshold_m: float = 0.8,
    base_window: int = 3,
    max_window: int = 31,
    grow_every: int = 20,
) -> bytes:
    """
    Apply DTM filter to GeoTIFF bytes in memory.
    
    Input:  GeoTIFF bytes (single-band elevation)
    Output: GeoTIFF bytes (filtered DTM approximation), same georeferencing, float32, DEFLATE compression.
    
    Args:
        geotiff_bytes: Input GeoTIFF file as bytes
        sensitivity_multiplier: Sensitivity multiplier for threshold (default: 1.0)
        iterations: Number of iterations (default: 200)
        base_threshold_m: Base threshold in meters (default: 0.8)
        base_window: Base window size for morphological operations (default: 3)
        max_window: Maximum window size (default: 31)
        grow_every: Grow window every N iterations (default: 20)
        
    Returns:
        Processed GeoTIFF as bytes
    """
    base_window = _ensure_odd(base_window)
    max_window = _ensure_odd(max_window)

    # Read GeoTIFF from memory
    with MemoryFile(geotiff_bytes) as mem:
        with mem.open() as src:
            profile = src.profile.copy()
            nodata = src.nodata
            z = src.read(1).astype(np.float32)

    # Mask NoData / NaN
    mask = ~np.isfinite(z)
    if nodata is not None:
        mask |= (z == nodata)

    # Fill NoData with min finite value to avoid "void smearing"
    z_filled = z.copy()
    finite = np.where(mask, np.nan, z_filled)
    finite_min = float(np.nanmin(finite)) if np.any(~mask) else 0.0
    z_filled[mask] = finite_min

    dtm = z_filled.copy()
    thr = float(base_threshold_m) * float(sensitivity_multiplier)

    win = base_window
    for i in range(int(iterations)):
        if grow_every > 0 and (i % grow_every == 0) and (i != 0):
            win = min(max_window, win + 2)  # keep odd

        opened = grey_opening(dtm, size=(win, win))
        diff = dtm - opened

        # Pull down values that look like objects above ground
        dtm = np.where(diff > thr, opened, dtm)

    # Restore NoData
    out_nodata = nodata if nodata is not None else -9999.0
    out = dtm.copy()
    out[mask] = out_nodata

    profile.update(
        dtype="float32",
        count=1,
        nodata=out_nodata,
        compress="deflate",
    )

    # Write output GeoTIFF to memory
    with MemoryFile() as out_mem:
        with out_mem.open(**profile) as dst:
            dst.write(out.astype(np.float32), 1)
        return out_mem.read()












