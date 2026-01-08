"""
Core bilateral noise filter implementation for GeoTIFF processing in memory.
"""
import numpy as np
import rasterio
from rasterio.io import MemoryFile
from skimage.restoration import denoise_bilateral
import logging

logger = logging.getLogger(__name__)


def _ensure_odd(n: int) -> int:
    """Ensure the value is odd (required for bilateral filter window)."""
    return n if n % 2 == 1 else n + 1


def apply_bilateral_noise_filter_geotiff_bytes(
    geotiff_bytes: bytes,
    filter_size_pixels: int = 10,
    spatial_tolerance: float = 5.0,
    value_tolerance: float = 1.0,
) -> bytes:
    """
    Bilateral denoising for single-band elevation GeoTIFF.
    Returns a GeoTIFF (float32) with the same georeferencing.
    
    Args:
        geotiff_bytes: Input GeoTIFF file as bytes
        filter_size_pixels: Filter window size in pixels (will be made odd)
        spatial_tolerance: Spatial tolerance (sigma_spatial) in pixels (default: 5.0)
        value_tolerance: Value tolerance (sigma_color) in elevation units, typically meters (default: 1.0)
        
    Returns:
        Processed GeoTIFF as bytes
    """
    win = _ensure_odd(int(filter_size_pixels))

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

    # Fill NoData to avoid contaminating neighborhoods; restore later
    z_filled = z.copy()
    finite = np.where(mask, np.nan, z_filled)
    finite_min = float(np.nanmin(finite)) if np.any(~mask) else 0.0
    z_filled[mask] = finite_min

    # skimage bilateral expects finite floats; preserves edges better than plain Gaussian
    z_filtered = denoise_bilateral(
        z_filled,
        win_size=win,
        sigma_spatial=float(spatial_tolerance),
        sigma_color=float(value_tolerance),
        channel_axis=None,
    ).astype(np.float32)

    # Restore NoData
    out_nodata = nodata if nodata is not None else -9999.0
    z_filtered[mask] = out_nodata

    profile.update(dtype="float32", count=1, nodata=out_nodata, compress="deflate")

    # Write output GeoTIFF to memory
    with MemoryFile() as out_mem:
        with out_mem.open(**profile) as dst:
            dst.write(z_filtered, 1)
        return out_mem.read()












