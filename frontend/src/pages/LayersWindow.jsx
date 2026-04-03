// frontend/src/components/page/LayersWindow.jsx
// Компонент для отображения карты Mapbox с границами Казахстана

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Box,
  Alert,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Typography,
  Button,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LayersIcon from '@mui/icons-material/Layers';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../utils/usePageTitle';
import Map from '../components/map/Map';

// Стилизованное меню
const StyledMenu = styled((props) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
))(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color: 'rgb(55, 65, 81)',
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    zIndex: '9999 !important',
    position: 'fixed',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
        ...theme.applyStyles('dark', {
          color: 'inherit',
        }),
      },
      '&:active': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity,
        ),
      },
    },
    ...theme.applyStyles('dark', {
      color: theme.palette.grey[300],
    }),
  },
}));

// Определение структуры слоев
const LAYERS_CONFIG = [
  {
    id: 'kazakhstan',
    name: 'Границы Казахстана',
    url: '/geojson/kazakhstan.geojson',
    fillLayerId: 'kazakhstan-fill',
    lineLayerId: 'kazakhstan-line',
    sourceId: 'kazakhstan',
    fillColor: '#4CAF50',
    lineColor: '#2E7D32'
  },
  {
    id: 'regions',
    name: 'Регионы',
    url: '/geojson/regions.geojson',
    fillLayerId: 'regions-fill',
    lineLayerId: 'regions-line',
    sourceId: 'regions',
    fillColor: '#FF6B6B',
    lineColor: '#C92A2A'
  },
  {
    id: 'waters-ways',
    name: 'Водные пути',
    url: '/geojson/waters_ways.geojson',
    fillLayerId: null,
    lineLayerId: 'waters-ways-line',
    sourceId: 'waters-ways',
    fillColor: null,
    lineColor: '#2196F3'
  }
];

