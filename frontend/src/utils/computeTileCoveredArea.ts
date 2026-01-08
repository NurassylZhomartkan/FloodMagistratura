/**
 * Утилиты для расчета площади покрытия растровых тайлов на основе alpha > 0
 * С правильной обработкой 404 для отсутствующих тайлов
 */

const TILE_SIZE = 256;

function tileYToLatRad(z: number, yFloat: number): number {
  const n = Math.PI - (2 * Math.PI * yFloat) / Math.pow(2, z);
  return Math.atan(Math.sinh(n));
}

function metersPerPixel(z: number, latRad: number): number {
  return (156543.03392 * Math.cos(latRad)) / Math.pow(2, z);
}

/**
 * Вычисляет количество пикселей с alpha > 0 в тайле
 * Правильно обрабатывает 404 - возвращает 0 для отсутствующих тайлов
 */
export async function computeTilePixelCount_FromUrl(params: {
  url: string;      // full tile URL including time query param
  sampleStep?: number; // 1 precise, 2/4 faster
}): Promise<number> {
  const { url, sampleStep = 1 } = params;

  const res = await fetch(url);

  // IMPORTANT: missing tile is not an error; treat as empty
  if (res.status === 404) {
    return 0;
  }

  if (!res.ok) {
    throw new Error(`Tile fetch failed: ${res.status} ${res.statusText} url=${url}`);
  }

  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D context");

  ctx.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
  const { data } = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);

  let pixelCount = 0;

  for (let py = 0; py < TILE_SIZE; py += sampleStep) {
    for (let px = 0; px < TILE_SIZE; px += sampleStep) {
      const idx = (py * TILE_SIZE + px) * 4;
      const a = data[idx + 3];
      // alpha > 0 means covered
      if (a > 0) pixelCount += 1;
    }
  }

  // Если использовали sampleStep > 1, нужно умножить на квадрат sampleStep для приблизительного подсчета
  if (sampleStep > 1) {
    pixelCount *= sampleStep * sampleStep;
  }

  return pixelCount;
}

/**
 * Вычисляет площадь покрытия тайла (в м²) на основе пикселей с alpha > 0
 * Правильно обрабатывает 404 - возвращает 0 для отсутствующих тайлов
 */
export async function computeTileCoveredAreaM2_FromUrl(params: {
  url: string;      // full tile URL including time query param
  z: number;        // integer zoom used for tile indices
  y: number;        // XYZ y
  sampleStep?: number; // 1 precise, 2/4 faster
}): Promise<number> {
  const { url, z, y, sampleStep = 2 } = params;

  const res = await fetch(url);

  // IMPORTANT: missing tile is not an error; treat as empty
  if (res.status === 404) {
    return 0;
  }

  if (!res.ok) {
    throw new Error(`Tile fetch failed: ${res.status} ${res.statusText} url=${url}`);
  }

  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D context");

  ctx.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
  const { data } = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);

  let areaM2 = 0;
  const blockFactor = sampleStep * sampleStep;

  for (let py = 0; py < TILE_SIZE; py += sampleStep) {
    const yFloat = y + (py + sampleStep / 2) / TILE_SIZE;
    const latRad = tileYToLatRad(z, yFloat);
    const mpp = metersPerPixel(z, latRad);
    const pixelArea = (mpp * mpp) * blockFactor;

    for (let px = 0; px < TILE_SIZE; px += sampleStep) {
      const idx = (py * TILE_SIZE + px) * 4;
      const a = data[idx + 3];
      // alpha > 0 means covered
      if (a > 0) areaM2 += pixelArea;
    }
  }

  return areaM2;
}

/**
 * Конвертирует долготу в координату X тайла (XYZ)
 */
export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

/**
 * Конвертирует широту в координату Y тайла (XYZ)
 */
export function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return Math.floor(((1 - n / Math.PI) / 2) * Math.pow(2, z));
}

/**
 * Вычисляет диапазон тайлов для заданных границ viewport
 */
export function getTileRange(
  west: number,
  south: number,
  east: number,
  north: number,
  z: number
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const xMin = lonToTileX(west, z);
  const xMax = lonToTileX(east, z);
  const yMin = latToTileY(north, z); // north дает меньший y в XYZ
  const yMax = latToTileY(south, z); // south дает больший y в XYZ

  return { xMin, xMax, yMin, yMax };
}

/**
 * Ограничитель параллелизма для выполнения задач
 */
