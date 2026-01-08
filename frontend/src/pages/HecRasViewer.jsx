// frontend/src/components/page/HecRasViewer.jsx
// -------------------------------------------------
// Упрощённая версия без блоков «water‑depth» и «area info»
// -------------------------------------------------

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useParams } from 'react-router-dom';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import '../styles/components/HecRasViewer.css';
import { usePageTitle } from '../utils/usePageTitle';
import MapComponent from '../components/map/Map';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Slider,
  Paper,
  Stack,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import MyLocationIcon from '@mui/icons-material/MyLocation';

// Регистрируем компоненты Chart.js
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend);

// Токен Mapbox устанавливается в компоненте Map

export default function HecRasViewer({ projectHash: propProjectHash, shareHash: propShareHash }) {
  const { projectHash: paramProjectHash } = useParams();
  const projectHash = propProjectHash || paramProjectHash;
  const shareHash = propShareHash;
  const { t } = useTranslation();
  usePageTitle('pageTitles.hecRasViewer');

  /* ---------- refs ---------- */
  const mapComponentRef     = useRef(null);
  const legendRef           = useRef(null);
  const playIntervalRef     = useRef(null);
  const timePlayIntervalRef = useRef(null);
  const mapRef              = useRef(null);
  const layersRef           = useRef([]);
  const curIndexRef         = useRef(0);
  const mouseHandlersAddedRef = useRef(false);
  const initialPositionSetRef = useRef(false); // Флаг для отслеживания установки начальной позиции

  /* ---------- state ---------- */
  const [layers]     = useState([]);   // {id, title, table}
  const [metadata, setMetadata] = useState(null);
  const [curIndex, setCurIndex] = useState(0);
  const [opacity]   = useState(1);
  const [mapMetadata, setMapMetadata] = useState(null); // Метаданные из /map/metadata
  const [times, setTimes] = useState([]); // Список времен (если есть)
  const [currentTime, setCurrentTime] = useState(null); // Текущее выбранное время
  const [selectedMapStyleName, setSelectedMapStyleName] = useState(''); // Название выбранного стиля
  const [mapStyleMenuOpen, setMapStyleMenuOpen] = useState(false); // Открыто ли меню выбора стиля
  const [userMapStyle, setUserMapStyle] = useState('streets-v12'); // Стиль карты пользователя
  const [userMapProjection, setUserMapProjection] = useState('mercator'); // Проекция карты пользователя
  const [legendPrefix, setLegendPrefix] = useState(null); // Префикс для легенды (например, "Plan01", "Maleevsk")
  const [showFloodAreaModal, setShowFloodAreaModal] = useState(false); // Показывать ли модальное окно с графиком
  const [floodAreaData, setFloodAreaData] = useState(null); // Данные для графика затопления
  const [currentFloodArea, setCurrentFloodArea] = useState(null); // Текущая площадь затопления на экране (deprecated)
  const [mapBounds, setMapBounds] = useState(null); // Текущие границы карты для отслеживания изменений
  const [mapZoom, setMapZoom] = useState(null); // Текущий zoom для отслеживания изменений
  const [lastCalculatedTime, setLastCalculatedTime] = useState(null); // Последнее время, для которого была рассчитана площадь
  const [zInt, setZInt] = useState(null); // Целочисленный zoom для расчета тайлов
  const [projectData, setProjectData] = useState(null); // Данные проекта
  const [loadingFloodArea, setLoadingFloodArea] = useState(false); // Загрузка площади затопления
  const [waterDepth, setWaterDepth] = useState(null); // Глубина воды под курсором
  const [loadedTilesCount, setLoadedTilesCount] = useState(0); // Количество загруженных тайлов
  const [centerz, setCenterz] = useState(null); // Центральный zoom из метаданных
  const floodAreaCalculationTimeoutRef = useRef(null); // Для debounce пересчета площади

  /* ---------- helpers ---------- */
  const showLayer = useCallback(
    idx => {
      const m = mapRef.current;
      if (!m || !layers[idx]) return;

      layers.forEach((l, i) => {
        if (m.getLayer(l.id)) {
          m.setLayoutProperty(l.id, 'visibility', i === idx ? 'visible' : 'none');
        }
      });
    },
    [layers]
  );

  // Функция для обновления счетчика загруженных тайлов
  const updateLoadedTilesCount = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    
    try {
      const sourceId = 'db-tiles';
      const source = m.getSource(sourceId);
      if (source && source._tiles) {
        // Считаем загруженные тайлы (состояние 'loaded')
        const loadedTiles = Object.values(source._tiles).filter(
          tile => tile.state === 'loaded'
        ).length;
        setLoadedTilesCount(loadedTiles);
      } else {
        setLoadedTilesCount(0);
      }
    } catch (err) {
      // Если доступ к _tiles невозможен, игнорируем
      console.debug('Could not access tile state:', err);
      setLoadedTilesCount(0);
    }
  }, []);

  /* ---------- terrain & sky ---------- */
  function addTerrain(m) {
    if (m.getSource('mapbox-dem')) return;
    
    try {
      m.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14,
      });
      
      // Пробуем добавить terrain, но не критично если не получится
      // (может не работать в приватном режиме из-за ограничений Canvas2D)
      try {
        m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      } catch {
        // Terrain может быть недоступен в приватном режиме - это нормально
        console.debug('Terrain недоступен (возможно из-за приватного режима)');
      }
      
      // Добавляем sky слой
      try {
        m.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0, 0],
            'sky-atmosphere-sun-intensity': 15,
          },
        });
      } catch {
        // Sky слой может быть недоступен - это не критично
        console.debug('Sky слой недоступен');
      }
    } catch (error) {
      // Продолжаем работу без terrain - это не критично для основной функциональности
      console.debug('Не удалось добавить terrain/sky слои:', error.message);
    }
  }

  /* ---------- layers ---------- */
  const setupLayers = useCallback((m, datasetId, mapMeta, timeValue = null) => {
    // console.log('Setting up layers with new API:', { datasetId, mapMeta, timeValue });
    
    // Формируем URL для тайлов
    // Если есть shareHash, используем публичный endpoint
    let tileUrl;
    if (shareHash) {
      tileUrl = `/api/map/tiles/shared/${shareHash}/{z}/{x}/{y}.png?v=2`;
    } else {
      tileUrl = `/api/map/tiles/${datasetId}/{z}/{x}/{y}.png?v=2`;
    }
    if (timeValue) {
      tileUrl += `&time=${encodeURIComponent(timeValue)}`;
    }
    
    const sourceId = 'db-tiles';
    const layerId = 'db-tiles-layer';
    
    // Удаляем старый source и layer если они существуют
    if (m.getLayer(layerId)) {
      m.removeLayer(layerId);
    }
    if (m.getSource(sourceId)) {
      m.removeSource(sourceId);
    }
    
    // Добавляем новый source
    const sourceConfig = {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    };
    
    // Добавляем bounds, minzoom, maxzoom если они есть
    if (mapMeta?.bounds) {
      sourceConfig.bounds = mapMeta.bounds;
    }
    if (mapMeta?.minzoom !== undefined) {
      sourceConfig.minzoom = mapMeta.minzoom;
    }
    if (mapMeta?.maxzoom !== undefined) {
      sourceConfig.maxzoom = mapMeta.maxzoom;
    }
    
    // Функция для добавления source и layer
    const addSourceAndLayer = () => {
      try {
        m.addSource(sourceId, sourceConfig);
        // console.log(`Added source ${sourceId} with config:`, sourceConfig);
        
        // Обработка загрузки тайлов и обновление счетчика
        const handleSourceData = (e) => {
          if (e.sourceId === sourceId) {
            if (e.isSourceLoaded === false && e.tile) {
              // Если тайл не загрузился (404), это нормально
            }
            // Обновляем счетчик загруженных тайлов
            setTimeout(updateLoadedTilesCount, 100); // Небольшая задержка для обновления состояния
          }
        };
        
        m.on('sourcedata', handleSourceData);
        
        // Также обновляем при изменении карты (zoom, pan)
        const handleMapMove = () => {
          setTimeout(updateLoadedTilesCount, 200);
        };
        m.on('moveend', handleMapMove);
        m.on('zoomend', handleMapMove);
        
        // Обновляем счетчик сразу после добавления source
        setTimeout(updateLoadedTilesCount, 500);
        
        // Добавляем layer
        m.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 'raster-opacity': opacity },
        });
        
        // console.log(`Added layer ${layerId}`);
      } catch (err) {
        console.error('Error adding source/layer:', err);
      }
    };
    
    // Проверяем, что стиль карты загружен перед добавлением source
    if (!m.isStyleLoaded()) {
      // Ждем загрузки стиля
      m.once('style.load', () => {
        addSourceAndLayer();
      });
    } else {
      addSourceAndLayer();
    }
    
    // Фокус карты на bounds или center только при первой загрузке
    // Это позволяет пользователю свободно перемещать карту после начальной установки
    if (!initialPositionSetRef.current) {
      if (mapMeta?.bounds) {
        m.fitBounds(mapMeta.bounds, { padding: 30 });
        initialPositionSetRef.current = true;
      } else if (mapMeta?.center) {
        m.setCenter(mapMeta.center);
        if (mapMeta?.maxzoom) {
          m.setZoom(mapMeta.maxzoom - 1);
        }
        initialPositionSetRef.current = true;
      }
    }
  }, [opacity, shareHash]);

  /* ---------- helpers for legend prefix ---------- */
  // Функция для извлечения префикса из имени файла или metadata
  const extractPrefixFromFilename = (filename, meta = null) => {
    if (!filename) {
      // Если нет имени файла, пробуем найти префикс в metadata
      if (meta) {
        const legendKeys = Object.keys(meta).filter(k => k.endsWith('_legend_values'));
        if (legendKeys.length > 0) {
          const firstKey = legendKeys[0];
          const prefix = firstKey.replace('_legend_values', '');
          // console.log('Found prefix from metadata keys (no filename):', prefix);
          return prefix;
        }
      }
      return null;
    }
    
    // Убираем расширение .db
    const nameWithoutExt = filename.replace(/\.db$/i, '').trim();
    
    // Сначала проверяем, есть ли в metadata ключи с префиксами
    // Это самый надежный способ определить префикс
    if (meta) {
      const legendKeys = Object.keys(meta).filter(k => k.endsWith('_legend_values'));
      if (legendKeys.length > 0) {
        // Берем первый найденный префикс
        const firstKey = legendKeys[0];
        const prefix = firstKey.replace('_legend_values', '');
        // console.log('Found prefix from metadata keys:', prefix);
        return prefix;
      }
    }
    
    // Если не нашли в metadata, пробуем извлечь из имени файла
    // Ищем паттерны типа "Plan01", "Maleevsk", "P01" и т.д.
    const patterns = [
      /^([A-Za-z]+[0-9]+)/,  // Plan01, P01, Maleevsk01
      /^([A-Za-z]+)/,        // Maleevsk, Plan
      /([A-Za-z]+[0-9]+)/,   // Project_Plan01
    ];
    
    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match && match[1]) {
        const extracted = match[1];
        // console.log('Extracted prefix from filename:', extracted);
        return extracted;
      }
    }
    
    // Если ничего не нашли, возвращаем имя файла без расширения
    // console.log('Using filename as prefix:', nameWithoutExt);
    return nameWithoutExt;
  };

  /* ---------- legend ---------- */
  function showLegend(meta, prefix = null) {
    if (!meta || !legendRef.current) {
      console.warn('showLegend: meta or legendRef is null', { meta, legendRef: legendRef.current });
      return false;
    }
    
    // console.log('showLegend called with metadata keys:', Object.keys(meta));
    
    // Определяем префикс
    let base = prefix;
    if (!base) {
      // Пробуем найти префикс из ключей metadata
      const key = Object.keys(meta).find(k => k.endsWith('_legend_values'));
      if (key) {
        base = key.replace('_legend_values', '');
        // console.log('Found prefix from metadata key:', base);
      } else {
        // console.log('No _legend_values key found. Available keys:', Object.keys(meta));
        // Пробуем найти любой ключ с "legend" в названии
        // const legendKeys = Object.keys(meta).filter(k => k.toLowerCase().includes('legend'));
        // console.log('Keys containing "legend":', legendKeys);
        return false;
      }
    }
    
    // console.log('Using prefix for legend:', base);
    
    const valsStr = meta[`${base}_legend_values`];
    const colsStr = meta[`${base}_legend_rgba`];
    
    // console.log('Raw legend values string:', valsStr);
    // console.log('Raw legend colors string:', colsStr?.substring(0, 100));
    
    if (!valsStr || !colsStr) {
      // console.log('Legend values or colors missing', { valsStr, colsStr });
      return false;
    }
    
    // Парсим значения из строки (поддерживаем форматы: "0 - 5", "> 5", "5", и т.д.)
    const parseLegendValues = (valuesStr) => {
      const parts = valuesStr.split(',').map(v => v.trim()).filter(v => v);
      const ranges = [];
      
      for (const part of parts) {
        // Обрабатываем формат "> 5" или ">5"
        if (part.startsWith('>')) {
          const numStr = part.replace(/^>\s*/, '').trim();
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            ranges.push({
              min: num,
              max: Infinity,
              label: `> ${num}`
            });
          }
        }
        // Обрабатываем формат "0 - 5" или "0-5"
        else if (part.includes('-') || part.includes('–')) {
          const separator = part.includes('–') ? '–' : '-';
          const parts = part.split(separator).map(s => s.trim());
          if (parts.length === 2) {
            const minStr = parts[0];
            const maxStr = parts[1];
            const min = parseFloat(minStr);
            const max = parseFloat(maxStr);
            if (!isNaN(min) && !isNaN(max)) {
              ranges.push({
                min: min,
                max: max,
                label: `${min} - ${max}`
              });
            } else if (!isNaN(min)) {
              // Только одно число, считаем его верхней границей
              ranges.push({
                min: 0,
                max: min,
                label: `0 - ${min}`
              });
            }
          }
        }
        // Обрабатываем просто число
        else {
          const num = parseFloat(part);
          if (!isNaN(num)) {
            // Если это первое значение, создаем диапазон от 0
            if (ranges.length === 0) {
              ranges.push({
                min: 0,
                max: num,
                label: `0 - ${num}`
              });
            } else {
              // Используем предыдущее значение как минимум
              const prevMax = ranges[ranges.length - 1].max;
              ranges.push({
                min: prevMax,
                max: num,
                label: `${prevMax} - ${num}`
              });
            }
          }
        }
      }
      
      return ranges;
    };
    
    // Парсим значения и создаем диапазоны на основе реальных данных из базы
    const legendRanges = parseLegendValues(valsStr);
    // console.log('Parsed legend ranges from database:', legendRanges);
    
    // Парсим цвета RGBA
    const cols = colsStr.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
    // console.log('Parsed colors (RGBA):', cols, 'Color count:', cols.length / 4);
    
    // Проверяем, что количество цветов соответствует количеству диапазонов
    const colorCount = cols.length / 4; // Каждый цвет = 4 числа (RGBA)
    if (legendRanges.length !== colorCount) {
      console.warn(`Mismatch: ${legendRanges.length} ranges but ${colorCount} colors. Using available colors.`);
    }
    
    if (legendRanges.length === 0) {
      console.warn('No valid legend ranges found');
      return false;
    }
    
    if (cols.length < legendRanges.length * 4) {
      console.warn(`Not enough color values: need ${legendRanges.length * 4}, got ${cols.length}`);
      return false;
    }
    
    // Создаем HTML для легенды на основе реальных данных из базы
    const legendHTML = `
      <ul style="list-style: none; margin: 0; padding: 0;">
        ${legendRanges
          .map((range, index) => {
            // Получаем цвет для этого диапазона
            const r = cols[index * 4];
            const g = cols[index * 4 + 1];
            const b = cols[index * 4 + 2];
            const a = cols[index * 4 + 3] !== undefined ? cols[index * 4 + 3] / 255 : 1;
            const rgba = `rgba(${r}, ${g}, ${b}, ${a})`;
            
            return `<li style="display:flex;align-items:center;margin-bottom:6px">
                      <div style="width:24px;height:24px;background:${rgba};margin-right:10px;border:1px solid #ccc;border-radius:3px;flex-shrink:0"></div>
                      <span style="font-size:13px;color:#333">${range.label} ${t('hecRasViewer.unit').trim()}</span>
                    </li>`;
          })
          .join('')}
      </ul>
    `;
    
    legendRef.current.innerHTML = legendHTML;
    legendRef.current.style.display = 'block';
    // console.log('Legend rendered successfully using metadata values and colors');
    return true;
  }

  function showLegendFromStructured(legend) {
    if (!legend || !legendRef.current) {
      console.warn('showLegendFromStructured: legend or legendRef is null', { legend, legendRef: legendRef.current });
      return false;
    }
    if (!legend.values || !legend.rgba) {
      console.warn('showLegendFromStructured: missing values or rgba', legend);
      return false;
    }
    
    // console.log('showLegendFromStructured called with:', legend);
    // console.log('Raw legend values string:', legend.values);
    // console.log('Raw legend colors string:', legend.rgba?.substring(0, 100));
    
    // Используем ту же функцию парсинга, что и в showLegend
    const parseLegendValues = (valuesStr) => {
      const parts = valuesStr.split(',').map(v => v.trim()).filter(v => v);
      const ranges = [];
      
      for (const part of parts) {
        // Обрабатываем формат "> 5" или ">5"
        if (part.startsWith('>')) {
          const numStr = part.replace(/^>\s*/, '').trim();
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            ranges.push({
              min: num,
              max: Infinity,
              label: `> ${num}`
            });
          }
        }
        // Обрабатываем формат "0 - 5" или "0-5"
        else if (part.includes('-') || part.includes('–')) {
          const separator = part.includes('–') ? '–' : '-';
          const parts = part.split(separator).map(s => s.trim());
          if (parts.length === 2) {
            const minStr = parts[0];
            const maxStr = parts[1];
            const min = parseFloat(minStr);
            const max = parseFloat(maxStr);
            if (!isNaN(min) && !isNaN(max)) {
              ranges.push({
                min: min,
                max: max,
                label: `${min} - ${max}`
              });
            } else if (!isNaN(min)) {
              // Только одно число, считаем его верхней границей
              ranges.push({
                min: 0,
                max: min,
                label: `0 - ${min}`
              });
            }
          }
        }
        // Обрабатываем просто число
        else {
          const num = parseFloat(part);
          if (!isNaN(num)) {
            // Если это первое значение, создаем диапазон от 0
            if (ranges.length === 0) {
              ranges.push({
                min: 0,
                max: num,
                label: `0 - ${num}`
              });
            } else {
              // Используем предыдущее значение как минимум
              const prevMax = ranges[ranges.length - 1].max;
              ranges.push({
                min: prevMax,
                max: num,
                label: `${prevMax} - ${num}`
              });
            }
          }
        }
      }
      
      return ranges;
    };
    
    // Парсим значения и создаем диапазоны на основе реальных данных
    const legendRanges = parseLegendValues(legend.values);
    // console.log('Parsed legend ranges from structured data:', legendRanges);
    
    // Парсим цвета RGBA
    const cols = legend.rgba.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
    // console.log('Parsed colors (RGBA):', cols, 'Color count:', cols.length / 4);
    
    // Проверяем, что количество цветов соответствует количеству диапазонов
    const colorCount = cols.length / 4; // Каждый цвет = 4 числа (RGBA)
    if (legendRanges.length !== colorCount) {
      console.warn(`Mismatch: ${legendRanges.length} ranges but ${colorCount} colors. Using available colors.`);
    }
    
    if (legendRanges.length === 0) {
      console.warn('No valid legend ranges found');
      return false;
    }
    
    if (cols.length < legendRanges.length * 4) {
      console.warn(`Not enough color values: need ${legendRanges.length * 4}, got ${cols.length}`);
      return false;
    }
    
    // Создаем HTML для легенды на основе реальных данных
    const legendHTML = `
      <ul style="list-style: none; margin: 0; padding: 0;">
        ${legendRanges
          .map((range, index) => {
            // Получаем цвет для этого диапазона
            const r = cols[index * 4];
            const g = cols[index * 4 + 1];
            const b = cols[index * 4 + 2];
            const a = cols[index * 4 + 3] !== undefined ? cols[index * 4 + 3] / 255 : 1;
            const rgba = `rgba(${r}, ${g}, ${b}, ${a})`;
            
            return `<li style="display:flex;align-items:center;margin-bottom:6px">
                      <div style="width:24px;height:24px;background:${rgba};margin-right:10px;border:1px solid #ccc;border-radius:3px;flex-shrink:0"></div>
                      <span style="font-size:13px;color:#333">${range.label} ${t('hecRasViewer.unit').trim()}</span>
                    </li>`;
          })
          .join('')}
      </ul>
    `;
    
    legendRef.current.innerHTML = legendHTML;
    legendRef.current.style.display = 'block';
    // console.log('Legend rendered successfully from structured data using metadata values and colors');
    return true;
  }

  /* ---------- render legend from API ---------- */
  function renderLegendFromAPI(legendData, unitText = ' м') {
    // console.log('renderLegendFromAPI called with:', legendData);
    // console.log('legendRef.current:', legendRef.current);
    
    if (!legendData) {
      console.warn('renderLegendFromAPI: legendData is null or undefined');
      if (legendRef.current) {
        legendRef.current.style.display = 'none';
      }
      return false;
    }
    
    if (!legendRef.current) {
      console.warn('renderLegendFromAPI: legendRef.current is null');
      return false;
    }
    
    if (legendData.mode === 'empty' || !legendData.legends || legendData.legends.length === 0) {
      // console.log('No legends to render, mode:', legendData.mode, 'legends:', legendData.legends);
      // Скрываем легенду если нет данных
      legendRef.current.style.display = 'none';
      return false;
    }
    
    // Показываем легенду (контейнер)
    legendRef.current.style.display = 'block';
    
    // Используем первую легенду (можно расширить для поддержки нескольких)
    const legend = legendData.legends[0];
    console.log('Using legend:', legend);
    
    const title = legend.title || legend.key_prefix || 'Legend';
    const classes = legend.classes || [];
    
    console.log('Legend classes:', classes);
    
    if (classes.length === 0) {
      console.warn('Legend has no classes');
      legendRef.current.style.display = 'none';
      return false;
    }
    
    // Рендерим легенду
    const legendHTML = `
      <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #333;">${title}</div>
      <ul style="list-style: none; margin: 0; padding: 0;">
        ${classes.map(cls => `
          <li style="display: flex; align-items: center; margin-bottom: 6px;">
            <div style="width: 24px; height: 24px; background: ${cls.hex}; margin-right: 10px; border: 1px solid #ccc; border-radius: 3px; flex-shrink: 0;"></div>
            <span style="font-size: 13px; color: #333;">${cls.label} ${unitText}</span>
          </li>
        `).join('')}
      </ul>
    `;
    
    console.log('Setting legend HTML, length:', legendHTML.length);
    
    // Устанавливаем HTML в контейнер
    legendRef.current.innerHTML = legendHTML;
    
    // Убеждаемся, что контейнер видим
    legendRef.current.style.display = 'block';
    
    // console.log('Legend rendered successfully from API, classes count:', classes.length);
    return true;
  }

  /* ---------- получение centerz из метаданных плана ---------- */
  const fetchPlanCenterz = useCallback(async (planName, projectId) => {
    // Если planName не указан, не делаем запрос
    if (!planName || !projectId) {
      return null;
    }
    
    try {
      const token = localStorage.getItem('token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch(`/api/hec-ras/${projectId}/plans/${planName}/view`, {
        headers: authHeader,
      });
      
      if (res.ok) {
        const data = await res.json();
        const centerzValue = data.centerz;
        const zIntValue = Math.round(centerzValue);
        
        setCenterz(centerzValue);
        setZInt(zIntValue);
        
        // Устанавливаем zoom карты
        const m = mapRef.current;
        if (m && m.isStyleLoaded() && m.loaded()) {
          m.flyTo({ zoom: centerzValue, essential: true });
        }
        
        return { centerz: centerzValue, zInt: zIntValue };
      } else {
        // 404 - это нормально, если ключ не найден в метаданных
        if (res.status === 404) {
          console.debug(`Centerz not found for plan ${planName} (this is OK if metadata key doesn't exist)`);
        } else {
          console.warn(`Failed to fetch centerz for plan ${planName}:`, res.status);
        }
        return null;
      }
    } catch (error) {
      // Игнорируем ошибки сети - это не критично
      console.debug('Could not fetch plan centerz (non-critical):', error.message);
      return null;
    }
  }, []);

  /* ---------- расчет площади затопления (новая версия на основе alpha > 0) ---------- */
  const calculateFloodArea = useCallback(async (showModal = false) => {
    const m = mapRef.current;
    if (!m || !projectHash) return;
    
    // Проверяем, что карта полностью загружена
    if (!m.isStyleLoaded() || !m.loaded()) {
      console.log('Map not ready yet, skipping flood area calculation');
      return;
    }
    
    setLoadingFloodArea(true);
    try {
      // Получаем видимые границы карты
      const bounds = m.getBounds();
      const west = bounds.getWest();
      const south = bounds.getSouth();
      const east = bounds.getEast();
      const north = bounds.getNorth();
      const zoom = Math.floor(m.getZoom());
      
      // Проверяем, действительно ли изменились границы, zoom или время
      // Это предотвращает бесконечные циклы обновлений, но позволяет пересчитывать при изменении времени
      const boundsChanged = !mapBounds || 
        Math.abs(mapBounds.west - west) > 0.0001 ||
        Math.abs(mapBounds.south - south) > 0.0001 ||
        Math.abs(mapBounds.east - east) > 0.0001 ||
        Math.abs(mapBounds.north - north) > 0.0001;
      const zoomChanged = mapZoom !== zoom;
      const timeChanged = lastCalculatedTime !== currentTime;
      
      // Если изменилось время, всегда пересчитываем площадь
      // Если изменились границы или zoom, тоже пересчитываем
      // Пропускаем только если ничего не изменилось
      if (!boundsChanged && !zoomChanged && !timeChanged && lastCalculatedTime !== null) {
        console.log('No changes detected, skipping flood area calculation');
        setLoadingFloodArea(false);
        return;
      }
      
      // Обновляем state только если действительно изменилось
      if (boundsChanged || zoomChanged) {
        setMapBounds({ west, south, east, north });
        setMapZoom(zoom);
      }
      if (timeChanged) {
        setLastCalculatedTime(currentTime);
      }
      
      const token = localStorage.getItem('token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Формируем параметры запроса
      const boundsStr = `${west},${south},${east},${north}`;
      
      // Убеждаемся, что projectHash - это число
      const projectId = typeof projectHash === 'string' ? parseInt(projectHash, 10) : projectHash;
      
      // Если нужно показать модальное окно, загружаем временной ряд
      if (showModal) {
        // Если есть временные данные, загружаем серию для графика
        if (times.length > 0) {
          const timeSeriesRes = await fetch(
            `/api/map/flood-area-time-series/${projectId}?bounds=${encodeURIComponent(boundsStr)}&zoom=${zoom}`,
            { headers: authHeader }
          );
          
          if (timeSeriesRes.ok) {
            const timeSeriesData = await timeSeriesRes.json();
            setFloodAreaData(timeSeriesData);
          } else {
            const errorText = await timeSeriesRes.text();
            console.error('Failed to load flood area time series:', timeSeriesRes.status, errorText);
            setFloodAreaData(null);
          }
        } else {
          setFloodAreaData(null);
        }
        
        // Открываем модальное окно
        setShowFloodAreaModal(true);
      }
    } catch (error) {
      console.error('Error calculating flood area:', error);
      setCurrentFloodArea(null);
      if (showModal) {
        setFloodAreaData(null);
      }
    } finally {
      setLoadingFloodArea(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectHash, currentTime, times]);

  /* ---------- fetch project ---------- */
  const loadProject = useCallback(async (m) => {
    if (!projectHash) return;
    const token = localStorage.getItem('token');
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    
    try {
      // Загружаем данные проекта из /api/hec-ras/{id} для получения metadata и original_filename
      let projectMeta = null;
      let detectedPrefix = null;
      try {
        const projectRes = await fetch(`/api/hec-ras/${projectHash}`, {
          headers: authHeader,
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          // console.log('Loaded project data:', projectData);
          setProjectData(projectData);
          
          // Сохраняем metadata проекта
          if (projectData.metadata) {
            projectMeta = projectData.metadata;
            setMetadata(projectMeta);
            // console.log('Project metadata keys:', Object.keys(projectMeta));
          }
          
          // Определяем префикс из original_filename или name
          // Передаем metadata для более точного определения префикса
          const filename = projectData.original_filename || projectData.name || '';
          detectedPrefix = extractPrefixFromFilename(filename, projectMeta);
          if (detectedPrefix) {
            setLegendPrefix(detectedPrefix);
            // console.log('Detected legend prefix:', detectedPrefix);
            
            // Получаем centerz для этого плана только если ключ существует в метаданных
            const projectId = typeof projectHash === 'string' ? parseInt(projectHash, 10) : projectHash;
            // Проверяем наличие ключа centerz в метаданных перед запросом
            if (projectMeta && `${detectedPrefix}_centerz` in projectMeta) {
              fetchPlanCenterz(detectedPrefix, projectId);
            } else {
              // Пробуем найти реальное имя плана из метаданных
              const planNameKey = `${detectedPrefix}_plan_name`;
              if (projectMeta && planNameKey in projectMeta) {
                const realPlanName = projectMeta[planNameKey];
                // Проверяем наличие centerz для реального имени плана
                if (`${realPlanName}_centerz` in projectMeta) {
                  fetchPlanCenterz(realPlanName, projectId);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load project data:', err);
      }
      
      // Загружаем метаданные из нового API
      const metadataUrl = shareHash 
        ? `/api/map/metadata/shared/${shareHash}`
        : `/api/map/metadata/${projectHash}`;
      const metaRes = await fetch(metadataUrl, {
        headers: authHeader,
      });
      if (!metaRes.ok) {
        const errorText = await metaRes.text();
        console.error(`Failed to load metadata: HTTP ${metaRes.status}`, errorText);
        if (metaRes.status === 404) {
          throw new Error(`Metadata not found for project ${projectHash}. The project database file may be missing or the project may not exist.`);
        } else if (metaRes.status === 401) {
          throw new Error(`Unauthorized: Please log in to access this project.`);
        } else {
          throw new Error(`Failed to load metadata: HTTP ${metaRes.status} - ${errorText}`);
        }
      }
      const mapMeta = await metaRes.json();
      // console.log('Loaded map metadata:', mapMeta);
      setMapMetadata(mapMeta);
      
      // Загружаем времена если есть time
      let timeList = [];
      let selectedTime = null;
      if (mapMeta.has_time) {
        const timesUrl = shareHash
          ? `/api/map/times/shared/${shareHash}`
          : `/api/map/times/${projectHash}`;
        const timesRes = await fetch(timesUrl, {
          headers: authHeader,
        });
        if (timesRes.ok) {
          const timesData = await timesRes.json();
          timeList = timesData.times || [];
          setTimes(timeList);
          if (timeList.length > 0) {
            selectedTime = timeList[0];
            setCurrentTime(selectedTime);
          }
        }
      }
      
      // Настраиваем слои с использованием нового API
      setupLayers(m, projectHash, mapMeta, selectedTime);
      
      // Загружаем легенду из нового универсального API
      // НО: приоритет отдаем метаданным проекта, так как они более надежны
      // Сначала пробуем использовать метаданные проекта напрямую
      if (projectMeta && detectedPrefix) {
        console.log('Using project metadata for legend with prefix:', detectedPrefix);
        const success = showLegend(projectMeta, detectedPrefix, t('hecRasViewer.unit'));
        if (success) {
            // console.log('Legend rendered successfully from project metadata');
          return;
        } else {
          console.warn('Failed to show legend from project metadata, trying API endpoint');
        }
      }
      
      // Fallback: используем API endpoint
      try {
        const legendRes = await fetch(`/api/uploads/${projectHash}/legend`, {
          headers: authHeader,
        });
        if (legendRes.ok) {
          const legendData = await legendRes.json();
          // console.log('Legend data from API:', legendData);
          // console.log('Legend data mode:', legendData.mode);
          // console.log('Legend data legends count:', legendData.legends?.length || 0);
          
          if (renderLegendFromAPI(legendData, t('hecRasViewer.unit'))) {
            // Успешно отобразили легенду из нового API
            // console.log('Legend rendered successfully from API');
            return;
          } else {
            // console.warn('renderLegendFromAPI returned false, trying properties API');
          }
        } else {
          const errorText = await legendRes.text();
          console.warn(`Legend API returned ${legendRes.status}:`, errorText);
        }
      } catch (err) {
        console.error('Failed to load legend from new API:', err);
      }
      
      // Если не получилось, пробуем через properties API
      try {
        const propsRes = await fetch(`/api/hec-ras/${projectHash}/properties`, {
          headers: authHeader,
        });
        if (propsRes.ok) {
          const propsData = await propsRes.json();
          // console.log('Properties data:', propsData);
          
          // Используем структурированные данные если есть
          if (propsData.structured_data?.legend && propsData.structured_data.legend.values && propsData.structured_data.legend.rgba) {
            const legend = propsData.structured_data.legend;
            // console.log('Legend from structured_data:', legend);
            showLegendFromStructured(legend, t('hecRasViewer.unit'));
          }
          // Или используем полные метаданные с префиксом
          else if (propsData.metadata) {
            console.log('Using full metadata for legend, keys:', Object.keys(propsData.metadata));
            setMetadata(propsData.metadata);
            const success = showLegend(propsData.metadata, detectedPrefix, t('hecRasViewer.unit'));
            if (!success) {
              console.warn('Failed to show legend from metadata');
            }
          }
        } else {
          console.warn(`Properties API returned ${propsRes.status}`);
        }
      } catch (err) {
        console.warn('Failed to load metadata for legend:', err);
      }
      
      // Добавляем обработчики событий мыши для отображения глубины после загрузки слоев
      // Добавляем только один раз
      if (!mouseHandlersAddedRef.current) {
        m.once('idle', () => {
          const handleMouseMove = (e) => {
            if (m.getLayer('db-tiles-layer')) {
              // Показываем координаты, глубину можно получить из тайла
              setWaterDepth({
                lat: e.lngLat.lat.toFixed(6),
                lng: e.lngLat.lng.toFixed(6),
                depth: '0.00' // TODO: получить реальную глубину из тайла
              });
            }
          };
          
          const handleMouseOut = () => {
            setWaterDepth(null);
          };
          
          m.on('mousemove', handleMouseMove);
          m.on('mouseout', handleMouseOut);
          
          // Сохраняем ссылки на обработчики для последующего удаления
          m._hecRasMouseMove = handleMouseMove;
          m._hecRasMouseOut = handleMouseOut;
          
          mouseHandlersAddedRef.current = true;
        });
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  }, [projectHash, shareHash, setupLayers]);

  // Обработчик готовности карты
  const handleMapReady = useCallback((map) => {
    if (!projectHash) return;
    
    console.log('HecRasViewer: Map ready for project:', projectHash);
    mapRef.current = map;
    map._currentProjectHash = projectHash; // Сохраняем projectHash в объекте карты

    // Обработчики для автоматического пересчета площади при изменении карты
    const handleMapMove = () => {
      // Проверяем, что карта готова
      if (!map.isStyleLoaded() || !map.loaded()) return;
      
      // Проверяем, что карта все еще существует (не размонтирована)
      if (!mapRef.current || mapRef.current !== map) return;
      
      // Debounce пересчета площади при перемещении карты
      if (floodAreaCalculationTimeoutRef.current) {
        clearTimeout(floodAreaCalculationTimeoutRef.current);
      }
      floodAreaCalculationTimeoutRef.current = setTimeout(() => {
        // Дополнительная проверка перед вызовом
        if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
          calculateFloodArea(false);
        }
      }, 800); // Увеличиваем задержку для оптимизации
    };

    const handleMapZoom = () => {
      // Проверяем, что карта готова
      if (!map.isStyleLoaded() || !map.loaded()) return;
      
      // Проверяем, что карта все еще существует (не размонтирована)
      if (!mapRef.current || mapRef.current !== map) return;
      
      // Debounce пересчета площади при изменении масштаба
      if (floodAreaCalculationTimeoutRef.current) {
        clearTimeout(floodAreaCalculationTimeoutRef.current);
      }
      floodAreaCalculationTimeoutRef.current = setTimeout(() => {
        // Дополнительная проверка перед вызовом
        if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
          calculateFloodArea(false);
        }
      }, 800); // Увеличиваем задержку для оптимизации
    };

    // Сохраняем ссылки на обработчики для последующего удаления
    map._hecRasMapMove = handleMapMove;
    map._hecRasMapZoom = handleMapZoom;

    // Функция для загрузки проекта после инициализации карты
    const initializeMapData = () => {
      if (!mapRef.current || mapRef.current !== map) return;
      const currentProjectHash = map._currentProjectHash;
      if (currentProjectHash !== projectHash) {
        console.log('HecRasViewer: projectHash changed, skipping initialization');
        return;
      }
      
      console.log('HecRasViewer: Initializing map data for project:', currentProjectHash);
      map.resize();
      // Автоматическое добавление terrain/hillshade отключено - добавление только по запросу пользователя
      // addTerrain(map);
      loadProject(map);
      
      // Вычисляем начальную площадь затопления после загрузки
      const checkAndCalculate = () => {
        if (map.isStyleLoaded() && map.loaded()) {
          setTimeout(() => {
            if (mapRef.current && mapRef.current === map && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
              calculateFloodArea(false);
            }
          }, 1000);
        } else {
          map.once('style.load', () => {
            setTimeout(() => {
              if (mapRef.current && mapRef.current === map && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
                calculateFloodArea(false);
              }
            }, 1000);
          });
        }
      };
      checkAndCalculate();
    };

    map.on('load', () => {
      console.log('HecRasViewer: Map loaded successfully');
      setTimeout(initializeMapData, 100);
    });
    
    // Если карта уже загружена (редкий случай), вызываем сразу
    if (map.loaded()) {
      setTimeout(initializeMapData, 100);
    }

    map.on('moveend', handleMapMove);
    map.on('zoomend', handleMapZoom);

    // Обработка ошибок загрузки карты
    map.on('error', (e) => {
      console.error('HecRasViewer: Map error:', e);
      // Не прерываем работу, просто логируем
    });
  }, [projectHash, calculateFloodArea, addTerrain, loadProject]);

  // Cleanup при размонтировании или изменении projectHash
  useEffect(() => {
    // Сбрасываем флаг установки начальной позиции при смене проекта
    initialPositionSetRef.current = false;
    
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      if (timePlayIntervalRef.current) {
        clearInterval(timePlayIntervalRef.current);
        timePlayIntervalRef.current = null;
      }
      
      // Используем mapRef.current вместо локальной переменной
      const currentMap = mapRef.current;
      if (currentMap) {
        // Удаляем обработчики событий мыши
        if (currentMap._hecRasMouseMove) {
          currentMap.off('mousemove', currentMap._hecRasMouseMove);
          currentMap.off('mouseout', currentMap._hecRasMouseOut);
          delete currentMap._hecRasMouseMove;
          delete currentMap._hecRasMouseOut;
        }
        // Удаляем обработчики событий карты
        if (currentMap._hecRasMapMove) {
          currentMap.off('moveend', currentMap._hecRasMapMove);
          currentMap.off('zoomend', currentMap._hecRasMapZoom);
          delete currentMap._hecRasMapMove;
          delete currentMap._hecRasMapZoom;
        }
      }
      
      // Очищаем timeout для пересчета площади
      if (floodAreaCalculationTimeoutRef.current) {
        clearTimeout(floodAreaCalculationTimeoutRef.current);
        floodAreaCalculationTimeoutRef.current = null;
      }
      mouseHandlersAddedRef.current = false;
    };
  }, [projectHash]);

  /* ---------- effects ---------- */
  // Загрузка настроек карты пользователя
  useEffect(() => {
    const loadUserMapSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          // Если нет токена, используем стиль по умолчанию
          const styleNames = {
            'streets-v12': t('hecRasViewer.mapStyles.streets'),
            'satellite-v9': t('hecRasViewer.mapStyles.satellite'),
            'satellite-streets-v12': t('hecRasViewer.mapStyles.satelliteStreets')
          };
          setSelectedMapStyleName(styleNames['streets-v12'] || 'Streets');
          return;
        }

        const res = await fetch('/auth/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          if (userData.default_map_style) {
            // Сохраняем стиль пользователя
            setUserMapStyle(userData.default_map_style);
            
            // Применяем стиль пользователя
            const styleNames = {
              'streets-v12': t('hecRasViewer.mapStyles.streets'),
              'satellite-v9': t('hecRasViewer.mapStyles.satellite'),
              'satellite-streets-v12': t('hecRasViewer.mapStyles.satelliteStreets')
            };
            const styleName = styleNames[userData.default_map_style] || userData.default_map_style;
            setSelectedMapStyleName(styleName);
            
            // Применяем стиль к карте, если она уже загружена
            if (mapRef.current && mapRef.current.loaded()) {
              const style = `mapbox://styles/mapbox/${userData.default_map_style}`;
              mapRef.current.setStyle(style);
            }
          } else {
            setUserMapStyle('streets-v12');
            const styleNames = {
              'streets-v12': t('hecRasViewer.mapStyles.streets'),
              'satellite-v9': t('hecRasViewer.mapStyles.satellite'),
              'satellite-streets-v12': t('hecRasViewer.mapStyles.satelliteStreets')
            };
            setSelectedMapStyleName(styleNames['streets-v12'] || 'Streets');
          }
          
          // Загружаем проекцию пользователя
          if (userData.default_map_projection) {
            setUserMapProjection(userData.default_map_projection);
            // Применяем проекцию к карте, если она уже загружена
            if (mapRef.current && mapRef.current.loaded()) {
              try {
                mapRef.current.setProjection(userData.default_map_projection);
              } catch (e) {
                console.warn('Could not set projection:', e);
              }
            }
          } else {
            setUserMapProjection('mercator');
          }
        }
      } catch (error) {
        console.error('Error loading user map settings:', error);
        const styleNames = {
          'streets-v12': t('hecRasViewer.mapStyles.streets'),
          'satellite-v9': t('hecRasViewer.mapStyles.satellite'),
          'satellite-streets-v12': t('hecRasViewer.mapStyles.satelliteStreets')
        };
        setSelectedMapStyleName(styleNames['streets-v12'] || 'Streets');
      }
    };

    loadUserMapSettings();

    // Слушаем обновления настроек карты
    const handleMapSettingsUpdate = () => {
      loadUserMapSettings();
    };
    window.addEventListener('mapSettingsUpdated', handleMapSettingsUpdate);

    return () => {
      window.removeEventListener('mapSettingsUpdated', handleMapSettingsUpdate);
    };
  }, [t]);

  // Обновляем refs при изменении state
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    curIndexRef.current = curIndex;
  }, [curIndex]);

  // Обновление прозрачности слоя
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layerId = 'db-tiles-layer';
    if (m.getLayer(layerId)) {
      m.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
  }, [opacity]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      const panel = document.getElementById('map-controls-panel');
      if (panel && !panel.contains(event.target)) {
        setMapStyleMenuOpen(false);
      }
    };
    
    if (mapStyleMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [mapStyleMenuOpen]);

  // Автоматическая загрузка легенды при изменении метаданных
  useEffect(() => {
    if (metadata && Object.keys(metadata).length > 0) {
      console.log('Metadata changed, trying to show legend. Keys:', Object.keys(metadata));
      const success = showLegend(metadata, null, t('hecRasViewer.unit'));
      if (!success && legendRef.current) {
        console.warn('Failed to show legend from metadata, checking for legend keys:', 
          Object.keys(metadata).filter(k => 'legend' in k.toLowerCase()));
      }
    }
  }, [metadata]);

  // Обновление времени (если изменилось)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !projectHash || !mapMetadata) return;
    
    if (currentTime !== null && mapMetadata.has_time) {
      // Обновляем source с новым временем
      const sourceId = 'db-tiles';
      const layerId = 'db-tiles-layer';
      const newTileUrl = shareHash
        ? `/api/map/tiles/shared/${shareHash}/{z}/{x}/{y}.png?v=2&time=${encodeURIComponent(currentTime)}`
        : `/api/map/tiles/${projectHash}/{z}/{x}/{y}.png?v=2&time=${encodeURIComponent(currentTime)}`;
      
      // Удаляем и пересоздаем source/layer
      if (m.getLayer(layerId)) {
        m.removeLayer(layerId);
      }
      if (m.getSource(sourceId)) {
        m.removeSource(sourceId);
      }
      
      const sourceConfig = {
        type: 'raster',
        tiles: [newTileUrl],
        tileSize: 256,
      };
      
      if (mapMetadata.bounds) {
        sourceConfig.bounds = mapMetadata.bounds;
      }
      if (mapMetadata.minzoom !== undefined) {
        sourceConfig.minzoom = mapMetadata.minzoom;
      }
      if (mapMetadata.maxzoom !== undefined) {
        sourceConfig.maxzoom = mapMetadata.maxzoom;
      }
      
      // Проверяем, что стиль карты загружен перед добавлением source
      if (!m.isStyleLoaded()) {
        // Ждем загрузки стиля
        m.once('style.load', () => {
          try {
            m.addSource(sourceId, sourceConfig);
            m.addLayer({
              id: layerId,
              type: 'raster',
              source: sourceId,
              paint: { 'raster-opacity': opacity },
            });
            
            // Добавляем обработчики для отслеживания тайлов
            setTimeout(() => {
              updateLoadedTilesCount();
              const handleSourceData = (e) => {
                if (e.sourceId === sourceId) {
                  setTimeout(updateLoadedTilesCount, 100);
                }
              };
              m.on('sourcedata', handleSourceData);
              m.on('moveend', () => setTimeout(updateLoadedTilesCount, 200));
              m.on('zoomend', () => setTimeout(updateLoadedTilesCount, 200));
            }, 500);
            
            // console.log('Updated tiles source with time:', currentTime);
          } catch (err) {
            console.error('Error adding source/layer after style load:', err);
          }
        });
      } else {
        try {
          m.addSource(sourceId, sourceConfig);
          
          // Обработка загрузки тайлов и обновление счетчика
          const handleSourceData = (e) => {
            if (e.sourceId === sourceId) {
              if (e.isSourceLoaded === false && e.tile) {
                // Если тайл не загрузился (404), это нормально
              }
              setTimeout(updateLoadedTilesCount, 100);
            }
          };
          m.on('sourcedata', handleSourceData);
          
          m.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { 'raster-opacity': opacity },
          });
          
          // Добавляем обработчики для обновления счетчика
          m.on('moveend', () => setTimeout(updateLoadedTilesCount, 200));
          m.on('zoomend', () => setTimeout(updateLoadedTilesCount, 200));
          
          // Обновляем счетчик после добавления
          setTimeout(updateLoadedTilesCount, 500);
          
          // console.log('Updated tiles source with time:', currentTime);
        } catch (err) {
          console.error('Error adding source/layer:', err);
        }
      }
      
      // Пересчитываем площадь затопления после обновления тайлов
      // Ждем немного, чтобы тайлы успели загрузиться
      // Используем mapRef для проверки актуальности карты
      // Используем замыкание для захвата актуального currentTime
      const timeToUse = currentTime;
      setTimeout(() => {
        if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
          // Вызываем calculateFloodArea, которая использует актуальное currentTime из state
          calculateFloodArea(false);
        }
      }, 1500); // Увеличиваем задержку для стабильности
    }
  }, [currentTime, projectHash, shareHash, mapMetadata, opacity]);

  // Обновление позиции слайдера времени происходит автоматически через value prop

  // Автоматический пересчет площади при изменении времени (старый метод для совместимости)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !projectHash) return;
    
    // Если нет времени, но есть временные данные, используем первое время
    // Если времени нет вообще, не пересчитываем
    if (!currentTime && times.length > 0) {
      return; // Время будет установлено автоматически
    }
    
    // Проверяем, что карта готова
    if (!m.isStyleLoaded() || !m.loaded()) {
      // Ждем загрузки карты
      const checkAndCalculate = () => {
        if (m.isStyleLoaded() && m.loaded()) {
          setTimeout(() => {
            if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
              calculateFloodArea(false);
            }
          }, 1500); // Увеличиваем задержку, чтобы тайлы успели загрузиться
        } else {
          m.once('style.load', () => {
            setTimeout(() => {
              if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
                calculateFloodArea(false);
              }
            }, 1500);
          });
        }
      };
      checkAndCalculate();
    } else {
      // Карта готова, пересчитываем площадь
      // Используем большую задержку, чтобы тайлы для нового времени успели загрузиться
      setTimeout(() => {
        if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.loaded()) {
          calculateFloodArea(false);
        }
      }, 2000); // Увеличиваем задержку для загрузки тайлов нового времени
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  /* ---------- play / pause ---------- */
  function togglePlay() {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    } else {
      playIntervalRef.current = setInterval(() => {
        setCurIndex(prev => {
          const next = prev + 1 >= layers.length ? 0 : prev + 1;
          return next;
        });
      }, 1000);
    }
  }

  /* ---------- play / pause для временных данных ---------- */
  function toggleTimePlay() {
    if (times.length === 0) return;
    
    if (timePlayIntervalRef.current) {
      // Пауза
      clearInterval(timePlayIntervalRef.current);
      timePlayIntervalRef.current = null;
    } else {
      // Воспроизведение
      timePlayIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const currentIdx = times.indexOf(prev);
          if (currentIdx === -1) return prev;
          const nextIdx = currentIdx + 1 >= times.length ? 0 : currentIdx + 1;
          const nextTime = times[nextIdx];
          return nextTime;
        });
      }, 1000);
    }
  }

  /* ---------- navigation ---------- */
  function goToNext() {
    if (layers.length === 0) return;
    const next = curIndex + 1 >= layers.length ? 0 : curIndex + 1;
    setCurIndex(next);
    // Остановить анимацию при ручной навигации
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }

  function goToPrevious() {
    if (layers.length === 0) return;
    const prev = curIndex - 1 < 0 ? layers.length - 1 : curIndex - 1;
    setCurIndex(prev);
    // Остановить анимацию при ручной навигации
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }

  /* ---------- изменение стиля карты ---------- */
  const changeMapStyle = useCallback((styleValue, styleName) => {
    const m = mapRef.current;
    if (!m) return;
    
    // Получаем полное название стиля из переводов
    const styleNames = {
      'streets-v12': t('hecRasViewer.mapStyles.streets'),
      'satellite-v9': t('hecRasViewer.mapStyles.satellite'),
      'satellite-streets-v12': t('hecRasViewer.mapStyles.satelliteStreets')
    };
    setSelectedMapStyleName(styleNames[styleValue] || styleName);
    
    // Сбрасываем флаг установки начальной позиции при смене стиля
    // Позиция будет установлена заново при загрузке стиля
    initialPositionSetRef.current = false;
    
    const style = `mapbox://styles/mapbox/${styleValue}`;
    m.setStyle(style);
    m.once('style.load', () => {
      // Автоматическое добавление terrain/hillshade отключено - добавление только по запросу пользователя
      // addTerrain(m);
      // Пересоздать слой с новым API если есть метаданные
      if (mapMetadata && projectHash) {
        setupLayers(m, projectHash, mapMetadata, currentTime);
      }
      // Если нет новых метаданных, просто перезагружаем проект
      else if (projectHash) {
        loadProject(m);
      }
    });
  }, [mapMetadata, projectHash, currentTime]);

  /* ---------- управление картой (zoom, recenter) ---------- */
  const handleZoomIn = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    m.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    m.zoomOut();
  }, []);

  const handleRecenter = useCallback(() => {
    const m = mapRef.current;
    if (!m || !mapMetadata) return;
    
    // Возвращаем карту к исходным bounds или center
    if (mapMetadata.bounds) {
      m.fitBounds(mapMetadata.bounds, { padding: 30 });
    } else if (mapMetadata.center) {
      m.setCenter(mapMetadata.center);
      if (mapMetadata.maxzoom) {
        m.setZoom(mapMetadata.maxzoom - 1);
      }
    }
  }, [mapMetadata]);

  /* ---------- JSX ---------- */
  if (!projectHash) return null;

  const [mapStyleMenuAnchorEl, setMapStyleMenuAnchorEl] = useState(null);

  const handleMapStyleMenuOpen = (event) => {
    setMapStyleMenuAnchorEl(event.currentTarget);
    setMapStyleMenuOpen(true);
  };

  const handleMapStyleMenuClose = () => {
    setMapStyleMenuAnchorEl(null);
    setMapStyleMenuOpen(false);
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* карта */}
      <MapComponent
        ref={mapComponentRef}
        mapId={`hec-ras-map-${projectHash}`}
        style={`mapbox://styles/mapbox/${userMapStyle}`}
        center={mapMetadata?.center || [82.6, 48.5]}
        zoom={mapMetadata?.maxzoom ? mapMetadata.maxzoom - 1 : 6}
        pitch={60}
        bearing={-17.6}
        projection={userMapProjection}
        disableAutoUpdate={true}
        onMapReady={handleMapReady}
        transformRequest={(url) => {
          if (url.includes('events.mapbox.com')) {
            return null; // Блокируем запросы к аналитике
          }
          // Добавляем заголовок Authorization для запросов к нашим тайлам (только если не публичный доступ)
          if (url.includes('/api/map/tiles/') && !url.includes('/tiles/shared/')) {
            const token = localStorage.getItem('token');
            if (token) {
              return {
                url,
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              };
            }
          }
          return { url };
        }}
      />

      {/* Панель управления картой */}
      <Box 
        id="map-controls-panel"
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
        }}
      >
        <Box className="control-group">
          <Button
            id="map-style-button"
            variant="contained"
            onClick={handleMapStyleMenuOpen}
            sx={{
              minWidth: 150,
              textTransform: 'none',
            }}
          >
            {selectedMapStyleName || t('hecRasViewer.mapStyles.streets')}
          </Button>
          <Menu
            id="map-style-menu"
            anchorEl={mapStyleMenuAnchorEl}
            open={mapStyleMenuOpen}
            onClose={handleMapStyleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={() => {
              changeMapStyle('streets-v12', 'Streets');
              handleMapStyleMenuClose();
            }}>
              {t('hecRasViewer.mapStyles.streets')}
            </MenuItem>
            <MenuItem onClick={() => {
              changeMapStyle('satellite-v9', 'Satellite');
              handleMapStyleMenuClose();
            }}>
              {t('hecRasViewer.mapStyles.satellite')}
            </MenuItem>
            <MenuItem onClick={() => {
              changeMapStyle('satellite-streets-v12', 'Satellite Streets');
              handleMapStyleMenuClose();
            }}>
              {t('hecRasViewer.mapStyles.satelliteStreets')}
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* легенда */}
      <div id="map-legend" ref={legendRef} style={{ display: 'block' }}>
      </div>

      {/* Кнопки управления картой (zoom in, zoom out, recenter) */}
      <Box 
        id="map-navigation-controls"
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Paper
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            p: 0.5,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            backgroundColor: 'white',
          }}
        >
          <Tooltip title={t('hecRasViewer.zoomIn')} placement="left">
            <IconButton
              id="zoom-in-button"
              onClick={handleZoomIn}
              sx={{
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('hecRasViewer.zoomOut')} placement="left">
            <IconButton
              id="zoom-out-button"
              onClick={handleZoomOut}
              sx={{
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('hecRasViewer.recenter')} placement="left">
            <IconButton
              id="recenter-button"
              onClick={handleRecenter}
              sx={{
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <MyLocationIcon />
            </IconButton>
          </Tooltip>
        </Paper>
      </Box>

      {/* Модальное окно с графиком */}
      <Dialog
        open={showFloodAreaModal}
        onClose={() => setShowFloodAreaModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '80vh',
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {t('hecRasViewer.floodArea')}
            </Typography>
            <IconButton
              onClick={() => setShowFloodAreaModal(false)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentFloodArea !== null && (
            <Paper
              sx={{
                p: 2,
                mb: 2,
                backgroundColor: 'grey.100',
              }}
            >
              <Typography>
                <strong>{t('hecRasViewer.floodAreaOnScreen')}:</strong> {currentFloodArea.toFixed(2)} {t('hecRasViewer.km2').trim()}
              </Typography>
            </Paper>
          )}
          
          {floodAreaData && floodAreaData.times && floodAreaData.times.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                {t('hecRasViewer.floodAreaChart')}
              </Typography>
              <Box sx={{ height: 400, position: 'relative' }}>
                <Line
                  data={{
                    labels: floodAreaData.times,
                    datasets: [{
                      label: t('hecRasViewer.floodAreaLabel'),
                      data: floodAreaData.areas,
                      borderColor: 'rgb(77, 166, 255)',
                      backgroundColor: 'rgba(77, 166, 255, 0.1)',
                      borderWidth: 2,
                      fill: true,
                      tension: 0.4
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top'
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${t('hecRasViewer.areaLabel')} ${context.parsed.y.toFixed(2)} ${t('hecRasViewer.km2').trim()}`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: `${t('hecRasViewer.area')} (${t('hecRasViewer.km2').trim()})`
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: t('hecRasViewer.time')
                        }
                      }
                    }
                  }}
                />
              </Box>
            </Box>
          )}
          
          {(!floodAreaData || !floodAreaData.times || floodAreaData.times.length === 0) && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {t('hecRasViewer.noTimeData')}
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Панель управления временем (если есть временные данные) */}
      {times.length > 0 && (
        <Box
          id="time-controls-panel"
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            maxWidth: 600,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: 1.5,
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          {/* Кнопка play внизу слева */}
          <IconButton
            id="time-play-button"
            onClick={toggleTimePlay}
            color="primary"
            sx={{
              backgroundColor: 'white',
              '&:hover': {
                backgroundColor: 'grey.100',
              },
              boxShadow: 2,
              flexShrink: 0,
            }}
          >
            {timePlayIntervalRef.current ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          
          {/* Слайдер */}
          <Box
            sx={{
              width: 400,
              flexShrink: 0,
              flexGrow: 0,
              px: 2,
            }}
          >
            <Slider
              id="time-range-slider"
              min={0}
              max={times.length - 1}
              value={times.indexOf(currentTime) >= 0 ? times.indexOf(currentTime) : 0}
              onChange={(e, newValue) => {
                const newIdx = Number(newValue);
                const newTime = times[newIdx];
                if (newTime) {
                  setCurrentTime(newTime);
                }
                // Остановить анимацию при ручной навигации
                if (timePlayIntervalRef.current) {
                  clearInterval(timePlayIntervalRef.current);
                  timePlayIntervalRef.current = null;
                }
              }}
              valueLabelDisplay="off"
              marks={false}
            />
          </Box>
          
          {/* Отображение времени справа */}
          {currentTime && (
            <Typography
              sx={{
                color: 'text.primary',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                ml: 1.5,
              }}
            >
              {`${t('hecRasViewer.timeLabel')} ${currentTime}`}
            </Typography>
          )}
        </Box>
      )}

      {/* Панель управления анимацией (для старых слоев, если они есть) */}
      {layers.length > 0 && (
        <>
          <Box
            id="animation-controls"
            sx={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: 1,
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            <IconButton
              id="back-button"
              onClick={goToPrevious}
              title={t('hecRasViewer.previous')}
              color="primary"
              sx={{
                backgroundColor: 'white',
                '&:hover': {
                  backgroundColor: 'grey.100',
                },
              }}
            >
              <SkipPreviousIcon />
            </IconButton>
            <IconButton
              id="play-button"
              onClick={togglePlay}
              title={t('hecRasViewer.play')}
              color="primary"
              sx={{
                backgroundColor: 'white',
                '&:hover': {
                  backgroundColor: 'grey.100',
                },
              }}
            >
              {playIntervalRef.current ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton
              id="forward-button"
              onClick={goToNext}
              title={t('hecRasViewer.next')}
              color="primary"
              sx={{
                backgroundColor: 'white',
                '&:hover': {
                  backgroundColor: 'grey.100',
                },
              }}
            >
              <SkipNextIcon />
            </IconButton>
            <Typography
              id="time-label"
              sx={{
                ml: 1,
                px: 2,
                color: 'text.primary',
              }}
            >
              {layers[curIndex]?.title ?? ''}
            </Typography>
          </Box>

          {/* слайдер времени */}
          <Box
            id="time-slider-container"
            sx={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '60%',
              maxWidth: 600,
              zIndex: 1000,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: 2,
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            <Slider
              id="time-slider"
              min={0}
              max={layers.length - 1}
              value={curIndex}
              onChange={(e, newValue) => {
                const newIndex = Number(newValue);
                setCurIndex(newIndex);
                // Остановить анимацию при ручной навигации
                if (playIntervalRef.current) {
                  clearInterval(playIntervalRef.current);
                  playIntervalRef.current = null;
                }
              }}
              marks={false}
            />
          </Box>
        </>
      )}

    </Box>
  );
}
