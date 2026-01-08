// frontend/src/pages/TerrainMap.jsx
// Страница с картой, рельефом и 3D моделями (использует threebox)

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Threebox } from 'threebox-plugin';

import {
  Box,
  Typography,
  Alert,
  Paper,
  IconButton,
  FormControlLabel,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  TextField,
  InputAdornment,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ThreeDRotationIcon from '@mui/icons-material/ThreeDRotation';
import Fab from '@mui/material/Fab';

import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../utils/usePageTitle';
import MapComponent from '../components/map/Map';
import { MAPBOX_ACCESS_TOKEN } from '../components/map/Map';

// Загружаем токен Mapbox из localStorage или используем значение по умолчанию из компонента Map
const defaultMapboxToken = MAPBOX_ACCESS_TOKEN;
const savedToken = localStorage.getItem('mapbox_access_token') || defaultMapboxToken;
mapboxgl.accessToken = savedToken;

const SIDEBAR_WIDTH = 300;

// Цвета для разных категорий станций
const CATEGORY_COLORS = {
  1: '#3B82F6', // Метеорологические посты - синий
  2: '#10B981', // Гидрологические посты - зеленый
  3: '#F59E0B', // Снегомерные точки - оранжевый
};

// URL для модели (Vite public/)
const MODEL_URL = '/models/WeatherStation.glb';

// Настройки для 3D (важно для стабильности)
const MODELS_MIN_ZOOM = 10;      // показываем 3D только при приближении
const MODELS_MAX_COUNT = 25;     // лимит, чтобы не убить WebGL
const LOAD_DELAY_MS = 20;        // минимальная задержка для быстрой загрузки

export default function TerrainMap() {
  const { t } = useTranslation();

  const mapComponentRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [stationsData, setStationsData] = useState(null);
  const [categoryVisibility, setCategoryVisibility] = useState({
    1: true,
    2: true,
    3: true,
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Выбранные станции для 3D (ключи стабильные!)
  const [selectedStations, setSelectedStations] = useState(() => new Set());

  const markersRef = useRef([]);
  const popupsRef = useRef([]);

  // refs для актуальных данных внутри custom layer
  const stationsDataRef = useRef(null);
  const categoryVisibilityRef = useRef(categoryVisibility);
  const selectedStationsRef = useRef(selectedStations);

  useEffect(() => {
    stationsDataRef.current = stationsData;
  }, [stationsData]);

  useEffect(() => {
    categoryVisibilityRef.current = categoryVisibility;
  }, [categoryVisibility]);

  useEffect(() => {
    selectedStationsRef.current = selectedStations;
    // При смене выбранных станций — синхронизируем модели
    requestModelsSync();
  }, [selectedStations]);

  // Храним модели по ключу станции (чтобы добавлять/удалять выборочно)
  const modelsByKeyRef = useRef(new Map());     // key -> threebox object
  const loadingKeysRef = useRef(new Set());     // key currently loading
  const syncTimerRef = useRef(null);
  
  // Кэш загруженных моделей (по URL модели)
  const modelCacheRef = useRef(new Map());      // MODEL_URL -> threebox model object
  const modelLoadingPromisesRef = useRef(new Map()); // MODEL_URL -> Promise<model>

  // Кэш метеостанций (категория 1): key -> { lng, lat, name }
  const weatherStationLookupRef = useRef(new Map());

  // Стабильный ключ для станции: сначала code, иначе id
  const getStationKey = useCallback((station) => {
    return String(station.code || station.id);
  }, []);

  // Обновляем lookup для метеостанций при приходе данных
  useEffect(() => {
    const data = stationsData;
    const lookup = new Map();

    if (data) {
      const weather = data.find((cat) => cat?.category?.id === 1);
      if (weather?.sites?.length) {
        weather.sites.forEach((s) => {
          const key = String(s.code || s.id);
          lookup.set(key, {
            key,
            name: s.name,
            lng: s.longtitude,
            lat: s.latitude,
          });
        });
      }
    }

    weatherStationLookupRef.current = lookup;

    // Если данные обновились — тоже синхронизируем 3D
    requestModelsSync();
  }, [stationsData]);

  // Заголовок страницы
  usePageTitle(t('pageTitles.terrainMap'));

  // Сайдбар
  const toggleSidebar = useCallback(
    (collapsed) => {
      const newCollapsed = collapsed !== undefined ? collapsed : !sidebarCollapsed;
      setSidebarCollapsed(newCollapsed);

      if (mapInstanceRef.current && mapInstanceRef.current.loaded()) {
        mapInstanceRef.current.easeTo({
          padding: { left: newCollapsed ? 0 : SIDEBAR_WIDTH },
          duration: 1000,
        });
      }
    },
    [sidebarCollapsed]
  );

  // Fly to station
  const flyToStation = useCallback((longitude, latitude) => {
    const map = mapInstanceRef.current;
    if (!map || !map.loaded()) return;

    popupsRef.current.forEach((popup) => popup.remove());

    map.flyTo({
      center: [longitude, latitude],
      zoom: 12,
      pitch: 60,
      bearing: 0,
      duration: 1500,
      essential: true,
    });

    setTimeout(() => {
      const marker = markersRef.current.find((m) => {
        const lngLat = m.getLngLat();
        return (
          Math.abs(lngLat.lng - longitude) < 0.0001 &&
          Math.abs(lngLat.lat - latitude) < 0.0001
        );
      });

      if (marker && marker.getPopup()) {
        popupsRef.current.forEach((p) => {
          if (p !== marker.getPopup()) p.remove();
        });
        marker.togglePopup();
      }
    }, 1600);
  }, []);

  // Zoom to 3D models
  const zoomTo3DModels = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.loaded() || !stationsData) return;

    // Находим все выбранные станции с 3D моделями (категория 1)
    const selected3DStations = [];
    const lookup = weatherStationLookupRef.current || new Map();
    const selected = selectedStationsRef.current || new Set();

    for (const key of selected) {
      const station = lookup.get(key);
      if (station) {
        selected3DStations.push(station);
      }
    }

    if (selected3DStations.length === 0) {
      // Если нет выбранных 3D моделей, пытаемся найти первую метеостанцию
      const weatherCategory = stationsData.find((cat) => cat?.category?.id === 1);
      if (weatherCategory?.sites?.length > 0) {
        const firstStation = weatherCategory.sites[0];
        map.flyTo({
          center: [firstStation.longtitude, firstStation.latitude],
          zoom: 15,
          pitch: 75,
          bearing: 0,
          duration: 2000,
          essential: true,
        });
      }
      return;
    }

    // Вычисляем центр всех выбранных станций
    let avgLng = 0;
    let avgLat = 0;
    selected3DStations.forEach((station) => {
      avgLng += station.lng;
      avgLat += station.lat;
    });
    avgLng /= selected3DStations.length;
    avgLat /= selected3DStations.length;

    // Приближаем камеру к 3D моделям с высоким zoom и pitch
    map.flyTo({
      center: [avgLng, avgLat],
      zoom: selected3DStations.length === 1 ? 15 : 14,
      pitch: 75,
      bearing: 0,
      duration: 2000,
      essential: true,
    });

    popupsRef.current.forEach((popup) => popup.remove());
  }, [stationsData]);

  // Собираем список станций для UI
  const allStations = useMemo(() => {
    if (!stationsData) return [];

    const result = [];
    stationsData.forEach((category) => {
      if (!categoryVisibility[category.category.id]) return;

      category.sites.forEach((site) => {
        result.push({
          ...site,
          categoryName: category.category.name,
          categoryId: category.category.id,
          _key: String(site.code || site.id),
        });
      });
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return result.filter(
        (station) =>
          station.name.toLowerCase().includes(query) ||
          String(station.code).toLowerCase().includes(query) ||
          station.categoryName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [stationsData, categoryVisibility, searchQuery]);

  // Загрузка stations
  useEffect(() => {
    fetch('/stations/posts.json')
      .then((res) => res.json())
      .then((data) => {
        if (data.statusCode === 200 && data.data) {
          setStationsData(data.data);
        }
      })
      .catch((error) => {
        console.error('Error loading stations data:', error);
      });
  }, []);

  // Обработчик готовности карты
  const handleMapReady = useCallback((map) => {
    if (!map) return;

    mapInstanceRef.current = map;

    // Диагностика версии mapbox-gl и поддержки terrain
    console.log('mapbox-gl version:', mapboxgl.version);
    console.log('has setTerrain:', typeof mapInstanceRef.current?.setTerrain);

    if (!mapboxgl.accessToken) {
      setMapError(t('terrainMap.noToken'));
      return;
    }

    // Устанавливаем mapLoaded сразу, чтобы карта отобразилась быстрее
    if (map.loaded()) {
      setMapLoaded(true);
      setMapError(null);
      setTimeout(() => toggleSidebar(false), 500);
    } else {
      map.once('load', () => {
        setMapLoaded(true);
        setMapError(null);
        setTimeout(() => toggleSidebar(false), 500);
      });
    }

    // Добавляем terrain при загрузке стиля (упрощенная логика)
    map.on('style.load', () => {
      addTerrain(map);
    });

    // 3D слой загружаем только когда нужно (при приближении или выборе станций)
    // Не загружаем сразу при загрузке карты

    map.on('error', (e) => {
      console.error('Map error:', e);
      if (e?.error?.message) {
        const msg = e.error.message;
        if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid')) {
          setMapError(t('terrainMap.invalidToken'));
        } else {
          setMapError(msg);
        }
      } else {
        setMapError(t('terrainMap.loadError'));
      }
    });

    // При zoomend/moveend синхронизируем (чтобы при удалении/приближении модели корректно очищались)
    map.on('zoomend', () => {
      requestModelsSync();
    });
    map.on('moveend', () => {
      // threebox автоматически обновляет позиции моделей
      requestModelsSync();
    });
  }, [t, toggleSidebar]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      // маркеры/попапы
      markersRef.current.forEach((marker) => marker.remove());
      popupsRef.current.forEach((popup) => popup.remove());
      markersRef.current = [];
      popupsRef.current = [];

      // 3D модели
      safeClearAllModels();

      const map = mapInstanceRef.current;
      if (map) {
        try { if (map.getLayer('threebox-layer')) map.removeLayer('threebox-layer'); } catch {}
        try { if (map.getLayer('hillshade')) map.removeLayer('hillshade'); } catch {}
        try { if (map.getLayer('sky')) map.removeLayer('sky'); } catch {}
        try { if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem'); } catch {}
      }

      // Очистка threebox
      if (window['tb']) {
        try {
          window['tb'].clear();
          window['tb'] = null;
        } catch (e) {
          console.error('Error clearing threebox:', e);
        }
      }

      mapInstanceRef.current = null;

      setMapLoaded(false);
    };
  }, []);

  // Добавление маркеров станций
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !stationsData) return;

    markersRef.current.forEach((marker) => marker.remove());
    popupsRef.current.forEach((popup) => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    stationsData.forEach((category) => {
      const categoryId = category.category.id;
      if (!categoryVisibility[categoryId]) return;

      category.sites.forEach((site) => {
        const el = document.createElement('div');
        el.className = 'station-marker';
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = CATEGORY_COLORS[categoryId] || '#666';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([site.longtitude, site.latitude])
          .addTo(map);

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong>${site.name}</strong><br/>
            <small>${site.code}</small><br/>
            <small>${site.siteType?.name ?? ''}</small><br/>
            <small>${category.category?.name ?? ''}</small>
          </div>
        `);

        marker.setPopup(popup);

        el.addEventListener('click', () => {
          popupsRef.current.forEach((p) => {
            if (p !== marker.getPopup()) p.remove();
          });
          marker.togglePopup();
        });

        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      });
    });
  }, [mapLoaded, stationsData, categoryVisibility]);

  // ---------- Terrain ----------
  function addTerrain(map) {
    if (!map || !map.isStyleLoaded()) {
      console.warn('Map style not loaded yet, cannot add terrain');
      return;
    }

    if (map.getSource('mapbox-dem')) {
      ensureTerrainLayers(map);
      return;
    }

    try {
      console.log('Adding terrain source...');
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      console.log('Terrain source added successfully');

      try {
        console.log('Setting terrain...');
        map.setTerrain({
          source: 'mapbox-dem',
          exaggeration: 1.5,
        });
        console.log('Terrain set successfully');
      } catch (error) {
        console.error('Terrain недоступен:', error?.message);
      }

      ensureTerrainLayers(map);
    } catch (error) {
      console.error('Не удалось добавить terrain source:', error?.message);
    }
  }

  function ensureTerrainLayers(map) {
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    try {
      if (map.getSource('mapbox-dem') && !map.getLayer('hillshade')) {
        console.log('Adding hillshade layer...');
        map.addLayer({
          id: 'hillshade',
          type: 'hillshade',
          source: 'mapbox-dem',
          paint: { 'hillshade-exaggeration': 0.8 },
        });
        console.log('Hillshade layer added successfully');
      }
    } catch (e) {
      console.error('Hillshade слой недоступен:', e?.message);
    }

    try {
      if (!map.getLayer('sky')) {
        console.log('Adding sky layer...');
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0, 0],
            'sky-atmosphere-sun-intensity': 15,
          },
        });
        console.log('Sky layer added successfully');
      }
    } catch (e) {
      console.error('Sky слой недоступен:', e?.message);
    }

    try {
      map.setFog({});
    } catch (e) {
      console.debug('Fog недоступен:', e?.message);
    }
  }

  // ---------- 3D layer ----------
  async function ensure3DLayer(map) {
    if (!map || !map.isStyleLoaded()) return;
    if (window['tb']) return;
    if (map.getLayer('threebox-layer')) return;

    // Получаем WebGL контекст (важно для Mapbox GL v2/v3)
    const gl =
      map.painter?.context?.gl ||
      map.getCanvas().getContext('webgl2') ||
      map.getCanvas().getContext('webgl');

    if (!gl) {
      console.error('WebGL context not available for Threebox');
      return;
    }

    try {
      // Инициализируем threebox как глобальный объект
      window['tb'] = new Threebox(map, gl, { defaultLights: true });
      
      console.log('Threebox initialized as global window.tb');

      // Добавляем threebox как custom layer
      map.addLayer({
        id: 'threebox-layer',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function () {
          this.tb = window['tb'];
        },
        render: function () {
          this.tb.update();
        }
      });

        // Первичная синхронизация
        requestModelsSync();
    } catch (error) {
      console.error('Error initializing threebox:', error);
    }
  }

  // ---------- 3D sync logic ----------
  const isSyncingRef = useRef(false);
  
  function requestModelsSync() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      // Предотвращаем множественные одновременные вызовы
      if (isSyncingRef.current) {
        console.log('Sync already in progress, skipping...');
        return;
      }
      isSyncingRef.current = true;
      syncModelsWithSelection()
        .catch((e) => console.error('syncModels error:', e))
        .finally(() => {
          isSyncingRef.current = false;
        });
    }, 50); // Уменьшена задержка для более быстрой синхронизации
  }

  // Получает ключи метеостанций в текущем viewport
  function getWeatherKeysInView(map) {
    const lookup = weatherStationLookupRef.current || new Map();
    const b = map.getBounds();
    const keys = [];

    for (const [key, s] of lookup.entries()) {
      if (b.contains([s.lng, s.lat])) keys.push(key);
    }
    return keys;
  }

  async function syncModelsWithSelection() {
    const map = mapInstanceRef.current;
    const visibility = categoryVisibilityRef.current;

    if (!map) return;

    // Выбранные ключи
    const selected = selectedStationsRef.current || new Set();
    const isManualSelection = selected.size > 0; // Ручной выбор станций

    // Если категория 1 выключена — чистим
    if (!visibility?.[1]) {
      safeClearAllModels();
      return;
    }

    // Для ручного выбора (клик на станцию) - загружаем модели сразу, без проверки zoom
    // Для автозагрузки - проверяем zoom
    if (!isManualSelection && map.getZoom() < MODELS_MIN_ZOOM) {
      safeClearAllModels();
      return;
    }

    // Инициализируем threebox только когда нужно (при приближении или ручном выборе)
    if (!window['tb']) {
      await ensure3DLayer(map);
    }

    const tb = window['tb'];
    if (!tb) return;

    // Нужны только те, что существуют среди метеостанций
    const lookup = weatherStationLookupRef.current || new Map();

    let desiredKeys = [];
    const isAutoLoad = !isManualSelection; // Флаг автозагрузки

    if (selected.size > 0) {
      // Старое поведение: только выбранные
      for (const key of selected) {
        if (lookup.has(key)) desiredKeys.push(key);
      }
    } else {
      // НОВОЕ: автозагрузка метеостанций в текущем окне карты
      desiredKeys = getWeatherKeysInView(map);
    }

    // лимит по количеству (защита WebGL)
    desiredKeys = desiredKeys.slice(0, MODELS_MAX_COUNT);

    // Удаляем лишние модели
    const modelsByKey = modelsByKeyRef.current;
    for (const [key, tbObject] of modelsByKey.entries()) {
      if (!desiredKeys.includes(key)) {
        try {
          window['tb'].remove(tbObject);
        } catch (e) {
          console.error('Error removing model:', e);
        }
        modelsByKey.delete(key);
      }
    }

    // Добавляем недостающие (последовательно)
    for (let i = 0; i < desiredKeys.length; i++) {
      const key = desiredKeys[i];

      // Проверяем, что модель еще не загружена и не загружается
      if (modelsByKey.has(key)) continue;
      if (loadingKeysRef.current.has(key)) continue;

      const station = lookup.get(key);
      if (!station) continue;

      // Помечаем как загружающуюся сразу
      loadingKeysRef.current.add(key);

      // Минимальная задержка только для первой модели, остальные загружаем параллельно
      if (i > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(LOAD_DELAY_MS);
      }

      // если за время ожидания условия изменились — прекращаем
      const mapNow = mapInstanceRef.current;
      const tbNow = window['tb'];
      const visNow = categoryVisibilityRef.current;
      const selectedNow = selectedStationsRef.current || new Set();
      const isManualNow = selectedNow.size > 0;
      
      // Для ручного выбора не проверяем zoom, для автозагрузки - проверяем
      if (!mapNow || !tbNow || !visNow?.[1] || (!isManualNow && mapNow.getZoom() < MODELS_MIN_ZOOM)) {
        loadingKeysRef.current.delete(key);
        return;
      }

      try {
        console.log('Loading model for station:', key, station);
        
        // Получаем высоту рельефа для позиционирования модели
        let elevation = 0;
        try {
          if (mapNow.getSource('mapbox-dem')) {
            const terrainElevation = mapNow.queryTerrainElevation([station.lng, station.lat]);
            if (terrainElevation !== null && terrainElevation !== undefined && !isNaN(terrainElevation)) {
              elevation = terrainElevation;
              console.log(`Terrain elevation at ${station.lng},${station.lat}: ${elevation}m`);
            }
          }
        } catch (e) {
          console.warn('Error querying terrain elevation:', e);
        }

        // Проверяем условия перед загрузкой
        // Если автозагрузка - проверяем viewport, иначе - selectedStations
        let shouldLoad = false;
        if (isAutoLoad) {
          // Для автозагрузки: проверяем, что станция все еще в viewport
          const bounds = mapNow.getBounds();
          shouldLoad = bounds.contains([station.lng, station.lat]);
        } else {
          // Для ручного выбора: проверяем, что станция все еще выбрана
          shouldLoad = (selectedStationsRef.current || new Set()).has(key);
        }

        if (!shouldLoad) {
          console.log(`Station ${isAutoLoad ? 'out of viewport' : 'deselected'} during load, skipping:`, key);
          loadingKeysRef.current.delete(key);
          continue;
        }

        // Используем кэш для загрузки модели
        let cachedModel = modelCacheRef.current.get(MODEL_URL);
        let loadPromise = modelLoadingPromisesRef.current.get(MODEL_URL);

        if (!cachedModel && !loadPromise) {
          // Модель не загружена и не загружается - создаем промис загрузки
          loadPromise = new Promise((resolve, reject) => {
            const options = {
              obj: MODEL_URL,
              type: 'gltf',
              scale: 50, // масштаб модели (50 метров)
              units: 'meters',
              rotation: { x: 90, y: 180, z: 0 }, // Поворот по оси X на 90° и по Y на 180° чтобы модель стояла правильно
              anchor: 'center',
            };

            console.log('Loading model into cache:', MODEL_URL);
            window['tb'].loadObj(options, (model) => {
              // Сохраняем в кэш
              modelCacheRef.current.set(MODEL_URL, model);
              modelLoadingPromisesRef.current.delete(MODEL_URL);
              console.log('Model cached successfully:', MODEL_URL);
              resolve(model);
            }, (error) => {
              modelLoadingPromisesRef.current.delete(MODEL_URL);
              console.error('Error loading model:', MODEL_URL, error);
              reject(error);
            });
          });

          modelLoadingPromisesRef.current.set(MODEL_URL, loadPromise);
        } else if (cachedModel) {
          // Модель уже в кэше - используем её сразу
          loadPromise = Promise.resolve(cachedModel);
        }

        // Ждем загрузки модели (из кэша или новой загрузки)
        loadPromise
          .then((baseModel) => {
            // Проверяем, что модель еще не добавлена для этой станции
            if (modelsByKey.has(key)) {
              console.log('Model already added for key, skipping:', key);
        loadingKeysRef.current.delete(key);
              return;
            }

            // Проверяем условия после загрузки
            const mapAfterLoad = mapInstanceRef.current;
            if (!mapAfterLoad) {
              console.log('Map not available after load, skipping:', key);
              loadingKeysRef.current.delete(key);
              return;
            }

            let shouldAdd = false;
            if (isAutoLoad) {
              // Для автозагрузки: проверяем, что станция все еще в viewport
              const bounds = mapAfterLoad.getBounds();
              shouldAdd = bounds.contains([station.lng, station.lat]);
        } else {
              // Для ручного выбора: проверяем, что станция все еще выбрана
              shouldAdd = (selectedStationsRef.current || new Set()).has(key);
            }

            if (!shouldAdd) {
              console.log(`Station ${isAutoLoad ? 'out of viewport' : 'deselected'} after load, skipping:`, key);
              loadingKeysRef.current.delete(key);
              return;
            }

            console.log('Model loaded from cache for key:', key);
            
            // Используем оригинальную модель (threebox может переиспользовать её для разных позиций)
            // Устанавливаем позицию с учетом высоты рельефа
            const house = baseModel.setCoords([station.lng, station.lat, elevation]);
            
            // Добавляем модель на карту
            window['tb'].add(house);
            
            // Сохраняем в кэш для быстрого доступа
            modelsByKey.set(key, house);
            
            console.log('Model added via threebox for key:', key, 'at', [station.lng, station.lat, elevation]);
            loadingKeysRef.current.delete(key);
          })
          .catch((error) => {
            console.error('Error loading model for key:', key, error);
            loadingKeysRef.current.delete(key);
          });
      } catch (e) {
        console.error('Failed to load model for key:', key, e);
      } finally {
        loadingKeysRef.current.delete(key);
      }
    }
  }


  function safeClearAllModels() {
    const tb = window['tb'];
    const modelsByKey = modelsByKeyRef.current;

    if (tb) {
      for (const [, tbObject] of modelsByKey.entries()) {
        try {
          tb.remove(tbObject);
        } catch (e) {
          console.error('Error clearing model:', e);
        }
      }
    }

    modelsByKey.clear();
    loadingKeysRef.current.clear();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------- UI ----------
  return (
    <Box
      className="MuiBox-root css-t3625u"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Компонент карты */}
      <MapComponent
        ref={mapComponentRef}
        mapId="terrain-map"
        style="mapbox://styles/mapbox/satellite-streets-v12"
        center={[82.6, 48.5]}
        zoom={6}
        pitch={60}
        bearing={0}
        projection="mercator"
        onMapReady={handleMapReady}
        loadingText={t('terrainMap.loading')}
        mapOptions={{
          antialias: true,
        }}
      />

      {/* Левый сайдбар */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: SIDEBAR_WIDTH,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          transition: 'transform 1s',
          transform: sidebarCollapsed ? `translateX(-${SIDEBAR_WIDTH - 5}px)` : 'translateX(0)',
        }}
      >
        <Paper
          sx={{
            width: '95%',
            height: '95%',
            borderRadius: 2,
            boxShadow: '0 0 50px -25px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            backgroundColor: 'white',
            overflow: 'hidden',
            marginLeft: '20px',
          }}
        >
          {/* Кнопка переключения */}
          <IconButton
            onClick={() => toggleSidebar()}
            sx={{
              position: 'absolute',
              right: sidebarCollapsed ? -40 : -35,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1001,
              backgroundColor: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              width: 32,
              height: 32,
              '&:hover': {
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366F1',
              },
            }}
          >
            {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>

          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 2,
              overflow: 'auto',
            }}
          >
            {/* Фильтры категорий */}
            {stationsData && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('terrainMap.stations')}
                </Typography>

                {stationsData.map((category) => (
                  <FormControlLabel
                    key={category.category.id}
                    control={
                      <Checkbox
                        checked={categoryVisibility[category.category.id] || false}
                        onChange={(e) => {
                          setCategoryVisibility((prev) => ({
                            ...prev,
                            [category.category.id]: e.target.checked,
                          }));
                        }}
                        sx={{
                          color: CATEGORY_COLORS[category.category.id] || '#666',
                          '&.Mui-checked': {
                            color: CATEGORY_COLORS[category.category.id] || '#666',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {category.category.name} ({category.sites.length})
                      </Typography>
                    }
                    sx={{ mb: 0.5 }}
                  />
                ))}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Список станций */}
            {stationsData && (
              <Box sx={{ mt: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('terrainMap.stationsList')}
                </Typography>

                <TextField
                  size="small"
                  placeholder={t('terrainMap.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ mb: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <List
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    mt: 1,
                    '& .MuiListItem-root': { px: 1 },
                  }}
                >
                  {allStations.map((station) => {
                    const stationKey = getStationKey(station); // стабильный ключ
                    const isSelected = selectedStations.has(stationKey);

                    // Для UI разрешаем выбирать любые станции, но 3D будет только для категории 1.
                    const is3DAvailable = station.categoryId === 1;

                    return (
                      <ListItem key={stationKey} disablePadding>
                        <ListItemButton
                          onClick={() => flyToStation(station.longtitude, station.latitude)}
                          sx={{
                            borderRadius: 1,
                            mb: 0.5,
                            '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.08)' },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox
                              disabled={!is3DAvailable}
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedStations((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(stationKey);
                                  else next.delete(stationKey);
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              sx={{
                                color: is3DAvailable
                                  ? (CATEGORY_COLORS[station.categoryId] || '#666')
                                  : 'rgba(0,0,0,0.25)',
                                '&.Mui-checked': {
                                  color: CATEGORY_COLORS[station.categoryId] || '#666',
                                },
                                padding: '4px',
                              }}
                            />
                          </ListItemIcon>

                          <ListItemText
                            primary={station.name}
                            secondary={
                              <Box component="span">
                                <Typography variant="caption" display="block">
                                  {station.code} • {station.siteType?.name ?? ''}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                                >
                                  {station.categoryName}
                                  {!is3DAvailable ? ' • 3D только для категории 1' : ''}
                                </Typography>
                              </Box>
                            }
                            primaryTypographyProps={{
                              variant: 'body2',
                              sx: { fontWeight: 500 },
                            }}
                          />

                          <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary', ml: 1 }} />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}

                  {allStations.length === 0 && (
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}
                    >
                      {t('terrainMap.noStationsFound')}
                    </Typography>
                  )}
                </List>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Сообщение об ошибке */}
      {mapError && (
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            maxWidth: '90%',
            width: 'auto',
          }}
        >
          <Alert severity="error" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              {t('terrainMap.errorTitle')}
            </Typography>
            <Typography variant="body2">{mapError}</Typography>
            <Typography variant="body2" sx={{ mt: 1, fontSize: '0.875rem' }}>
              {t('terrainMap.tokenHint')}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Кнопка приближения к 3D моделям */}
      <Fab
        color="primary"
        aria-label="zoom to 3D models"
        onClick={zoomTo3DModels}
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 1000,
        }}
      >
        <ThreeDRotationIcon />
      </Fab>
    </Box>
  );
}
