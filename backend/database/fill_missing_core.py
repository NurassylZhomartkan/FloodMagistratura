"""
Core implementation for filling missing values in DEM/DSM GeoTIFF files.
Supports two methods:
1. Nearest-neighbor: fills all NoData/NaN cells from the closest valid elevation
2. Ocean edge classification: treats NoData regions connected to raster edge as "ocean" 
   and fills them with a constant sea level, then fills remaining internal gaps via nearest-neighbor
"""
import numpy as np
import rasterio
from rasterio.io import MemoryFile
from scipy.ndimage import distance_transform_edt, label
import logging

logger = logging.getLogger(__name__)


def _read_single_band_geotiff(geotiff_bytes: bytes):
    """Читает одноканальный GeoTIFF из байтов."""
    with MemoryFile(geotiff_bytes) as mem:
        with mem.open() as src:
            profile = src.profile.copy()
            nodata = src.nodata
            z = src.read(1).astype(np.float32)
    return z, profile, nodata


def _write_single_band_geotiff(z: np.ndarray, profile: dict, nodata) -> bytes:
    """Записывает одноканальный GeoTIFF в байты."""
    profile = profile.copy()
    if nodata is None:
        nodata = -9999.0
    profile.update(dtype="float32", count=1, nodata=nodata, compress="deflate")

    with MemoryFile() as out_mem:
        with out_mem.open(**profile) as dst:
            dst.write(z.astype(np.float32), 1)
        return out_mem.read()


def _nearest_neighbor_fill(z: np.ndarray, missing_mask: np.ndarray) -> np.ndarray:
    """
    Заполняет пропущенные значения используя ближайший валидный пиксель.
    Использует distance transform для получения индекса ближайшего валидного пикселя для каждого пропущенного.
    
    Args:
        z: Массив высот
        missing_mask: Булева маска пропущенных значений (True = пропущено)
        
    Returns:
        Массив с заполненными пропущенными значениями
    """
    if not np.any(missing_mask):
        return z

    valid_mask = ~missing_mask
    if not np.any(valid_mask):
        # Все пропущено; нечего заполнять
        return z

    # distance_transform_edt ожидает True для объектов; нам нужны индексы ближайшего валидного пикселя
    # Передаем missing_mask и запрашиваем индексы ближайшего валидного (т.е. ближайшего False в missing_mask).
    _, (ri, ci) = distance_transform_edt(missing_mask, return_indices=True)

    out = z.copy()
    out[missing_mask] = z[ri[missing_mask], ci[missing_mask]]
    return out


def _ocean_edge_classification_fill(
    z: np.ndarray,
    missing_mask: np.ndarray,
    ocean_level: float = 0.0,
    connectivity: int = 8,
) -> np.ndarray:
    """
    Классифицирует пропущенные области, соединенные с границей растра, как океан, заполняет их ocean_level.
    Оставшиеся пропущенные пиксели (внутренние дыры) заполняются ближайшим соседом.
    
    Args:
        z: Массив высот
        missing_mask: Булева маска пропущенных значений (True = пропущено)
        ocean_level: Уровень моря для заполнения краевых пропусков (по умолчанию 0.0)
        connectivity: Связность (4 или 8 соседей)
        
    Returns:
        Массив с заполненными пропущенными значениями
    """
    if not np.any(missing_mask):
        return z

    if connectivity not in (4, 8):
        raise ValueError("connectivity must be 4 or 8")

    # Маркировка связных компонент на пропущенных пикселях
    structure = None
    if connectivity == 4:
        structure = np.array([[0,1,0],
                              [1,1,1],
                              [0,1,0]], dtype=np.uint8)
    else:
        structure = np.ones((3,3), dtype=np.uint8)

    lbl, n = label(missing_mask, structure=structure)
    if n == 0:
        return z

    rows, cols = z.shape
    edge_labels = set()

    # Собираем метки, которые касаются краев
    edge_labels.update(np.unique(lbl[0, :]))
    edge_labels.update(np.unique(lbl[rows - 1, :]))
    edge_labels.update(np.unique(lbl[:, 0]))
    edge_labels.update(np.unique(lbl[:, cols - 1]))
    edge_labels.discard(0)  # 0 означает "не пропущено"

    ocean_mask = np.isin(lbl, list(edge_labels)) if edge_labels else np.zeros_like(missing_mask, dtype=bool)

    out = z.copy()
    out[ocean_mask] = np.float32(ocean_level)

    # Заполняем оставшиеся пропуски (внутренние дыры) ближайшим соседом
    remaining_missing = missing_mask & (~ocean_mask)
    out = _nearest_neighbor_fill(out, remaining_missing)
    return out


def fill_missing_values_geotiff_bytes(
    geotiff_bytes: bytes,
    method: str = "nearest",            # "nearest" or "ocean_edge"
    ocean_level: float = 0.0,           # используется только для ocean_edge
    connectivity: int = 8,
) -> bytes:
    """
    Заполняет пропущенные значения в одноканальном DEM GeoTIFF.
    Возвращает GeoTIFF байты с той же геопривязкой.
    
    Args:
        geotiff_bytes: Входной GeoTIFF файл в виде байтов
        method: Метод заполнения ("nearest" или "ocean_edge")
        ocean_level: Уровень моря для метода ocean_edge (по умолчанию 0.0)
        connectivity: Связность для метода ocean_edge (4 или 8 соседей)
        
    Returns:
        Обработанный GeoTIFF в виде байтов (float32, DEFLATE сжатие)
    """
    z, profile, nodata = _read_single_band_geotiff(geotiff_bytes)

    missing = ~np.isfinite(z)
    if nodata is not None:
        missing |= (z == nodata)

    # Для вывода обычно хотим убрать пропуски; сохраняем nodata тег, но пропущенных пикселей не остается.
    if method == "nearest":
        out = _nearest_neighbor_fill(z, missing)
    elif method == "ocean_edge":
        out = _ocean_edge_classification_fill(z, missing, ocean_level=ocean_level, connectivity=connectivity)
    else:
        raise ValueError("method must be 'nearest' or 'ocean_edge'")

    # Если вы хотите "полностью заполненные" растры, можете сохранить nodata метаданные, 
    # но пропущенных пикселей быть не должно.
    # Мы все еще восстанавливаем исходное nodata значение только там, где пиксели остаются пропущенными (должно быть нигде).
    out_nodata = nodata if nodata is not None else -9999.0
    out_missing = ~np.isfinite(out) | ((out == out_nodata) if nodata is not None else False)
    # Обычно out_missing должно быть все False; если нет, оставляем как nodata
    out[out_missing] = out_nodata

    return _write_single_band_geotiff(out, profile, out_nodata)












