// frontend/src/utils/geotiffUtils.js
// Утилиты для работы с GeoTIFF файлами в браузере

import { fromArrayBuffer } from 'geotiff';

/**
 * Читает GeoTIFF файл и возвращает данные для отображения
 * @param {File|Blob|ArrayBuffer} file - GeoTIFF файл
 * @returns {Promise<Object>} Объект с данными GeoTIFF
 */
export async function readGeoTIFF(file) {
  try {
    let arrayBuffer;
    
    if (file instanceof ArrayBuffer) {
      arrayBuffer = file;
    } else if (file instanceof Blob || file instanceof File) {
      arrayBuffer = await file.arrayBuffer();
    } else {
      throw new Error('Неподдерживаемый тип файла');
    }

    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    
    // Получаем данные растра
    const rasters = await image.readRasters();
    const data = rasters[0]; // Первый канал
    
    // Получаем геопривязку
    const bbox = image.getBoundingBox();
    const pixelWidth = image.getWidth();
    const pixelHeight = image.getHeight();
    
    // Получаем проекцию и трансформацию
    const geoKeys = image.getGeoKeys();
    const fileDirectory = image.fileDirectory;
    
    return {
      data,
      bbox,
      width: pixelWidth,
      height: pixelHeight,
      geoKeys,
      fileDirectory,
      image
    };
  } catch (error) {
    console.error('Ошибка при чтении GeoTIFF:', error);
    throw error;
  }
}

/**
 * Преобразует данные GeoTIFF в изображение (canvas) для отображения на карте
 * @param {Object} geotiffData - Данные GeoTIFF из readGeoTIFF
 * @param {Object} options - Опции для визуализации
 * @returns {Promise<{canvas: HTMLCanvasElement, bounds: Object}>}
 */
