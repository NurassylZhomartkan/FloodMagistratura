"""
Core hydrologic correction (sink filling) implementation for GeoTIFF processing in memory.
Uses Priority-Flood algorithm for deterministic sink filling.
"""
import heapq
import math
import numpy as np
import rasterio
from rasterio.io import MemoryFile
import logging

logger = logging.getLogger(__name__)


def apply_hydrologic_correction_geotiff_bytes(
    geotiff_bytes: bytes,
    delta: float = 0.0,
    iterations: int = 40,  # accepted for UI compatibility (Priority-Flood does not require iterations)
    connectivity: int = 8,  # 4 or 8
) -> bytes:
    """
    Hydrologic correction (sink filling) using Priority-Flood.

    Args:
        geotiff_bytes: Input GeoTIFF file as bytes
        delta: minimum elevation increase per pixel distance.
               If delta > 0, filled cells are raised slightly above their outlet path (reduces flats).
               Typical values: 0.0 to 0.01 (depending on resolution and noise).
        iterations: kept for UI compatibility; not used by this algorithm.
        connectivity: 4 or 8 neighbors (default: 8)
        
    Returns:
        Processed GeoTIFF as bytes (float32, DEFLATE compression)
    """
    if connectivity not in (4, 8):
        raise ValueError("connectivity must be 4 or 8")

    # Read GeoTIFF from memory
    with MemoryFile(geotiff_bytes) as mem:
        with mem.open() as src:
            profile = src.profile.copy()
            nodata = src.nodata
            z = src.read(1).astype(np.float32)

    rows, cols = z.shape

    # Mask NoData / NaN
    mask = ~np.isfinite(z)
    if nodata is not None:
        mask |= (z == nodata)

    # Output array (will be filled)
    out = z.copy()

    visited = np.zeros((rows, cols), dtype=bool)

    # Neighbor offsets
    if connectivity == 4:
        nbrs = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0)]
    else:
        s2 = math.sqrt(2.0)
        nbrs = [
            (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
            (-1, -1, s2), (-1, 1, s2), (1, -1, s2), (1, 1, s2),
        ]

    heap = []

    # Helper: push a cell into heap
    def push(r, c):
        visited[r, c] = True
        heapq.heappush(heap, (float(out[r, c]), r, c))

    # Initialize with boundary cells as outlets
    for c in range(cols):
        if not mask[0, c] and not visited[0, c]:
            push(0, c)
        if not mask[rows - 1, c] and not visited[rows - 1, c]:
            push(rows - 1, c)
    for r in range(rows):
        if not mask[r, 0] and not visited[r, 0]:
            push(r, 0)
        if not mask[r, cols - 1] and not visited[r, cols - 1]:
            push(r, cols - 1)

    # Also treat internal NoData borders as outlets (optional but often helpful)
    # Any valid cell adjacent to NoData is seeded into the queue.
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            if mask[r, c] or visited[r, c]:
                continue
            if (mask[r - 1, c] or mask[r + 1, c] or mask[r, c - 1] or mask[r, c + 1]):
                push(r, c)

    d = float(delta)

    # Priority-Flood
    while heap:
        elev, r, c = heapq.heappop(heap)

        for dr, dc, dist in nbrs:
            rr, cc = r + dr, c + dc
            if rr < 0 or rr >= rows or cc < 0 or cc >= cols:
                continue
            if visited[rr, cc] or mask[rr, cc]:
                continue

            visited[rr, cc] = True

            neigh = float(out[rr, cc])
            # Enforce that neighbor is at least current elevation + delta * distance
            min_allowed = elev + d * dist

            if neigh < min_allowed:
                out[rr, cc] = np.float32(min_allowed)
                heapq.heappush(heap, (min_allowed, rr, cc))
            else:
                heapq.heappush(heap, (neigh, rr, cc))

    # Restore NoData
    out_nodata = nodata if nodata is not None else -9999.0
    out[mask] = out_nodata

    profile.update(dtype="float32", count=1, nodata=out_nodata, compress="deflate")

    # Write output GeoTIFF to memory
    with MemoryFile() as out_mem:
        with out_mem.open(**profile) as dst:
            dst.write(out.astype(np.float32), 1)
        return out_mem.read()












