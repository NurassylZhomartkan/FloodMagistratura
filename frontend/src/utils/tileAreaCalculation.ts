/**
 * Утилиты для расчета площади покрытия растровых тайлов на основе alpha > 0
 */

const TILE_SIZE = 256;

/**
 * Конвертирует координату Y тайла в радианы широты
 */
function tileYToLatRad(z: number, yFloat: number): number {
  const n = Math.PI - (2 * Math.PI * yFloat) / Math.pow(2, z);
  return Math.atan(Math.sinh(n));
}

/**
 * Вычисляет метры на пиксель для заданного zoom и широты
 */
function metersPerPixel(z: number, latRad: number): number {
  return (156543.03392 * Math.cos(latRad)) / Math.pow(2, z);
}

/**
 * Вычисляет площадь покрытия тайла (в м²) на основе пикселей с alpha > 0
 */
export async function computeTileCoveredAreaM2_Alpha(params: {
  url: string;
  z: number;
  y: number; // XYZ y
  sampleStep?: number;
}): Promise<number> {
  const { url, z, y, sampleStep = 2 } = params;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Tile load failed: ${url}`));
  });

  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D context");

  ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
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
 * Вычисляет общую площадь покрытия для всех тайлов в viewport
 */
export async function computeViewportCoveredArea(params: {
  bounds: { west: number; south: number; east: number; north: number };
  zInt: number;
  planName: string;
  time: string | null;
  getTileUrl: (planName: string, time: string | null, z: number, x: number, y: number) => string;
  cache?: Map<string, number>;
  concurrencyLimit?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ areaM2: number; areaKm2: number; tilesProcessed: number }> {
  const {
    bounds,
    zInt,
    planName,
    time,
    getTileUrl,
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

  // Обрабатываем тайлы с ограничением параллелизма
  const processTile = async (tile: { x: number; y: number }): Promise<void> => {
    const cacheKey = `${planName}|${time || "no-time"}|${zInt}|${tile.x}|${tile.y}`;
    
    // Проверяем кэш
    if (cache.has(cacheKey)) {
      totalAreaM2 += cache.get(cacheKey)!;
      processed++;
      if (onProgress) onProgress(processed, totalTiles);
      return;
    }

    try {
      const url = getTileUrl(planName, time, zInt, tile.x, tile.y);
      const areaM2 = await computeTileCoveredAreaM2_Alpha({
        url,
        z: zInt,
        y: tile.y,
        sampleStep: 2,
      });

      cache.set(cacheKey, areaM2);
      totalAreaM2 += areaM2;
    } catch (error) {
      console.warn(`Failed to process tile ${tile.x},${tile.y}:`, error);
      // В случае ошибки считаем площадь = 0
      cache.set(cacheKey, 0);
    }

    processed++;
    if (onProgress) onProgress(processed, totalTiles);
  };

  // Обрабатываем тайлы батчами с ограничением параллелизма
  for (let i = 0; i < tiles.length; i += concurrencyLimit) {
    const batch = tiles.slice(i, i + concurrencyLimit);
    await Promise.all(batch.map(processTile));
  }

  return {
    areaM2: totalAreaM2,
    areaKm2: totalAreaM2 / 1000000,
    tilesProcessed: processed,
  };
}

