async function withLimit<T>(
  limit: number,
  tasks: (() => Promise<T>)[]
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      if (idx < tasks.length) {
        results[idx] = await tasks[idx]();
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Вычисляет общее количество пикселей с alpha > 0 для всех тайлов в viewport
 * Правильно обрабатывает 404 - отсутствующие тайлы считаются как 0
 */
export async function computeViewportPixelCount(params: {
  bounds: { west: number; south: number; east: number; north: number };
  zInt: number;
  projectId: number;
  time: string | null;
  cache?: Map<string, number>;
  concurrencyLimit?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ pixelCount: number; tilesProcessed: number; tilesFound: number; tilesNotFound: number }> {
  const {
    bounds,
    zInt,
    projectId,
    time,
    cache = new Map(),
    concurrencyLimit = 8,
    onProgress,
  } = params;

  const { xMin, xMax, yMin, yMax } = getTileRange(
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    zInt
  );

  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ x, y });
    }
  }

  const totalTiles = tiles.length;
  let processed = 0;
  let totalPixelCount = 0;
  let tilesFound = 0;
  let tilesNotFound = 0;

  // Создаем задачи для обработки тайлов
  const tasks = tiles.map((tile) => async (): Promise<void> => {
    const cacheKey = `pixels|${projectId}|${time || "no-time"}|${zInt}|${tile.x}|${tile.y}`;
    
    // Проверяем кэш
    if (cache.has(cacheKey)) {
      const cachedPixels = cache.get(cacheKey)!;
      totalPixelCount += cachedPixels;
      if (cachedPixels > 0) {
        tilesFound++;
      } else {
        tilesNotFound++;
      }
      processed++;
      if (onProgress) onProgress(processed, totalTiles);
      return;
    }

    try {
      // Строим URL тайла точно как в backend routing
      let url = `/api/map/tiles/${projectId}/${zInt}/${tile.x}/${tile.y}.png?v=2`;
      if (time) {
        url += `&time=${encodeURIComponent(time)}`;
      }

      const pixelCount = await computeTilePixelCount_FromUrl({
        url,
        sampleStep: 1, // Используем sampleStep=1 для точного подсчета всех пикселей
      });

      // Кэшируем результат (включая 0 для 404)
      cache.set(cacheKey, pixelCount);
      totalPixelCount += pixelCount;
      
      if (pixelCount > 0) {
        tilesFound++;
      } else {
        tilesNotFound++;
      }
    } catch (error) {
      // Ошибки кроме 404 логируем, но не прерываем вычисление
      console.warn(`Failed to process tile ${tile.x},${tile.y}:`, error);
      // В случае ошибки считаем пиксели = 0 и кэшируем
      cache.set(cacheKey, 0);
      tilesNotFound++;
    }

    processed++;
    if (onProgress) onProgress(processed, totalTiles);
  });

  // Выполняем задачи с ограничением параллелизма
  await withLimit(concurrencyLimit, tasks);

  return {
    pixelCount: totalPixelCount,
    tilesProcessed: processed,
    tilesFound,
    tilesNotFound,
  };
}

/**
 * Вычисляет общую площадь покрытия для всех тайлов в viewport
 * Правильно обрабатывает 404 - отсутствующие тайлы считаются как 0
 */
export async function computeViewportCoveredArea(params: {
  bounds: { west: number; south: number; east: number; north: number };
  zInt: number;
  projectId: number;
  time: string | null;
  cache?: Map<string, number>;
  concurrencyLimit?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ areaM2: number; areaKm2: number; tilesProcessed: number; tilesFound: number; tilesNotFound: number }> {
  const {
    bounds,
    zInt,
    projectId,
    time,
    cache = new Map(),
    concurrencyLimit = 8,
    onProgress,
  } = params;

  const { xMin, xMax, yMin, yMax } = getTileRange(
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    zInt
  );

  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ x, y });
    }
  }

  const totalTiles = tiles.length;
  let processed = 0;
  let totalAreaM2 = 0;
  let tilesFound = 0;
  let tilesNotFound = 0;

  // Создаем задачи для обработки тайлов
  const tasks = tiles.map((tile) => async (): Promise<void> => {
    const cacheKey = `${projectId}|${time || "no-time"}|${zInt}|${tile.x}|${tile.y}`;
    
    // Проверяем кэш
    if (cache.has(cacheKey)) {
      const cachedArea = cache.get(cacheKey)!;
      totalAreaM2 += cachedArea;
      if (cachedArea > 0) {
        tilesFound++;
      } else {
        tilesNotFound++;
      }
      processed++;
      if (onProgress) onProgress(processed, totalTiles);
      return;
    }

    try {
      // Строим URL тайла точно как в backend routing
      let url = `/api/map/tiles/${projectId}/${zInt}/${tile.x}/${tile.y}.png?v=2`;
      if (time) {
        url += `&time=${encodeURIComponent(time)}`;
      }

      const areaM2 = await computeTileCoveredAreaM2_FromUrl({
        url,
        z: zInt,
        y: tile.y,
        sampleStep: 2,
      });

      // Кэшируем результат (включая 0 для 404)
      cache.set(cacheKey, areaM2);
      totalAreaM2 += areaM2;
      
      if (areaM2 > 0) {
        tilesFound++;
      } else {
        tilesNotFound++;
      }
    } catch (error) {
      // Ошибки кроме 404 логируем, но не прерываем вычисление
      console.warn(`Failed to process tile ${tile.x},${tile.y}:`, error);
      // В случае ошибки считаем площадь = 0 и кэшируем
      cache.set(cacheKey, 0);
      tilesNotFound++;
    }

    processed++;
    if (onProgress) onProgress(processed, totalTiles);
  });

  // Выполняем задачи с ограничением параллелизма
  await withLimit(concurrencyLimit, tasks);

  return {
    areaM2: totalAreaM2,
    areaKm2: totalAreaM2 / 1000000,
    tilesProcessed: processed,
    tilesFound,
    tilesNotFound,
  };
}