export async function geotiffToCanvas(geotiffData, options = {}) {
  const {
    minValue = null,
    maxValue = null,
    colorScale = 'terrain', // 'terrain', 'grayscale', 'elevation'
    opacity = 1.0,
    floodThreshold = null, // Пороговое значение для закрашивания затопленных областей
    floodColor = [0, 100, 255, 200] // Цвет для затопленных областей [R, G, B, A]
  } = options;

  const { data, width, height, bbox } = geotiffData;
  
  // Создаем canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  // Находим min и max значения, если не указаны
  let dataMin = minValue;
  let dataMax = maxValue;
  
  if (dataMin === null || dataMax === null) {
    // Обрабатываем TypedArray или обычный массив
    let validData;
    if (data instanceof Array) {
      validData = data.filter(v => !isNaN(v) && isFinite(v));
    } else {
      // Для TypedArray используем более эффективный способ
      validData = [];
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (!isNaN(v) && isFinite(v)) {
          validData.push(v);
        }
      }
    }
    
    if (validData.length > 0) {
      // Для больших массивов используем более эффективный способ поиска min/max
      if (validData.length > 10000) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < validData.length; i++) {
          const v = validData[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        dataMin = dataMin !== null ? dataMin : min;
        dataMax = dataMax !== null ? dataMax : max;
      } else {
        dataMin = dataMin !== null ? dataMin : Math.min(...validData);
        dataMax = dataMax !== null ? dataMax : Math.max(...validData);
      }
    } else {
      dataMin = 0;
      dataMax = 1;
    }
  }
  
  const range = dataMax - dataMin || 1;
  
  // Преобразуем данные в цвета
  // Обрабатываем TypedArray или обычный массив
  const dataLength = data.length;
  for (let i = 0; i < dataLength; i++) {
    const value = data[i];
    const pixelIndex = i * 4;
    
    if (isNaN(value) || !isFinite(value)) {
      // Прозрачный пиксель для NaN/Inf
      imageData.data[pixelIndex] = 0;     // R
      imageData.data[pixelIndex + 1] = 0; // G
      imageData.data[pixelIndex + 2] = 0; // B
      imageData.data[pixelIndex + 3] = 0; // A (прозрачный)
    } else if (floodThreshold !== null && floodThreshold !== undefined) {
      // Режим симуляции наводнения: закрашиваем только области ниже порога
      // Вычисляем относительную высоту от минимальной точки рельефа (не от уровня моря)
      const relativeHeight = value - dataMin;
      
      // Сравниваем относительную высоту с порогом
      if (relativeHeight < floodThreshold) {
        // Закрашиваем затопленную область
        imageData.data[pixelIndex] = floodColor[0];     // R
        imageData.data[pixelIndex + 1] = floodColor[1]; // G
        imageData.data[pixelIndex + 2] = floodColor[2]; // B
        imageData.data[pixelIndex + 3] = Math.floor(floodColor[3] * opacity); // A
      } else {
        // Области выше порога - прозрачные
        imageData.data[pixelIndex] = 0;     // R
        imageData.data[pixelIndex + 1] = 0; // G
        imageData.data[pixelIndex + 2] = 0; // B
        imageData.data[pixelIndex + 3] = 0; // A (прозрачный)
      }
    } else {
      // Нормализуем значение от 0 до 1
      const normalized = (value - dataMin) / range;
      
      let r, g, b;
      
      if (colorScale === 'terrain') {
        // Терреновая цветовая схема (зеленый -> коричневый -> белый)
        if (normalized < 0.25) {
          // Низкие высоты - зеленый
          r = 34;
          g = 139;
          b = 34;
        } else if (normalized < 0.5) {
          // Средние высоты - коричневый
          const t = (normalized - 0.25) / 0.25;
          r = 34 + (139 - 34) * t;
          g = 139 + (69 - 139) * t;
          b = 34 + (19 - 34) * t;
        } else if (normalized < 0.75) {
          // Высокие высоты - серый
          const t = (normalized - 0.5) / 0.25;
          r = 139 + (128 - 139) * t;
          g = 69 + (128 - 69) * t;
          b = 19 + (128 - 19) * t;
        } else {
          // Очень высокие - белый
          const t = (normalized - 0.75) / 0.25;
          r = 128 + (255 - 128) * t;
          g = 128 + (255 - 128) * t;
          b = 128 + (255 - 128) * t;
        }
      } else if (colorScale === 'elevation') {
        // Цветовая схема высот (синий -> зеленый -> коричневый -> белый)
        if (normalized < 0.2) {
          // Вода - синий
          r = 0;
          g = 0;
          b = 255;
        } else if (normalized < 0.4) {
          // Низменности - зеленый
          const t = (normalized - 0.2) / 0.2;
          r = 0 + (34 - 0) * t;
          g = 255 + (139 - 255) * t;
          b = 255 + (34 - 255) * t;
        } else if (normalized < 0.6) {
          // Холмы - коричневый
          const t = (normalized - 0.4) / 0.2;
          r = 34 + (139 - 34) * t;
          g = 139 + (69 - 139) * t;
          b = 34 + (19 - 34) * t;
        } else if (normalized < 0.8) {
          // Горы - серый
          const t = (normalized - 0.6) / 0.2;
          r = 139 + (128 - 139) * t;
          g = 69 + (128 - 69) * t;
          b = 19 + (128 - 19) * t;
        } else {
          // Высокие горы - белый
          const t = (normalized - 0.8) / 0.2;
          r = 128 + (255 - 128) * t;
          g = 128 + (255 - 128) * t;
          b = 128 + (255 - 128) * t;
        }
      } else {
        // Grayscale
        const gray = Math.floor(normalized * 255);
        r = gray;
        g = gray;
        b = gray;
      }
      
      imageData.data[pixelIndex] = r;
      imageData.data[pixelIndex + 1] = g;
      imageData.data[pixelIndex + 2] = b;
      imageData.data[pixelIndex + 3] = Math.floor(255 * opacity);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Преобразуем bbox в формат для Mapbox
  const bounds = {
    west: bbox[0],
    south: bbox[1],
    east: bbox[2],
    north: bbox[3]
  };
  
  return {
    canvas,
    bounds,
    minValue: dataMin,
    maxValue: dataMax
  };
}

/**
 * Добавляет GeoTIFF слой на карту Mapbox
 * @param {Object} map - Экземпляр карты Mapbox
 * @param {HTMLCanvasElement} canvas - Canvas с изображением GeoTIFF
 * @param {Object} bounds - Границы GeoTIFF {west, south, east, north}
 * @param {string} layerId - ID слоя
 * @param {Object} options - Дополнительные опции
 */
export function addGeoTIFFLayerToMap(map, canvas, bounds, layerId, options = {}) {
  const {
    opacity = 1.0,
    beforeId = null
  } = options;
  
  // Преобразуем canvas в data URL
  const dataUrl = canvas.toDataURL('image/png');
  
  // Создаем источник изображения
  const sourceId = `${layerId}-source`;
  
  // Удаляем старый источник, если существует
  if (map.getSource(sourceId)) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    map.removeSource(sourceId);
  }
  
  // Добавляем источник изображения
  map.addSource(sourceId, {
    type: 'image',
    url: dataUrl,
    coordinates: [
      [bounds.west, bounds.north], // top-left
      [bounds.east, bounds.north], // top-right
      [bounds.east, bounds.south], // bottom-right
      [bounds.west, bounds.south]  // bottom-left
    ]
  });
  
  // Добавляем слой
  const layerConfig = {
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': opacity
    }
  };
  
  if (beforeId) {
    map.addLayer(layerConfig, beforeId);
  } else {
    map.addLayer(layerConfig);
  }
  
  return { sourceId, layerId };
}

/**
 * Загружает и отображает GeoTIFF файл на карте
 * @param {Object} map - Экземпляр карты Mapbox
 * @param {File|Blob|ArrayBuffer} file - GeoTIFF файл
 * @param {string} layerId - ID слоя
 * @param {Object} options - Опции для визуализации
 * @returns {Promise<{layerId: string, sourceId: string, bounds: Object}>}
 */
export async function loadAndDisplayGeoTIFF(map, file, layerId, options = {}) {
  try {
    // Читаем GeoTIFF
    const geotiffData = await readGeoTIFF(file);
    
    // Преобразуем в canvas
    const { canvas, bounds } = await geotiffToCanvas(geotiffData, options);
    
    // Добавляем на карту
    const { sourceId } = addGeoTIFFLayerToMap(map, canvas, bounds, layerId, {
      opacity: options.opacity || 1.0,
      beforeId: options.beforeId
    });
    
    // Вычисляем min и max значения для больших массивов
    let minValue = null;
    let maxValue = null;
    if (geotiffData.data) {
      const data = geotiffData.data;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (!isNaN(v) && isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      if (min !== Infinity && max !== -Infinity) {
        minValue = min;
        maxValue = max;
      }
    }
    
    return {
      layerId,
      sourceId,
      bounds,
      minValue,
      maxValue
    };
  } catch (error) {
    console.error('Ошибка при загрузке и отображении GeoTIFF:', error);
    throw error;
  }
}