export default function LayersWindow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.layers');
  const mapComponentRef = useRef(null);
  const mapRef = useRef(null);
  const [error, setError] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const userInteractedRef = useRef(false); // Флаг для отслеживания взаимодействия пользователя
  const lastFitBoundsRef = useRef(null); // Сохраняем последние bounds для сравнения
  
  // Причины блокировки движения камеры
  const cameraLockReasonsRef = useRef(new Set());

  const lockCamera = useCallback((reason) => {
    cameraLockReasonsRef.current.add(reason);
  }, []);

  const unlockCamera = useCallback((reason) => {
    cameraLockReasonsRef.current.delete(reason);
  }, []);

  const isCameraLocked = useCallback((reason) => {
    if (!reason) return cameraLockReasonsRef.current.size > 0;
    return cameraLockReasonsRef.current.has(reason);
  }, []);
  const [layersEnabled, setLayersEnabled] = useState({
    'kazakhstan': true,
    'regions': false,
    'waters-ways': false
  });
  const [layersData, setLayersData] = useState({});
  const [expandedAccordion, setExpandedAccordion] = useState(null);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [layerFeatures, setLayerFeatures] = useState({}); // Хранит список объектов для каждого слоя
  const [enabledFeatures, setEnabledFeatures] = useState({}); // Хранит включенные объекты для каждого слоя
  const [addLayerDialogOpen, setAddLayerDialogOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerFile, setNewLayerFile] = useState(null);
  const [customLayers, setCustomLayers] = useState([]); // Хранит пользовательские слои
  const [mapProjection, setMapProjection] = useState('mercator');
  const [mapStyle, setMapStyle] = useState('streets-v12');
  
  // Состояния для меню слоев
  const [layerMenuAnchor, setLayerMenuAnchor] = useState(null);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameLayerName, setRenameLayerName] = useState('');
  const [originalLayerName, setOriginalLayerName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [featurePropertiesDialogOpen, setFeaturePropertiesDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedFeatureLayerId, setSelectedFeatureLayerId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Закрываем аккордеон при открытии любого диалога или меню
  useEffect(() => {
    const isOverlayOpen =
      renameDialogOpen ||
      deleteConfirmOpen ||
      propertiesDialogOpen ||
      featurePropertiesDialogOpen ||
      addLayerDialogOpen ||
      Boolean(layerMenuAnchor);

    if (isOverlayOpen) {
      lockCamera('overlay');
      setExpandedAccordion(null);
    } else {
      unlockCamera('overlay');
    }
  }, [
    renameDialogOpen,
    deleteConfirmOpen,
    propertiesDialogOpen,
    featurePropertiesDialogOpen,
    addLayerDialogOpen,
    layerMenuAnchor,
    lockCamera,
    unlockCamera
  ]);

  // Закрываем панель слоев при открытии любого диалога (но не меню)
  useEffect(() => {
    if (renameDialogOpen || deleteConfirmOpen || propertiesDialogOpen || featurePropertiesDialogOpen || addLayerDialogOpen) {
      setLayersPanelOpen(false);
    }
  }, [renameDialogOpen, deleteConfirmOpen, propertiesDialogOpen, featurePropertiesDialogOpen, addLayerDialogOpen]);

  // Загрузка настроек карты пользователя
  useEffect(() => {
    const loadUserMapSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/auth/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          if (userData.default_map_style) {
            setMapStyle(userData.default_map_style);
            // Применяем стиль к карте, если она уже загружена
            if (mapRef.current && mapRef.current.loaded()) {
              try {
                const style = `mapbox://styles/mapbox/${userData.default_map_style}`;
                mapRef.current.setStyle(style);
              } catch (e) {
                console.warn('Could not set map style:', e);
              }
            }
          }
          if (userData.default_map_projection) {
            setMapProjection(userData.default_map_projection);
            // Применяем проекцию к карте, если она уже загружена
            if (mapRef.current && mapRef.current.loaded()) {
              try {
                mapRef.current.setProjection(userData.default_map_projection);
              } catch (e) {
                console.warn('Could not set projection:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading user map settings:', error);
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
  }, []);

  // Функция для вычисления bounds из GeoJSON
  const calculateBounds = (geojsonData) => {
    if (!geojsonData || !geojsonData.features?.length) return null;

    const bounds = new mapboxgl.LngLatBounds();

    const extendFromCoords = (coords) => {
      if (!coords) return;

      // координата-пара [lng, lat]
      if (Array.isArray(coords) && coords.length >= 2 &&
          typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        bounds.extend([coords[0], coords[1]]);
        return;
      }

      // массивы глубже — рекурсивно
      if (Array.isArray(coords)) {
        coords.forEach(extendFromCoords);
      }
    };

    const extendFromGeometry = (geom) => {
      if (!geom) return;

      if (geom.type === 'GeometryCollection') {
        geom.geometries?.forEach(extendFromGeometry);
        return;
      }

      extendFromCoords(geom.coordinates);
    };

    try {
      geojsonData.features.forEach((f) => extendFromGeometry(f.geometry));
    } catch (e) {
      console.warn('calculateBounds failed:', e);
      return null;
    }

    return bounds.isEmpty() ? null : bounds;
  };

  // Функция для вычисления приблизительной площади bounds
  const calculateBoundsArea = (bounds) => {
    if (!bounds) return 0;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    // Приблизительная площадь через разницу координат
    const latDiff = ne.lat - sw.lat;
    const lngDiff = ne.lng - sw.lng;
    // Учитываем, что на разных широтах один градус имеет разную длину
    const avgLat = (ne.lat + sw.lat) / 2;
    const latMeters = latDiff * 111320; // метры на градус широты
    const lngMeters = lngDiff * 111320 * Math.cos(avgLat * Math.PI / 180);
    return latMeters * lngMeters;
  };

  // Функция для определения, является ли слой маленьким
  const isSmallLayer = (bounds) => {
    if (!bounds) return false;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const latDiff = Math.abs(ne.lat - sw.lat);
    const lngDiff = Math.abs(ne.lng - sw.lng);
    // Считаем слой маленьким, если разница координат меньше 5 градусов
    return latDiff < 5 && lngDiff < 5;
  };

  // Функция для центрирования карты на слое с учетом его размера
  const centerOnLayer = useCallback((layerId, { force = false } = {}) => {
    const map = mapRef.current;
    if (!map || !layersData[layerId]) return;

    // Никогда не двигаем камеру, если открыт overlay
    if (isCameraLocked('overlay')) return;

    // Если это автоцентрирование (force=false), и пользователь уже двигал карту — не двигаем
    if (!force && isCameraLocked('user')) return;

    const bounds = calculateBounds(layersData[layerId]);
    console.log('centerOnLayer', layerId, { force }, bounds && bounds.toArray());
    if (!bounds) return;

    const small = isSmallLayer(bounds);
    // const config = LAYERS_CONFIG.find(l => l.id === layerId);
    
    // Для маленьких слоев используем больший zoom, для больших - меньший
    // Для Казахстана (самый большой) используем еще меньший zoom
    let maxZoom, padding;
    if (layerId === 'kazakhstan') {
      maxZoom = 5;
      padding = 50;
    } else if (small) {
      maxZoom = 12;
      padding = 30;
    } else {
      maxZoom = 8;
      padding = 50;
    }

    // Обновляем последние bounds при явном центрировании
    const boundsKey = `${layerId}-${bounds.getSouthWest().lng}-${bounds.getSouthWest().lat}-${bounds.getNorthEast().lng}-${bounds.getNorthEast().lat}`;
    lastFitBoundsRef.current = boundsKey;

    map.fitBounds(bounds, {
      padding,
      maxZoom,
      duration: 500
    });
  }, [layersData]);

  // Функция для загрузки GeoJSON слоя
  const loadLayer = async (map, config) => {
    try {
      const response = await fetch(config.url);
      if (!response.ok) {
        console.warn(`Не удалось загрузить ${config.name}:`, response.statusText);
        return null;
      }
      
      const geojsonData = await response.json();
      
      // Извлекаем названия объектов из GeoJSON
      const features = geojsonData.features || [];
      const featureNames = features
        .map((feature, index) => {
          const props = feature.properties || {};
          
          // Пробуем разные варианты названий (только поля с названиями, не id)
          // Ищем реальное название, не используем id или @id
          const name = props.name || props.Name || props.NAME || 
                       props['name:ru'] || props['name:kk'] || 
                       props['addr:region'] || props['addr:district'] || null;
          
          // Пропускаем объекты без названия (только с id)
          if (!name) {
            return null;
          }
          
          // Сохраняем оригинальное значение для фильтрации (только поля с названиями)
          const originalName = props.name || props['name:ru'] || props['name:kk'] || props['addr:region'] || props['addr:district'] || name;
          
          return { 
            name, 
            originalName,
            index, 
            featureId: feature.id || index,
            properties: props
          };
        })
        .filter(item => item !== null) // Убираем объекты без названий
        .filter((item, index, self) => 
          // Убираем дубликаты по имени
          index === self.findIndex(t => t.name === item.name)
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Сохраняем список объектов для слоя
      setLayerFeatures(prev => ({ ...prev, [config.id]: featureNames }));
      
      // Инициализируем все объекты как включенные
      setEnabledFeatures(prev => {
        const newState = { ...prev };
        if (!newState[config.id]) {
          newState[config.id] = {};
          featureNames.forEach(item => {
            newState[config.id][item.name] = true;
          });
        }
        return newState;
      });
      
      // Добавляем источник данных
      if (map.getSource(config.sourceId)) {
        map.getSource(config.sourceId).setData(geojsonData);
      } else {
        map.addSource(config.sourceId, {
          type: 'geojson',
          data: geojsonData
        });
      }

      // Добавляем слои в правильном порядке, чтобы они не мешали друг другу
      // Порядок: сначала fill-слои (полигоны), затем line-слои (контуры)
      // Находим последний добавленный fill-слой для правильного порядка
      // const allFillLayers = LAYERS_CONFIG
      //   .filter(c => c.fillLayerId && map.getLayer(c.fillLayerId))
      //   .map(c => c.fillLayerId);
      const allLineLayers = LAYERS_CONFIG
        .filter(c => c.lineLayerId && map.getLayer(c.lineLayerId))
        .map(c => c.lineLayerId);
      
      // Добавляем слой для полигонов (fill), если он есть
      if (config.fillLayerId && !map.getLayer(config.fillLayerId)) {
        // Вставляем fill-слой перед первым line-слоем, если он есть
        const beforeId = allLineLayers.length > 0 ? allLineLayers[0] : undefined;
        
        // Определяем видимость слоя на основе начального состояния
        const isEnabled = layersEnabled[config.id] === true;
        
        const fillLayerObj = {
          id: config.fillLayerId,
          type: 'fill',
          source: config.sourceId,
          layout: {
            visibility: isEnabled ? 'visible' : 'none'
          },
          paint: {
            'fill-color': config.fillColor,
            'fill-opacity': config.id === 'kazakhstan' ? 0.3 : (config.id === 'regions' ? 0.4 : 0.35)
          }
        };
        map.addLayer(fillLayerObj, beforeId);
      }

      // Добавляем слой для контуров/линий (line)
      if (config.lineLayerId && !map.getLayer(config.lineLayerId)) {
        // Line-слои добавляем после всех fill-слоев
        // Находим следующий line-слой для правильного порядка
        const currentIndex = LAYERS_CONFIG.findIndex(c => c.id === config.id);
        const nextLineLayer = LAYERS_CONFIG
          .slice(currentIndex + 1)
          .find(c => c.lineLayerId && map.getLayer(c.lineLayerId));
        const beforeId = nextLineLayer ? nextLineLayer.lineLayerId : undefined;
        
        // Определяем видимость слоя на основе начального состояния
        const isEnabled = layersEnabled[config.id] === true;
        
        const lineLayerObj = {
          id: config.lineLayerId,
          type: 'line',
          source: config.sourceId,
          layout: {
            visibility: isEnabled ? 'visible' : 'none'
          },
          paint: {
            'line-color': config.lineColor,
            'line-width': 2,
            'line-opacity': config.id === 'waters-ways' ? 0.8 : 1
          }
        };
        map.addLayer(lineLayerObj, beforeId);
      }

      return geojsonData;
    } catch (err) {
      console.error(`Ошибка загрузки ${config.name}:`, err);
      return null;
    }
  };

  // Функция для обновления фильтра слоя на основе включенных объектов
  const updateLayerFilter = useCallback((layerId) => {
    const map = mapRef.current;
    if (!map) return;

    // Ищем конфигурацию в предопределенных или пользовательских слоях
    const config = LAYERS_CONFIG.find(l => l.id === layerId) || 
                   customLayers.find(l => l.id === layerId);
    if (!config) return;

    // Проверяем только конкретный слой, не другие
    // Слой должен быть явно включен (true), иначе скрываем
    const enabled = layersEnabled[layerId] === true;
    const features = layerFeatures[layerId] || [];
    const enabledForLayer = enabledFeatures[layerId] || {};

    // Если слой выключен (галочка снята), полностью скрываем его
    if (!enabled) {
      if (config.fillLayerId && map.getLayer(config.fillLayerId)) {
        map.setLayoutProperty(config.fillLayerId, 'visibility', 'none');
        // Также убираем фильтр, чтобы не было конфликтов
        map.setFilter(config.fillLayerId, null);
      }
      if (config.lineLayerId && map.getLayer(config.lineLayerId)) {
        map.setLayoutProperty(config.lineLayerId, 'visibility', 'none');
        // Также убираем фильтр, чтобы не было конфликтов
        map.setFilter(config.lineLayerId, null);
      }
      return;
    }

    // Если слой включен (галочка стоит), показываем его
    // Формируем фильтр для включенных объектов
    const enabledItems = features
      .filter(item => enabledForLayer[item.name] !== false);
    
    const enabledNames = enabledItems.map(item => item.originalName || item.name);

    // Создаем фильтр для Mapbox
    let filter;
    let shouldHideLayer = false;
    
    // Если данные еще не загружены (features пуст), показываем все (без фильтра)
    if (features.length === 0) {
      filter = null; // Показываем все, пока данные не загружены
    } else if (enabledNames.length === 0) {
      // Если ничего не включено и данные загружены, скрываем весь слой
      // Проверяем, что enabledFeatures инициализирован (не пустой объект)
      // Если это просто не инициализировано, показываем все
      const hasInitializedFeatures = Object.keys(enabledForLayer).length > 0;
      if (hasInitializedFeatures) {
        // Все объекты были явно выключены - скрываем слой
        shouldHideLayer = true;
      filter = ['literal', false];
      } else {
        // enabledFeatures еще не инициализирован - показываем все
        filter = null;
      }
    } else if (enabledNames.length === features.length) {
      // Если все включены, убираем фильтр
      filter = null;
    } else {
      // Фильтруем по названию (пробуем разные варианты полей)
      filter = [
        'any',
        ['in', ['get', 'name'], ['literal', enabledNames]],
        ['in', ['get', 'name:ru'], ['literal', enabledNames]],
        ['in', ['get', 'name:kk'], ['literal', enabledNames]],
        ['in', ['get', 'addr:region'], ['literal', enabledNames]],
        ['in', ['get', 'addr:district'], ['literal', enabledNames]]
      ];
    }

    // Применяем фильтр и управляем видимостью слоя
    if (config.fillLayerId && map.getLayer(config.fillLayerId)) {
      if (filter === null) {
        map.setFilter(config.fillLayerId, null);
      } else {
        map.setFilter(config.fillLayerId, filter);
      }
      // Если все дочерние чекбоксы сняты, скрываем слой
      if (shouldHideLayer) {
        map.setLayoutProperty(config.fillLayerId, 'visibility', 'none');
      } else {
        // Иначе показываем слой
      map.setLayoutProperty(config.fillLayerId, 'visibility', 'visible');
        // Дополнительно убеждаемся, что слой виден после применения фильтра
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getLayer(config.fillLayerId)) {
            mapRef.current.setLayoutProperty(config.fillLayerId, 'visibility', 'visible');
          }
        }, 10);
      }
    }
    if (config.lineLayerId && map.getLayer(config.lineLayerId)) {
      if (filter === null) {
        map.setFilter(config.lineLayerId, null);
      } else {
        map.setFilter(config.lineLayerId, filter);
      }
      // Если все дочерние чекбоксы сняты, скрываем слой
      if (shouldHideLayer) {
        map.setLayoutProperty(config.lineLayerId, 'visibility', 'none');
      } else {
        // Иначе показываем слой
      map.setLayoutProperty(config.lineLayerId, 'visibility', 'visible');
        // Дополнительно убеждаемся, что слой виден после применения фильтра
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getLayer(config.lineLayerId)) {
            mapRef.current.setLayoutProperty(config.lineLayerId, 'visibility', 'visible');
    }
        }, 10);
      }
    }
  }, [layersEnabled, layerFeatures, enabledFeatures, customLayers]);

  // Функция для переключения видимости слоя
  const toggleLayer = useCallback((layerId, enabled, shouldCenter = false) => {
    const map = mapRef.current;
    if (!map) return;

    // Ищем конфигурацию в предопределенных или пользовательских слоях
    const config = LAYERS_CONFIG.find(l => l.id === layerId) || 
                   customLayers.find(l => l.id === layerId);
    if (!config) return;

    // Если слой включается, перемещаем его поверх других слоев
    if (enabled) {
      // Перемещаем fill-слой поверх всех других fill-слоев
    if (config.fillLayerId && map.getLayer(config.fillLayerId)) {
        // Находим первый line-слой, чтобы переместить fill-слой перед ним (но после других fill-слоев)
        const allLineLayers = [...LAYERS_CONFIG, ...customLayers]
          .filter(c => c.lineLayerId && map.getLayer(c.lineLayerId))
          .map(c => c.lineLayerId);
        
        // Перемещаем fill-слой перед первым line-слоем (если есть), иначе в конец
        const beforeId = allLineLayers.length > 0 ? allLineLayers[0] : undefined;
        
        try {
          map.moveLayer(config.fillLayerId, beforeId);
        } catch (e) {
          console.warn('Не удалось переместить fill-слой:', e);
        }
      }
      
      // Перемещаем line-слой поверх всех других line-слоев (в конец списка line-слоев)
    if (config.lineLayerId && map.getLayer(config.lineLayerId)) {
        try {
          // Перемещаем в конец (без beforeId)
          map.moveLayer(config.lineLayerId);
        } catch (e) {
          console.warn('Не удалось переместить line-слой:', e);
        }
      }
    }

    // Немедленно применяем видимость для конкретного слоя
    const setLayerVisibility = (layerId, isVisible) => {
      if (!layerId || !map.getLayer(layerId)) return;
      const visibility = isVisible ? 'visible' : 'none';
      map.setLayoutProperty(layerId, 'visibility', visibility);
      if (isVisible) {
        // При включении слоя сначала убираем фильтр, чтобы показать все данные
        // Затем updateLayerFilter применит правильный фильтр
        map.setFilter(layerId, null);
      } else {
        // Убираем фильтр при скрытии слоя
        map.setFilter(layerId, null);
      }
    };

    setLayerVisibility(config.fillLayerId, enabled);
    setLayerVisibility(config.lineLayerId, enabled);
    
    // Дополнительно убеждаемся, что видимость установлена правильно
    if (enabled) {
      // При включении убеждаемся, что слой виден
      setTimeout(() => {
        if (mapRef.current) {
          if (config.fillLayerId && mapRef.current.getLayer(config.fillLayerId)) {
            mapRef.current.setLayoutProperty(config.fillLayerId, 'visibility', 'visible');
          }
          if (config.lineLayerId && mapRef.current.getLayer(config.lineLayerId)) {
            mapRef.current.setLayoutProperty(config.lineLayerId, 'visibility', 'visible');
          }
        }
      }, 10);
    } else {
      // При выключении убеждаемся, что слой скрыт
      setTimeout(() => {
        if (mapRef.current) {
          setLayerVisibility(config.fillLayerId, false);
          setLayerVisibility(config.lineLayerId, false);
        }
      }, 10);
    }

    setLayersEnabled(prev => {
      const newState = { ...prev, [layerId]: enabled };
      
      // Обновляем фильтр слоя после обновления состояния
      // Если слой выключен, не вызываем updateLayerFilter, так как видимость уже установлена
      if (enabled) {
        // Если enabledFeatures не инициализирован для этого слоя, инициализируем его
        // Это может произойти, если слой был выключен при загрузке
        setEnabledFeatures(prevFeatures => {
          const features = layerFeatures[layerId] || [];
          if (features.length > 0 && (!prevFeatures[layerId] || Object.keys(prevFeatures[layerId] || {}).length === 0)) {
            const newFeatures = { ...prevFeatures };
            newFeatures[layerId] = {};
            features.forEach(item => {
              newFeatures[layerId][item.name] = true;
            });
            return newFeatures;
          }
          return prevFeatures;
        });
        
        // Используем задержку, чтобы состояние успело обновиться
      setTimeout(() => {
          // Сначала убеждаемся, что слой виден
          if (mapRef.current) {
            if (config.fillLayerId && mapRef.current.getLayer(config.fillLayerId)) {
              mapRef.current.setLayoutProperty(config.fillLayerId, 'visibility', 'visible');
            }
            if (config.lineLayerId && mapRef.current.getLayer(config.lineLayerId)) {
              mapRef.current.setLayoutProperty(config.lineLayerId, 'visibility', 'visible');
            }
          }
          // Затем применяем фильтр
        updateLayerFilter(layerId);
          // Если нужно центрировать, центрируем на нем
          if (shouldCenter) {
          setTimeout(() => centerOnLayer(layerId, { force: true }), 100);
        }
        }, 100);
      }

      return newState;
    });
  }, [centerOnLayer, updateLayerFilter, customLayers]);

  // Функция для генерации случайного цвета
  const generateRandomColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Функция для обработки загруженного GeoJSON файла
  const handleAddLayer = async () => {
    if (!newLayerName.trim() || !newLayerFile) {
      setError(t('layersWindow.nameAndFileRequired'));
      return;
    }

    if (!newLayerFile.name.endsWith('.geojson')) {
      setError(t('layersWindow.geojsonFileRequired'));
      return;
    }

    setError(null);

    try {
      // Читаем файл
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(newLayerFile);
      });

      const geojsonData = JSON.parse(fileContent);
      
      if (!geojsonData.type || geojsonData.type !== 'FeatureCollection') {
        setError(t('layersWindow.invalidGeojsonFormat'));
        return;
      }

      const map = mapRef.current;
      if (!map) {
        setError(t('layersWindow.mapNotInitialized'));
        return;
      }

      const fillColor = generateRandomColor();
      const lineColor = generateRandomColor();

      // Определяем, есть ли полигоны в данных
      const hasPolygons = geojsonData.features?.some(f => 
        f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      );
      const hasLines = geojsonData.features?.some(f => 
        f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
      );

      // Сначала сохраняем слой в базу данных, чтобы получить правильный ID
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('layersWindow.authRequiredForSave'));
        return;
      }

      let savedLayer = null;
      try {
        const response = await fetch('/api/custom-layers/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: newLayerName.trim(),
            geojson_data: geojsonData,
            fill_color: hasPolygons ? fillColor : null,
            line_color: lineColor
          })
        });

        if (response.ok) {
          savedLayer = await response.json();
        } else {
          const errorText = await response.text();
          console.error('Ошибка при сохранении слоя в БД:', errorText);
          setError(t('layersWindow.saveLayerError'));
          return;
        }
      } catch (err) {
        console.error('Ошибка при сохранении слоя в БД:', err);
        setError(t('layersWindow.saveLayerError'));
        return;
      }

      // Используем ID из базы данных
      const layerId = `custom-${savedLayer.id}`;
      const sourceId = `custom-source-${savedLayer.id}`;
      const fillLayerId = hasPolygons ? `${layerId}-fill` : null;
      const lineLayerId = hasLines ? `${layerId}-line` : (hasPolygons ? `${layerId}-line` : null);

      // Создаем конфигурацию нового слоя
      const newLayerConfig = {
        id: layerId,
        name: savedLayer.name,
        url: null,
        fillLayerId,
        lineLayerId,
        sourceId,
        fillColor: savedLayer.fill_color || (hasPolygons ? fillColor : null),
        lineColor: savedLayer.line_color || lineColor,
        isCustom: true,
        data: geojsonData,
        dbId: savedLayer.id
      };

      // Обрабатываем данные аналогично loadLayer
      const features = geojsonData.features || [];
      const featureNames = features
        .map((feature, index) => {
          const props = feature.properties || {};
          const name = props.name || props.Name || props.NAME || 
                       props['name:ru'] || props['name:kk'] || 
                       props['addr:region'] || props['addr:district'] || 
                       `Объект ${index + 1}`;
          const originalName = props.name || props['name:ru'] || props['name:kk'] || props['addr:region'] || props['addr:district'] || name;
          return { 
            name, 
            originalName,
            index, 
            featureId: feature.id || index,
            properties: props
          };
        })
        .filter((item, index, self) => 
          index === self.findIndex(t => t.name === item.name)
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      // Сохраняем список объектов для слоя
      setLayerFeatures(prev => ({ ...prev, [layerId]: featureNames }));

      // Инициализируем все объекты как включенные
      setEnabledFeatures(prev => {
        const newState = { ...prev };
        newState[layerId] = {};
        featureNames.forEach(item => {
          newState[layerId][item.name] = true;
        });
        return newState;
      });

      // Добавляем источник данных на карту
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });

      // Добавляем fill-слой, если есть полигоны
      if (fillLayerId) {
        const style = map.getStyle();
        const allLineLayerIds = style.layers
          .filter(l => l.type === 'line')
          .map(l => l.id);
        const beforeId = allLineLayerIds.length > 0 ? allLineLayerIds[0] : undefined;

        const fillLayerObj = {
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          layout: {
            visibility: 'visible' // Новые слои включены по умолчанию
          },
          paint: {
            'fill-color': newLayerConfig.fillColor,
            'fill-opacity': 0.4
          }
        };
        map.addLayer(fillLayerObj, beforeId);
      }

      // Добавляем line-слой
      if (lineLayerId) {
        const lineLayerObj = {
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            visibility: 'visible' // Новые слои включены по умолчанию
          },
          paint: {
            'line-color': newLayerConfig.lineColor,
            'line-width': 2,
            'line-opacity': 1
          }
        };
        map.addLayer(lineLayerObj);
      }

      // Сохраняем данные слоя
      setLayersData(prev => ({ ...prev, [layerId]: geojsonData }));

      // Добавляем слой в список пользовательских слоев
      setCustomLayers(prev => [...prev, newLayerConfig]);

      // Новые слои включены по умолчанию
      setLayersEnabled(prev => ({ ...prev, [layerId]: true }));

      // Применяем фильтр и центрируем карту после обновления состояния
      // Используем достаточно большую задержку, чтобы React успел обновить состояние
      setTimeout(() => {
        // Убеждаемся, что слой виден
        if (fillLayerId && map.getLayer(fillLayerId)) {
          map.setLayoutProperty(fillLayerId, 'visibility', 'visible');
        }
        if (lineLayerId && map.getLayer(lineLayerId)) {
          map.setLayoutProperty(lineLayerId, 'visibility', 'visible');
        }
        // Применяем фильтр (useEffect также применит его автоматически при изменении состояния)
        updateLayerFilter(layerId);
        // Центрируем карту на новом слое (только если пользователь не взаимодействовал с картой)
        if (!userInteractedRef.current) {
          const bounds = calculateBounds(geojsonData);
          if (bounds) {
            const small = isSmallLayer(bounds);
            const maxZoom = small ? 12 : 8;
            const padding = small ? 30 : 50;
            
            // Сохраняем bounds для последующего сравнения
            const boundsKey = `${layerId}-${bounds.getSouthWest().lng}-${bounds.getSouthWest().lat}-${bounds.getNorthEast().lng}-${bounds.getNorthEast().lat}`;
            lastFitBoundsRef.current = boundsKey;
            
            map.fitBounds(bounds, { 
              padding, 
              maxZoom,
              duration: 500
            });
          }
        }
      }, 200);

      // Закрываем диалог и очищаем форму
      setAddLayerDialogOpen(false);
      setNewLayerName('');
      setNewLayerFile(null);
      setError(null);
    } catch (err) {
      console.error('Ошибка при загрузке слоя:', err);
      setError(t('layersWindow.loadingError'));
    }
  };

  // Функция для переключения отдельного объекта
  const toggleFeature = useCallback((layerId, featureName, enabled) => {
    // Проверяем, включен ли материнский слой
    if (!layersEnabled[layerId]) {
      return; // Не позволяем изменять дочерние объекты, если материнский слой отключен
    }
    
    setEnabledFeatures(prev => {
      const newState = {
        ...prev,
        [layerId]: {
          ...prev[layerId],
          [featureName]: enabled
        }
      };
      
      // Обновляем фильтр слоя
      setTimeout(() => updateLayerFilter(layerId), 0);
      
      return newState;
    });
  }, [updateLayerFilter, layersEnabled]);

  // Функция инициализации слоев
  const initializeLayers = useCallback(async (map) => {
    try {
      // Загружаем все GeoJSON слои и собираем данные
      const loadedData = {};
      for (const config of LAYERS_CONFIG) {
        const data = await loadLayer(map, config);
        if (data) {
          loadedData[config.id] = data;
        }
      }

      // Загружаем пользовательские слои из базы данных
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch('/api/custom-layers/', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const savedLayers = await response.json();
                  
                  for (const savedLayer of savedLayers) {
                    const layerId = `custom-${savedLayer.id}`;
                    const sourceId = `custom-source-${savedLayer.id}`;
                    const geojsonData = savedLayer.geojson_data;
                    
                    // Определяем типы геометрии
                    const hasPolygons = geojsonData.features?.some(f => 
                      f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
                    );
                    const hasLines = geojsonData.features?.some(f => 
                      f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
                    );

                    const fillLayerId = hasPolygons ? `${layerId}-fill` : null;
                    const lineLayerId = hasLines ? `${layerId}-line` : (hasPolygons ? `${layerId}-line` : null);

                    // Создаем конфигурацию слоя
                    const layerConfig = {
                      id: layerId,
                      name: savedLayer.name,
                      url: null,
                      fillLayerId,
                      lineLayerId,
                      sourceId,
                      fillColor: savedLayer.fill_color || (hasPolygons ? generateRandomColor() : null),
                      lineColor: savedLayer.line_color || generateRandomColor(),
                      isCustom: true,
                      data: geojsonData,
                      dbId: savedLayer.id
                    };

                    // Добавляем источник данных
                    map.addSource(sourceId, {
                      type: 'geojson',
                      data: geojsonData
                    });

                    // Добавляем fill-слой
                    if (fillLayerId) {
                      const style = map.getStyle();
                      const allLineLayerIds = style.layers
                        .filter(l => l.type === 'line')
                        .map(l => l.id);
                      const beforeId = allLineLayerIds.length > 0 ? allLineLayerIds[0] : undefined;

                      const fillLayerObj = {
                        id: fillLayerId,
                        type: 'fill',
                        source: sourceId,
                        layout: {
                          visibility: 'none'
                        },
                        paint: {
                          'fill-color': layerConfig.fillColor,
                          'fill-opacity': 0.4
                        }
                      };
                      map.addLayer(fillLayerObj, beforeId);
                    }

                    // Добавляем line-слой
                    if (lineLayerId) {
                      const lineLayerObj = {
                        id: lineLayerId,
                        type: 'line',
                        source: sourceId,
                        layout: {
                          visibility: 'none'
                        },
                        paint: {
                          'line-color': layerConfig.lineColor,
                          'line-width': 2,
                          'line-opacity': 1
                        }
                      };
                      map.addLayer(lineLayerObj);
                    }

                    // Обрабатываем объекты слоя
                    const features = geojsonData.features || [];
                    const featureNames = features
                      .map((feature, index) => {
                        const props = feature.properties || {};
                        const name = props.name || props.Name || props.NAME || 
                                     props['name:ru'] || props['name:kk'] || 
                                     props['addr:region'] || props['addr:district'] || 
                                     `Объект ${index + 1}`;
                        const originalName = props.name || props['name:ru'] || props['name:kk'] || props['addr:region'] || props['addr:district'] || name;
                        return { 
                          name, 
                          originalName,
                          index, 
                          featureId: feature.id || index,
                          properties: props
                        };
                      })
                      .filter((item, index, self) => 
                        index === self.findIndex(t => t.name === item.name)
                      )
                      .sort((a, b) => a.name.localeCompare(b.name));

                    setLayerFeatures(prev => ({ ...prev, [layerId]: featureNames }));

                    setEnabledFeatures(prev => {
                      const newState = { ...prev };
                      newState[layerId] = {};
                      featureNames.forEach(item => {
                        newState[layerId][item.name] = true;
                      });
                      return newState;
                    });

                    loadedData[layerId] = geojsonData;
                    setCustomLayers(prev => [...prev, layerConfig]);
                    setLayersEnabled(prev => ({ ...prev, [layerId]: false }));
            }
          }
        } catch (err) {
          console.error('Ошибка при загрузке пользовательских слоев:', err);
        }
      }

      // Сохраняем все загруженные данные
      setLayersData(loadedData);

      // Устанавливаем видимость всех слоев согласно текущему состоянию
      // Каждый слой проверяет только свою собственную галочку
      LAYERS_CONFIG.forEach(config => {
        // Проверяем только конкретный слой, не другие
        const isEnabled = layersEnabled[config.id] === true; // Должно быть явно true
        if (config.fillLayerId && map.getLayer(config.fillLayerId)) {
          map.setLayoutProperty(config.fillLayerId, 'visibility', isEnabled ? 'visible' : 'none');
        }
        if (config.lineLayerId && map.getLayer(config.lineLayerId)) {
          map.setLayoutProperty(config.lineLayerId, 'visibility', isEnabled ? 'visible' : 'none');
        }
      });
      
      // Применяем фильтры для всех слоев после загрузки данных
      // Каждый слой проверяет только свою собственную галочку
      setTimeout(() => {
        LAYERS_CONFIG.forEach(config => {
          updateLayerFilter(config.id);
        });
      }, 100);

      // После загрузки всех слоев, находим самый большой включенный и центрируем на нем
      // Используем небольшую задержку, чтобы убедиться, что все слои полностью загружены
      setTimeout(() => {
        // Не центрируем, если пользователь уже взаимодействовал с картой или открыто меню/диалог
        if (isCameraLocked('user') || isCameraLocked('overlay')) return;
        
        const enabledLayers = Object.entries(layersEnabled)
          .filter(([id, enabled]) => enabled === true && loadedData[id])
          .map(([id]) => {
            const config = LAYERS_CONFIG.find(l => l.id === id);
            const bounds = calculateBounds(loadedData[id]);
            const area = calculateBoundsArea(bounds);
            const small = isSmallLayer(bounds);
            return { id, config, bounds, area, small };
          })
          .filter(l => l.bounds !== null)
          .sort((a, b) => b.area - a.area);

        if (enabledLayers.length > 0) {
          const largestLayer = enabledLayers[0];
          
          // Сохраняем bounds для последующего сравнения
          const boundsKey = `${largestLayer.id}-${largestLayer.bounds.getSouthWest().lng}-${largestLayer.bounds.getSouthWest().lat}-${largestLayer.bounds.getNorthEast().lng}-${largestLayer.bounds.getNorthEast().lat}`;
          lastFitBoundsRef.current = boundsKey;
          
          let maxZoom, padding;
          if (largestLayer.id === 'kazakhstan') {
            maxZoom = 5;
            padding = 50;
          } else if (largestLayer.small) {
            maxZoom = 12;
            padding = 30;
          } else {
            maxZoom = 8;
            padding = 50;
          }
          map.fitBounds(largestLayer.bounds, { 
            padding, 
            maxZoom,
            duration: 0
          });
        } else if (loadedData['kazakhstan']) {
          // Если нет включенных слоев, но есть данные Казахстана, центрируем на нем
          const bounds = calculateBounds(loadedData['kazakhstan']);
          if (bounds) {
            const boundsKey = `kazakhstan-${bounds.getSouthWest().lng}-${bounds.getSouthWest().lat}-${bounds.getNorthEast().lng}-${bounds.getNorthEast().lat}`;
            lastFitBoundsRef.current = boundsKey;
            
            map.fitBounds(bounds, { 
              padding: 50, 
              maxZoom: 5,
              duration: 0
            });
          }
        }
      }, 200);

      setMapInitialized(true);
    } catch (err) {
      console.error('Ошибка при загрузке GeoJSON:', err);
      setMapInitialized(true);
    }
  }, [layersEnabled, updateLayerFilter, calculateBounds, calculateBoundsArea, isSmallLayer, loadLayer, isCameraLocked]);

  // Обработчик готовности карты
  const handleMapReady = useCallback(async (map) => {
    if (!map) return;
    
    setError(null);
    mapRef.current = map;

    // Отслеживаем взаимодействие пользователя с картой
    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      lockCamera('user'); // блокируем авто-камеру после реального действия пользователя
    };
    // Отслеживаем начало взаимодействия
    map.on('dragstart', handleUserInteraction);
    map.on('zoomstart', handleUserInteraction);
    map.on('rotatestart', handleUserInteraction);
    map.on('pitchstart', handleUserInteraction);
    // Также отслеживаем окончание взаимодействия для надежности
    map.on('dragend', handleUserInteraction);
    map.on('zoomend', handleUserInteraction);

    try {
      // Ждем загрузки карты
      if (!map.loaded()) {
        map.once('load', () => initializeLayers(map));
      } else {
        await initializeLayers(map);
      }
    } catch (err) {
      console.error('Error initializing layers:', err);
      setError(t('layersWindow.initLayersError'));
    }
  }, [initializeLayers, lockCamera]);

  // Обновляем фильтры при изменении включенных объектов
  useEffect(() => {
    if (!mapInitialized || !mapRef.current) return;
    
    // Используем небольшую задержку, чтобы убедиться, что все состояния обновлены
    const timeoutId = setTimeout(() => {
      [...LAYERS_CONFIG, ...customLayers].forEach(config => {
        // Обновляем фильтр только для включенных слоев
        // Для выключенных слоев видимость уже установлена в toggleLayer
        if (layersEnabled[config.id] === true) {
          // Проверяем, что данные загружены перед применением фильтра
          const features = layerFeatures[config.id] || [];
          if (features.length > 0 || layersData[config.id]) {
      updateLayerFilter(config.id);
          }
        }
    });
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [layerFeatures, enabledFeatures, layersEnabled, mapInitialized, updateLayerFilter, layersData, customLayers]);

  // Обновляем центрирование при изменении включенных слоев
  useEffect(() => {
    if (!mapInitialized || !mapRef.current || Object.keys(layersData).length === 0) return;

    // Если пользователь двигал карту — автоцентрирование не делаем
    if (isCameraLocked('user')) return;

    // Если открыт overlay — автоцентрирование не делаем
    if (isCameraLocked('overlay')) return;

    const enabledLayers = Object.entries(layersEnabled)
      .filter(([id, enabled]) => enabled && layersData[id])
      .map(([id]) => {
        const config = LAYERS_CONFIG.find(l => l.id === id) || 
                       customLayers.find(l => l.id === id);
        const bounds = calculateBounds(layersData[id]);
        const area = calculateBoundsArea(bounds);
        const small = isSmallLayer(bounds);
        return { id, config, bounds, area, small };
      })
      .filter(l => l.bounds !== null)
      .sort((a, b) => b.area - a.area);

    if (enabledLayers.length > 0) {
      const largestLayer = enabledLayers[0];
      
      // Проверяем, изменились ли bounds по сравнению с последним вызовом
      const boundsKey = `${largestLayer.id}-${largestLayer.bounds.getSouthWest().lng}-${largestLayer.bounds.getSouthWest().lat}-${largestLayer.bounds.getNorthEast().lng}-${largestLayer.bounds.getNorthEast().lat}`;
      if (lastFitBoundsRef.current === boundsKey) {
        return; // Bounds не изменились, не нужно перемещать камеру
      }
      lastFitBoundsRef.current = boundsKey;
      
      let maxZoom, padding;
      if (largestLayer.id === 'kazakhstan') {
        maxZoom = 5;
        padding = 50;
      } else if (largestLayer.small) {
        maxZoom = 12;
        padding = 30;
      } else {
        maxZoom = 8;
        padding = 50;
      }
      mapRef.current.fitBounds(largestLayer.bounds, { 
        padding, 
        maxZoom,
        duration: 500
      });
    }
  }, [layersEnabled, layersData, mapInitialized, customLayers, isCameraLocked]);

  // Обработчик открытия меню слоя
  const handleLayerMenuOpen = (event, layerId) => {
    event.stopPropagation();

    // Временно блокируем движение камеры, пока открыт overlay
    lockCamera('overlay');

    setExpandedAccordion(null);
    setLayerMenuAnchor(event.currentTarget);
    setSelectedLayerId(layerId);
  };

  // Обработчик закрытия меню слоя
  const handleLayerMenuClose = () => {
    setLayerMenuAnchor(null);
    setSelectedLayerId(null);
    setExpandedAccordion(null); // Закрываем аккордеон при закрытии меню
    // Эффект из шага 2 сам снимет overlay-лок, когда anchor станет null
  };

  // Обработчик переименования слоя
  const handleRenameClick = () => {
    if (!selectedLayerId) return;
    const config = LAYERS_CONFIG.find(l => l.id === selectedLayerId) || 
                   customLayers.find(l => l.id === selectedLayerId);
    if (config) {
      setRenameLayerName(config.name);
      setOriginalLayerName(config.name);
      setRenameError('');
      setExpandedAccordion(null); // Закрываем аккордеон при открытии диалога
      setRenameDialogOpen(true);
    }
    handleLayerMenuClose();
  };

  // Сохранение переименованного слоя
  const handleRenameSave = async () => {
    if (!selectedLayerId || !renameLayerName.trim()) {
      setRenameError('');
      return;
    }
    
    const config = customLayers.find(l => l.id === selectedLayerId);
    if (!config || !config.dbId) {
      // Предопределенные слои нельзя переименовать
      setRenameDialogOpen(false);
      return;
    }

    // Проверка на дубликаты имен
    const trimmedName = renameLayerName.trim();
    const nameExists = [...LAYERS_CONFIG, ...customLayers].some(layer => 
      layer.id !== selectedLayerId && layer.name === trimmedName
    );

    if (nameExists) {
      setRenameError('Слой с таким именем уже существует');
      return;
    }

    setRenameError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setRenameError('Требуется авторизация');
        return;
      }

      const response = await fetch(`/api/custom-layers/${config.dbId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: trimmedName
        })
      });

      if (response.ok) {
        // Обновляем локальное состояние
        setCustomLayers(prev => prev.map(layer => 
          layer.id === selectedLayerId ? { ...layer, name: trimmedName } : layer
        ));
        setRenameDialogOpen(false);
        setRenameLayerName('');
        setOriginalLayerName('');
        setRenameError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400 && errorData.detail && errorData.detail.includes('name')) {
          setRenameError('Слой с таким именем уже существует');
        } else {
          setRenameError('Ошибка при переименовании слоя');
        }
      }
    } catch (err) {
      console.error('Ошибка при переименовании слоя:', err);
      setRenameError('Ошибка при переименовании слоя');
    }
  };

  // Обработчик редактирования слоя
  const handleEditClick = () => {
    if (!selectedLayerId) return;
    handleLayerMenuClose();
    // Переход на страницу редактирования слоя
    navigate(`/app/layers/draw?layerId=${selectedLayerId}`);
  };

  // Обработчик удаления слоя
  const handleDeleteClick = () => {
    const layerIdToDelete = selectedLayerId;
    handleLayerMenuClose();
    setSelectedLayerId(layerIdToDelete);
    setExpandedAccordion(null); // Закрываем аккордеон при открытии диалога
    setDeleteConfirmOpen(true);
  };

  // Подтверждение удаления слоя
  const handleDeleteConfirm = async () => {
    if (!selectedLayerId) return;

    const config = customLayers.find(l => l.id === selectedLayerId);
    if (!config || !config.dbId) {
      // Предопределенные слои нельзя удалить
      setDeleteConfirmOpen(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('layersWindow.authRequired'));
        setDeleteConfirmOpen(false);
        return;
      }

      const response = await fetch(`/api/custom-layers/${config.dbId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok || response.status === 204) {
        // Удаляем слой с карты
        const map = mapRef.current;
        if (map) {
          if (config.fillLayerId && map.getLayer(config.fillLayerId)) {
            map.removeLayer(config.fillLayerId);
          }
          if (config.lineLayerId && map.getLayer(config.lineLayerId)) {
            map.removeLayer(config.lineLayerId);
          }
          if (config.sourceId && map.getSource(config.sourceId)) {
            map.removeSource(config.sourceId);
          }
        }

        // Удаляем из локального состояния
        setCustomLayers(prev => prev.filter(layer => layer.id !== selectedLayerId));
        setLayersEnabled(prev => {
          const newState = { ...prev };
          delete newState[selectedLayerId];
          return newState;
        });
        setLayerFeatures(prev => {
          const newState = { ...prev };
          delete newState[selectedLayerId];
          return newState;
        });
        setEnabledFeatures(prev => {
          const newState = { ...prev };
          delete newState[selectedLayerId];
          return newState;
        });
        setLayersData(prev => {
          const newState = { ...prev };
          delete newState[selectedLayerId];
          return newState;
        });
        
        setDeleteConfirmOpen(false);
      } else {
        setError(t('layersWindow.deleteLayerError'));
      }
    } catch (err) {
      console.error('Ошибка при удалении слоя:', err);
      setError(t('layersWindow.deleteLayerError'));
    }
  };

  // Обработчик открытия диалога свойств
  const handlePropertiesClick = () => {
    // Сохраняем selectedLayerId перед закрытием меню
    const layerIdToShow = selectedLayerId;
    handleLayerMenuClose();
    // Восстанавливаем selectedLayerId для диалога
    setSelectedLayerId(layerIdToShow);
    setExpandedAccordion(null); // Закрываем аккордеон при открытии диалога
    setPropertiesDialogOpen(true);
  };

  // Получение данных слоя для диалога свойств
  const getSelectedLayerConfig = () => {
    if (!selectedLayerId) return null;
    return LAYERS_CONFIG.find(l => l.id === selectedLayerId) || 
           customLayers.find(l => l.id === selectedLayerId);
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      overflow: 'hidden'
    }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1000,
            maxWidth: '400px'
          }}
        >
          {error}
        </Alert>
      )}

      <Map
        ref={mapComponentRef}
        mapId="layers-window-map"
        style={`mapbox://styles/mapbox/${mapStyle}`}
        center={[66.9, 48.0]}
        zoom={5}
        pitch={0}
        bearing={0}
        projection={mapProjection}
        onMapReady={handleMapReady}
        loadingText={t('layersWindow.mapLoading')}
        isLoading={!mapInitialized}
        disableAutoUpdate={true}
      />

      {/* Кнопки управления слоями */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 1,
          pointerEvents: 'auto'
        }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setExpandedAccordion(null); // Закрываем аккордеон при открытии диалога
            setAddLayerDialogOpen(true);
          }}
          sx={{
            boxShadow: 3,
            backgroundColor: '#4CAF50',
            color: 'white',
            '&:hover': {
              backgroundColor: '#45a049'
            }
          }}
        >
          {t('layersWindow.addLayer')}
        </Button>
        
        {/* Раскрывающаяся панель управления слоями */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: 300 }}>
          <Button
            variant="contained"
            startIcon={<LayersIcon />}
            onClick={() => setLayersPanelOpen(!layersPanelOpen)}
            sx={{
              width: '100%',
              boxShadow: 3,
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark'
              }
            }}
          >
            {t('layersWindow.select')}
          </Button>
          <Collapse in={layersPanelOpen} sx={{ width: '100%' }}>
          <Paper
            sx={{
              width: '100%',
              maxHeight: 'calc(100vh - 90px)', // Обновлено для нового расположения кнопок
              overflow: 'visible',
              boxShadow: 3,
              mt: 1,
              zIndex: 1001,
              position: 'relative',
              '& .MuiAccordion-root': {
                position: 'relative',
                zIndex: 1
              }
            }}
          >
            <Box sx={{ p: 2, overflow: 'auto', maxHeight: 'calc(100vh - 90px)', position: 'relative', zIndex: 1 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Управление слоями
              </Typography>
              
              {/* Флаг для проверки открытых диалогов/меню */}
              {(() => {
                const isOverlayOpen =
                  renameDialogOpen ||
                  deleteConfirmOpen ||
                  propertiesDialogOpen ||
                  featurePropertiesDialogOpen ||
                  addLayerDialogOpen ||
                  Boolean(layerMenuAnchor);
                
                return (
                  <>
                    {/* Предопределенные слои */}
              {LAYERS_CONFIG.map((config) => (
                <Accordion
                  key={config.id}
                  expanded={!isOverlayOpen && expandedAccordion === config.id}
                  onChange={(e, isExpanded) => {
                    if (isOverlayOpen) return; // пока открыт диалог/меню — не раскрываем
                    setExpandedAccordion(isExpanded ? config.id : null);
                  }}
                  sx={{ 
                    '&:before': { display: 'none' },
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: 1,
                    '&.Mui-expanded': {
                      zIndex: 1
                    },
                    '& .MuiAccordionSummary-root': {
                      zIndex: 'auto'
                    }
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      px: 2,
                      '& .MuiAccordionSummary-content': { 
                        mr: 0,
                        margin: 0,
                        '&.Mui-expanded': {
                          margin: 0
                        }
                      },
                      '& .MuiAccordionSummary-expandIconWrapper': {
                        mr: 0
                      }
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={layersEnabled[config.id] || false}
                          onChange={(e) => toggleLayer(config.id, e.target.checked, true)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                      label={
                        <Typography
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (layersEnabled[config.id]) {
                              centerOnLayer(config.id, { force: true });
                            }
                          }}
                        >
                          {config.name}
                        </Typography>
                      }
                      onClick={(e) => e.stopPropagation()}
                      sx={{ mr: 0, flex: 1 }}
                    />
                    <Box
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLayerMenuOpen(e, config.id);
                      }}
                      sx={{ 
                        ml: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        cursor: 'pointer',
                        borderRadius: '50%',
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, pb: 1, px: 2, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ width: '100%', maxHeight: 300, overflow: 'auto', position: 'relative', zIndex: 1 }}>
                      {layerFeatures[config.id] && layerFeatures[config.id].length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {layerFeatures[config.id].map((item) => {
                            const isParentEnabled = layersEnabled[config.id] || false;
                            const isFeatureEnabled = enabledFeatures[config.id]?.[item.name] !== false;
                            
                            return (
                              <FormControlLabel
                                key={item.name}
                                control={
                                  <Checkbox
                                    checked={isParentEnabled && isFeatureEnabled}
                                    onChange={(e) => toggleFeature(config.id, item.name, e.target.checked)}
                                    disabled={!isParentEnabled}
                                    size="small"
                                  />
                                }
                                label={
                                  <Typography 
                                    variant="body2" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isParentEnabled) {
                                        setSelectedFeature(item);
                                        setSelectedFeatureLayerId(config.id);
                                        setFeaturePropertiesDialogOpen(true);
                                      }
                                    }}
                                    sx={{ 
                                      fontSize: '0.875rem',
                                      color: isParentEnabled ? 'inherit' : 'text.disabled',
                                      cursor: isParentEnabled ? 'pointer' : 'default',
                                      '&:hover': isParentEnabled ? {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                      } : {}
                                    }}
                                  >
                                    {item.name}
                                  </Typography>
                                }
                                sx={{ mr: 0, width: '100%', justifyContent: 'flex-start' }}
                              />
                            );
                          })}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Загрузка объектов...
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}

              {/* Разделитель для пользовательских слоев */}
              {customLayers.length > 0 && (
                <>
                  <Box sx={{ 
                    mt: 2, 
                    mb: 1, 
                    pt: 2, 
                    borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.5px'
                      }}
                    >
                      Custom layers
                    </Typography>
                  </Box>
                  
                  {customLayers.map((config) => (
                    <Accordion
                      key={config.id}
                      expanded={!isOverlayOpen && expandedAccordion === config.id}
                      onChange={(e, isExpanded) => {
                        if (isOverlayOpen) return; // пока открыт диалог/меню — не раскрываем
                        setExpandedAccordion(isExpanded ? config.id : null);
                      }}
                      sx={{ 
                        '&:before': { display: 'none' },
                        overflow: 'visible',
                        position: 'relative',
                        zIndex: 1,
                        '&.Mui-expanded': {
                          zIndex: 1
                        },
                        '& .MuiAccordionSummary-root': {
                          zIndex: 'auto'
                        }
                      }}
                    >
                      <AccordionSummary 
                        expandIcon={<ExpandMoreIcon />}
                        sx={{ 
                          px: 2,
                          '& .MuiAccordionSummary-content': { 
                            mr: 0,
                            margin: 0,
                            '&.Mui-expanded': {
                              margin: 0
                            }
                          },
                          '& .MuiAccordionSummary-expandIconWrapper': {
                            mr: 0
                          }
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={layersEnabled[config.id] || false}
                              onChange={(e) => toggleLayer(config.id, e.target.checked, true)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                          label={
                            <Typography
                              sx={{ 
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (layersEnabled[config.id]) {
                                  centerOnLayer(config.id, { force: true });
                                }
                              }}
                            >
                              {config.name}
                            </Typography>
                          }
                          onClick={(e) => e.stopPropagation()}
                          sx={{ mr: 0, flex: 1 }}
                        />
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLayerMenuOpen(e, config.id);
                          }}
                          sx={{ 
                            ml: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            cursor: 'pointer',
                            borderRadius: '50%',
                            '&:hover': {
                              backgroundColor: 'action.hover'
                            }
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 1, px: 2, position: 'relative', zIndex: 1 }}>
                        <Box sx={{ width: '100%', maxHeight: 300, overflow: 'auto', position: 'relative', zIndex: 1 }}>
                          {layerFeatures[config.id] && layerFeatures[config.id].length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {layerFeatures[config.id].map((item) => {
                                const isParentEnabled = layersEnabled[config.id] || false;
                                const isFeatureEnabled = enabledFeatures[config.id]?.[item.name] !== false;
                                
                                return (
                                  <FormControlLabel
                                    key={item.name}
                                    control={
                                      <Checkbox
                                        checked={isParentEnabled && isFeatureEnabled}
                                        onChange={(e) => toggleFeature(config.id, item.name, e.target.checked)}
                                        disabled={!isParentEnabled}
                                        size="small"
                                      />
                                    }
                                    label={
                                      <Typography 
                                        variant="body2" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isParentEnabled) {
                                            setSelectedFeature(item);
                                            setSelectedFeatureLayerId(config.id);
                                            setFeaturePropertiesDialogOpen(true);
                                          }
                                        }}
                                        sx={{ 
                                          fontSize: '0.875rem',
                                          color: isParentEnabled ? 'inherit' : 'text.disabled',
                                          cursor: isParentEnabled ? 'pointer' : 'default',
                                          '&:hover': isParentEnabled ? {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                          } : {}
                                        }}
                                      >
                                        {item.name}
                                      </Typography>
                                    }
                                    sx={{ mr: 0, width: '100%', justifyContent: 'flex-start' }}
                                  />
                                );
                              })}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Загрузка объектов...
                            </Typography>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </>
              )}
                  </>
                );
              })()}
            </Box>
          </Paper>
        </Collapse>
        </Box>
      </Box>

      {/* Модальное окно для добавления нового слоя */}
      <Dialog 
        open={addLayerDialogOpen} 
        onClose={() => {
          setAddLayerDialogOpen(false);
          setNewLayerName('');
          setNewLayerFile(null);
          setError(null);
        }}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000, // Высокий z-index для перекрытия всех элементов
              pointerEvents: 'auto', // Явно блокируем взаимодействие
            },
          },
        }}
        sx={{
          zIndex: 10001, // Dialog должен быть выше backdrop
          '& .MuiBackdrop-root': {
            pointerEvents: 'auto', // Блокируем все взаимодействия под backdrop
            zIndex: 10000, // Высокий z-index для перекрытия всех элементов
          },
          '& .MuiDialog-container': {
            zIndex: 10001,
          },
          '& .MuiDialog-paper': {
            zIndex: 10001,
          },
        }}
      >
        <DialogTitle>Добавить новый слой</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Название слоя"
              fullWidth
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              placeholder="Введите название слоя"
            />
            <Box>
              <input
                accept=".geojson"
                style={{ display: 'none' }}
                id="geojson-file-input"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setNewLayerFile(file);
                  }
                }}
              />
              <label htmlFor="geojson-file-input">
                <Button
                  variant="outlined"
                  component="span"
                  fullWidth
                  sx={{ mb: 1 }}
                >
                  {newLayerFile ? newLayerFile.name : 'Выбрать .geojson файл'}
                </Button>
              </label>
              {newLayerFile && (
                <Typography variant="body2" color="text.secondary">
                  Выбран файл: {newLayerFile.name}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button 
            onClick={() => {
              setAddLayerDialogOpen(false);
              setNewLayerName('');
              setNewLayerFile(null);
              setError(null);
            }}
          >
            Отмена
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              onClick={() => {
                setAddLayerDialogOpen(false);
                navigate('/app/layers/draw');
              }}
              variant="outlined"
              startIcon={<EditIcon />}
            >
              Нарисовать слой
            </Button>
            <Button 
              onClick={handleAddLayer}
              variant="contained"
              disabled={!newLayerName.trim() || !newLayerFile}
            >
              Добавить
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Меню слоя */}
      <StyledMenu
        id="layer-menu"
        anchorEl={layerMenuAnchor}
        open={Boolean(layerMenuAnchor)}
        onClose={handleLayerMenuClose}
        onClick={(e) => e.stopPropagation()}
        disablePortal={false}
        slotProps={{
          root: {
            sx: {
              zIndex: 9999,
            }
          },
          list: {
            'aria-labelledby': 'layer-menu-button',
          },
          paper: {
            sx: {
              zIndex: '9999 !important',
              position: 'fixed',
            }
          }
        }}
        MenuListProps={{
          sx: {
            zIndex: 9999,
          }
        }}
        sx={{
          zIndex: 9999,
        }}
      >
        {selectedLayerId && customLayers.find(l => l.id === selectedLayerId) && (
          <>
            <MenuItem onClick={handleRenameClick} disableRipple>
              <DriveFileRenameOutlineIcon />
              <ListItemText>{t('layersWindow.rename')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleEditClick} disableRipple>
              <EditIcon />
              <ListItemText>{t('layersWindow.edit')}</ListItemText>
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handlePropertiesClick} disableRipple>
              <SettingsIcon />
              <ListItemText>{t('layersWindow.properties')}</ListItemText>
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleDeleteClick} disableRipple>
              <DeleteIcon color="error" />
              <ListItemText primaryTypographyProps={{ color: 'error' }}>
                {t('layersWindow.delete')}
              </ListItemText>
            </MenuItem>
          </>
        )}
        {selectedLayerId && LAYERS_CONFIG.find(l => l.id === selectedLayerId) && (
          <>
            <MenuItem onClick={handlePropertiesClick} disableRipple>
              <SettingsIcon />
              <ListItemText>{t('layersWindow.properties')}</ListItemText>
            </MenuItem>
          </>
        )}
      </StyledMenu>

      {/* Диалог переименования */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setRenameLayerName('');
          setOriginalLayerName('');
          setRenameError('');
        }}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000, // Высокий z-index для перекрытия всех элементов
              pointerEvents: 'auto', // Явно блокируем взаимодействие
            },
          },
        }}
        sx={{
          zIndex: 10001, // Dialog должен быть выше backdrop
          '& .MuiBackdrop-root': {
            pointerEvents: 'auto', // Блокируем все взаимодействия под backdrop
            zIndex: 10000, // Высокий z-index для перекрытия всех элементов
          },
          '& .MuiDialog-container': {
            zIndex: 10001,
          },
          '& .MuiDialog-paper': {
            zIndex: 10001,
          },
        }}
      >
        <DialogTitle>{t('layersWindow.renameTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('layersWindow.rename')}
            fullWidth
            variant="outlined"
            value={renameLayerName}
            onChange={(e) => {
              setRenameLayerName(e.target.value);
              if (renameError) {
                setRenameError('');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !renameError) {
                handleRenameSave();
              }
            }}
            error={!!renameError}
            helperText={renameError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRenameDialogOpen(false);
            setRenameLayerName('');
            setOriginalLayerName('');
            setRenameError('');
          }}>
            {t('common.cancel') || 'Отмена'}
          </Button>
          <Button 
            onClick={handleRenameSave} 
            variant="contained"
            disabled={
              !!renameError || 
              !renameLayerName.trim() || 
              (originalLayerName && renameLayerName.trim() === originalLayerName.trim())
            }
          >
            {t('common.save') || 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000, // Высокий z-index для перекрытия всех элементов
              pointerEvents: 'auto', // Явно блокируем взаимодействие
            },
          },
        }}
        sx={{
          zIndex: 10001, // Dialog должен быть выше backdrop
          '& .MuiBackdrop-root': {
            pointerEvents: 'auto', // Блокируем все взаимодействия под backdrop
            zIndex: 10000, // Высокий z-index для перекрытия всех элементов
          },
          '& .MuiDialog-container': {
            zIndex: 10001,
          },
          '& .MuiDialog-paper': {
            zIndex: 10001,
          },
        }}
      >
        <DialogTitle>{t('layersWindow.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('layersWindow.deleteConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            {t('layersWindow.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог свойств слоя */}
      <Dialog
        open={propertiesDialogOpen}
        onClose={() => setPropertiesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000, // Высокий z-index для перекрытия всех элементов
              pointerEvents: 'auto', // Явно блокируем взаимодействие
            },
          },
        }}
        sx={{
          zIndex: 10001, // Dialog должен быть выше backdrop
          '& .MuiBackdrop-root': {
            pointerEvents: 'auto', // Блокируем все взаимодействия под backdrop
            zIndex: 10000, // Высокий z-index для перекрытия всех элементов
          },
          '& .MuiDialog-container': {
            zIndex: 10001,
          },
          '& .MuiDialog-paper': {
            zIndex: 10001,
          },
        }}
      >
        <DialogTitle>{t('layersWindow.propertiesTitle')}</DialogTitle>
        <DialogContent>
          {(() => {
            const config = getSelectedLayerConfig();
            if (!config) return null;
            
            const layerData = layersData[config.id];
            const features = layerFeatures[config.id] || [];
            
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                <TextField
                  label="Название"
                  value={config.name}
                  fullWidth
                  InputProps={{
                    readOnly: true
                  }}
                />
                <TextField
                  label="ID слоя"
                  value={config.id}
                  fullWidth
                  InputProps={{
                    readOnly: true
                  }}
                />
                <TextField
                  label="Количество объектов"
                  value={features.length}
                  fullWidth
                  InputProps={{
                    readOnly: true
                  }}
                />
                {config.fillColor && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography>Цвет заливки:</Typography>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: config.fillColor,
                        border: '1px solid #ccc',
                        borderRadius: 1
                      }}
                    />
                    <Typography>{config.fillColor}</Typography>
                  </Box>
                )}
                {config.lineColor && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography>Цвет линий:</Typography>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: config.lineColor,
                        border: '1px solid #ccc',
                        borderRadius: 1
                      }}
                    />
                    <Typography>{config.lineColor}</Typography>
                  </Box>
                )}
                {layerData && layerData.features && (
                  <TextField
                    label="Общая информация"
                    value={`${layerData.features.length} объектов в коллекции`}
                    fullWidth
                    InputProps={{
                      readOnly: true
                    }}
                  />
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPropertiesDialogOpen(false);
            setSelectedLayerId(null);
          }}>
            {t('common.close') || 'Закрыть'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог свойств объекта (feature) */}
      <Dialog
        open={featurePropertiesDialogOpen}
        onClose={() => {
          setFeaturePropertiesDialogOpen(false);
          setSelectedFeature(null);
          setSelectedFeatureLayerId(null);
        }}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000,
              pointerEvents: 'auto',
            },
          },
        }}
        sx={{
          zIndex: 10001,
          '& .MuiBackdrop-root': {
            pointerEvents: 'auto',
            zIndex: 10000,
          },
          '& .MuiDialog-container': {
            zIndex: 10001,
          },
          '& .MuiDialog-paper': {
            zIndex: 10001,
          },
        }}
      >
        <DialogTitle>
          {selectedFeature ? `Свойства: ${selectedFeature.name}` : 'Свойства объекта'}
        </DialogTitle>
        <DialogContent>
          {selectedFeature && selectedFeatureLayerId ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                label="Название"
                value={selectedFeature.name}
                fullWidth
                InputProps={{
                  readOnly: true
                }}
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Метаданные
              </Typography>
              
              <Box sx={{ 
                maxHeight: '400px', 
                overflow: 'auto',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                borderRadius: 1,
                p: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.02)'
              }}>
                {Object.keys(selectedFeature.properties || {}).length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {Object.entries(selectedFeature.properties).map(([key, value]) => (
                      <Box 
                        key={key}
                        sx={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: 0.5,
                          pb: 1.5,
                          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                          '&:last-child': {
                            borderBottom: 'none',
                            pb: 0
                          }
                        }}
                      >
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 'bold',
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {key}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            wordBreak: 'break-word',
                            fontSize: '0.875rem'
                          }}
                        >
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Метаданные отсутствуют
                  </Typography>
                )}
              </Box>

              {selectedFeatureLayerId && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    label="ID слоя"
                    value={selectedFeatureLayerId}
                    fullWidth
                    InputProps={{
                      readOnly: true
                    }}
                  />
                </Box>
              )}

              {selectedFeature.featureId !== undefined && (
                <TextField
                  label="ID объекта"
                  value={selectedFeature.featureId}
                  fullWidth
                  InputProps={{
                    readOnly: true
                  }}
                />
              )}
            </Box>
          ) : (
            <Typography>Загрузка данных...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setFeaturePropertiesDialogOpen(false);
            setSelectedFeature(null);
            setSelectedFeatureLayerId(null);
          }}>
            {t('common.close') || 'Закрыть'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
