// Страница для создания и редактирования пользовательских слоев на карте

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { MAPBOX_ACCESS_TOKEN } from '../components/map/Map';

const defaultMapboxToken = MAPBOX_ACCESS_TOKEN;
const savedToken = localStorage.getItem('mapbox_access_token') || defaultMapboxToken;
mapboxgl.accessToken = savedToken;

import {
  Box,
  Typography,
  Paper,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  TableContainer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Link,
  InputAdornment,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import {
  RadioButtonUnchecked as PointIcon,
  ShowChart as LineIcon,
  CropFree as PolygonIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Navigation as NavigationIcon,
  Straighten as RulerIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  Home as HomeIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  UnfoldMore as PanIcon,
  LocationOn as LocationOnIcon,
  Timeline as TimelineIcon,
  Star as StarIcon,
  Crop as RectangleIcon,
  RadioButtonUnchecked as CircleIcon,
  Edit as EditIcon,
  CheckBoxOutlineBlank as MultiSelectIcon,
  SelectAll as SelectAllIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../utils/usePageTitle';
import Map from '../components/map/Map';

const DRAWING_MODES = {
  NONE: 'none',
  POINT: 'point',
  LINE: 'line',
  POLYGON: 'polygon',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  SELECT: 'simple_select',
};

/**
 * Вычисляет площадь полигона в квадратных метрах
 * Использует сферическую формулу Гаусса
 */
function calculatePolygonArea(feature) {
  if (!feature || !feature.geometry) return 0;
  
  const geometry = feature.geometry;
  
  if (geometry.type === 'Polygon') {
    const coordinates = geometry.coordinates[0];
    if (coordinates.length < 3) return 0;
    
    let area = 0;
    const R = 6378137;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      
      const lat1 = p1[1] * Math.PI / 180;
      const lon1 = p1[0] * Math.PI / 180;
      const lat2 = p2[1] * Math.PI / 180;
      const lon2 = p2[0] * Math.PI / 180;
      
      area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    
    area = Math.abs(area * R * R / 2);
    return area;
  }
  
  return 0;
}

/**
 * Форматирует площадь в разные единицы измерения
 */
function formatArea(areaM2) {
  return {
    sqMeters: areaM2,
    sqKilometers: areaM2 / 1000000,
    sqFeet: areaM2 * 10.764,
    acres: areaM2 / 4046.86,
    sqMiles: areaM2 / 2589988.11,
  };
}

/**
 * Проверяет, является ли объект объектом карты (Mapbox/Leaflet)
 * для предотвращения циклических ссылок при сериализации
 */
function isMapObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  try {
    if (obj._map !== undefined) {
      return true;
    }
    
    if (obj._leaflet_id !== undefined || obj._mapbox_id !== undefined) {
      return true;
    }
    
    if (obj._controls && Array.isArray(obj._controls)) {
      return true;
    }
    
    const constructorName = obj.constructor?.name || '';
    if (constructorName === 'Map' || constructorName === 'L' || constructorName === 'sl') {
      return true;
    }
    
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Безопасно клонирует объект, исключая циклические ссылки,
 * объекты карты и несериализуемые типы данных
 */
function safeClone(obj, visited = new WeakSet()) {
  try {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (visited.has(obj)) {
      return undefined;
    }
    
    try {
      const objType = Object.prototype.toString.call(obj);
      if (objType === '[object Map]' || objType === '[object Set]') {
        return undefined;
      }
    } catch (e) {
      // Игнорируем ошибки проверки типа
    }
    
    if (typeof obj === 'function') {
      return undefined;
    }
    
    if (isMapObject(obj)) {
      return undefined;
    }
    
    if (obj.constructor && obj.constructor !== Object && obj.constructor !== Array) {
      if (Array.isArray(obj)) {
        visited.add(obj);
        const result = [];
        for (let i = 0; i < obj.length; i++) {
          const cloned = safeClone(obj[i], visited);
          if (cloned !== undefined) {
            result.push(cloned);
          }
        }
        visited.delete(obj);
        return result;
      }
      return undefined;
    }
    
    visited.add(obj);
  
    if (Array.isArray(obj)) {
      const result = [];
      for (let i = 0; i < obj.length; i++) {
        try {
          const item = obj[i];
          if (isMapObject(item)) {
            continue;
          }
          const cloned = safeClone(item, visited);
          if (cloned !== undefined) {
            result.push(cloned);
          }
        } catch (e) {
          continue;
        }
      }
      visited.delete(obj);
      return result;
    }
    
    const result = {};
    for (const key in obj) {
      try {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (key === '_map' || key === '_mapboxFeatureId' || key === '_mapboxFeatureState' ||
              key === '_leaflet_id' || key === '_mapbox_id' || key === '_controls' ||
              key.startsWith('_') && (key.includes('map') || key.includes('leaflet'))) {
            continue;
          }
          
          let value;
          try {
            value = obj[key];
          } catch (e) {
            continue;
          }
          
          if (isMapObject(value)) {
            continue;
          }
          
          const cloned = safeClone(value, visited);
          if (cloned !== undefined) {
            result[key] = cloned;
          }
        }
      } catch (e) {
        // Пропускаем свойства, которые не удалось клонировать
        continue;
      }
    }
    
    visited.delete(obj);
    return result;
  } catch (error) {
    console.warn('Error in safeClone:', error);
    return undefined;
  }
}

/**
 * Безопасно сериализует объект в JSON, удаляя циклические ссылки
 */
function safeStringify(obj, space = null) {
  try {
    const cloned = safeClone(obj);
    if (cloned === undefined || cloned === null) {
      return '{}';
    }
    try {
      return JSON.stringify(cloned, null, space);
    } catch (stringifyError) {
      if (cloned && typeof cloned === 'object') {
        const minimal = {
          id: cloned.id,
          type: cloned.type,
          geometry: cloned.geometry,
          properties: cloned.properties || {}
        };
        return JSON.stringify(minimal, null, space);
      }
      return '{}';
    }
  } catch (error) {
    console.warn('Error stringifying object:', error);
    return '{}';
  }
}

export default function DrawLayer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const layerIdParam = searchParams.get('layerId');
  usePageTitle('pageTitles.drawLayer');
  
  const mapComponentRef = useRef(null);
  const mapRef = useRef(null);
  const [drawingMode, setDrawingMode] = useState(DRAWING_MODES.NONE);
  const [layerName, setLayerName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [drawnFeatures, setDrawnFeatures] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialFeaturesRef = useRef(null);
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [editingLayerName, setEditingLayerName] = useState(null);
  const [replaceOrCopyDialogOpen, setReplaceOrCopyDialogOpen] = useState(false);
  const [copyNameDialogOpen, setCopyNameDialogOpen] = useState(false);
  const [copyLayerName, setCopyLayerName] = useState('');
  const [loadingLayer, setLoadingLayer] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Загрузка слоя...');
  const [mapProjection, setMapProjection] = useState('mercator');
  const [mapStyle, setMapStyle] = useState('streets-v12');
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const activeToolRef = useRef(null);
  const [multiVertexSelectMode, setMultiVertexSelectMode] = useState(false);
  const multiVertexSelectModeRef = useRef(false);
  
  useEffect(() => {
    multiVertexSelectModeRef.current = multiVertexSelectMode;
  }, [multiVertexSelectMode]);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [dialogTab, setDialogTab] = useState(0);
  const [rightSidebarTab, setRightSidebarTab] = useState(0);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [mapboxTokenDialogOpen, setMapboxTokenDialogOpen] = useState(false);
  const [mapboxToken, setMapboxToken] = useState(savedToken);
  const [hoveredFeatureId, setHoveredFeatureId] = useState(null);
  const [editingProperties, setEditingProperties] = useState([]);
  const originalFeatureRef = useRef(null);
  const didSaveRef = useRef(false);
  const currentFeatureRef = useRef(null);
  const [displayedFeaturesCount, setDisplayedFeaturesCount] = useState(9);
  const featuresListRef = useRef(null);
  const colorInputRefsRef = useRef({});
  const drawingPointsRef = useRef([]);
  const geocoderContainerRef = useRef(null);
  const geocoderRef = useRef(null);
  const drawRef = useRef(null);
  const rectangleStartRef = useRef(null);
  const circleCenterRef = useRef(null);
  const isDrawingRectangleRef = useRef(false);
  const isDrawingCircleRef = useRef(false);
  const rectangleHandlersRef = useRef(null);
  const circleHandlersRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const boxSelectionStartRef = useRef(null);
  const isBoxSelectingRef = useRef(false);
  const boxSelectionHandlersRef = useRef(null);
  const selectedFeatureIdRef = useRef(null);
  const editingFeatureIdRef = useRef(null);
  
  const featuresUpdateTimeoutRef = useRef(null);
  const jsonStringCacheRef = useRef({});
  const boundsCacheRef = useRef(null);
  const featuresVersionRef = useRef(0);
  const mapCleanupRef = useRef(() => {});
  
  /**
   * Debounced обновление drawnFeatures для оптимизации производительности
   */
  const updateDrawnFeaturesDebounced = useCallback((features, immediate = false) => {
    try {
      if (featuresUpdateTimeoutRef.current) {
        clearTimeout(featuresUpdateTimeoutRef.current);
      }
    
    const cleanedFeatures = (features || []).map(feature => {
      if (!feature || typeof feature !== 'object') {
        return feature;
      }
      
      const hasMapReferences = feature._map !== undefined || 
                                feature._leaflet_id !== undefined || 
                                feature._mapbox_id !== undefined ||
                                (feature._controls && Array.isArray(feature._controls));
      
      if (!hasMapReferences && feature.type && feature.geometry) {
        if (feature.properties) {
          const hasMapInProps = Object.keys(feature.properties).some(key => 
            key.startsWith('_') && (key.includes('map') || key.includes('leaflet'))
          );
          if (!hasMapInProps) {
            return feature;
          }
        } else {
          return feature;
        }
      }
      
      try {
        const cloned = safeClone(feature);
        if (cloned === undefined || cloned === null) {
          return {
            id: feature.id,
            type: feature.type || 'Feature',
            geometry: safeClone(feature.geometry) || feature.geometry,
            properties: safeClone(feature.properties) || feature.properties || {}
          };
        }
        return cloned;
      } catch (error) {
        console.warn('Error cleaning feature:', error);
        return {
          id: feature.id,
          type: feature.type || 'Feature',
          geometry: feature.geometry,
          properties: feature.properties || {}
        };
      }
    }).filter(f => f !== null && f !== undefined);
    
    if (immediate || !cleanedFeatures || cleanedFeatures.length < 100) {
      featuresVersionRef.current += 1;
      setDrawnFeatures(cleanedFeatures);
      jsonStringCacheRef.current = {};
    } else {
      featuresUpdateTimeoutRef.current = setTimeout(() => {
        featuresVersionRef.current += 1;
        setDrawnFeatures(cleanedFeatures);
        jsonStringCacheRef.current = {};
      }, 150);
    }
    } catch (error) {
      console.warn('Error in updateDrawnFeaturesDebounced:', error);
      setDrawnFeatures([]);
    }
  }, []);
  
  /**
   * Мемоизация JSON строки для оптимизации производительности
   */
  const jsonString = useMemo(() => {
    try {
      const cacheKey = String(featuresVersionRef.current);
      
      if (jsonStringCacheRef.current[cacheKey]) {
        return jsonStringCacheRef.current[cacheKey];
      }
      
      let result;
      if (drawnFeatures.length === 0) {
        result = JSON.stringify({ type: 'FeatureCollection', features: [] }, null, 2);
      } else if (drawnFeatures.length === 1) {
        try {
          result = JSON.stringify(drawnFeatures[0], null, 2);
        } catch (e) {
          result = safeStringify(drawnFeatures[0], 2);
        }
      } else {
        if (drawnFeatures.length > 1000) {
          try {
            result = JSON.stringify({
              type: 'FeatureCollection',
              features: drawnFeatures,
              _note: `Большой файл: ${drawnFeatures.length} объектов. JSON может быть неполным для производительности.`
            }, null, 2);
          } catch (e) {
            result = safeStringify({
              type: 'FeatureCollection',
              features: drawnFeatures,
              _note: `Большой файл: ${drawnFeatures.length} объектов. JSON может быть неполным для производительности.`
            }, 2);
          }
        } else {
          try {
            result = JSON.stringify({
              type: 'FeatureCollection',
              features: drawnFeatures,
            }, null, 2);
          } catch (e) {
            result = safeStringify({
              type: 'FeatureCollection',
              features: drawnFeatures,
            }, 2);
          }
        }
      }
      
      jsonStringCacheRef.current[cacheKey] = result;
      return result;
    } catch (error) {
      console.warn('Error generating JSON string:', error);
      return JSON.stringify({ type: 'FeatureCollection', features: [] }, null, 2);
    }
  }, [drawnFeatures]);
  
  /**
   * Сравнивает два массива features для определения изменений
   */
  const compareFeatures = useCallback((features1, features2) => {
    if (!features1 && !features2) return true;
    if (!features1 || !features2) return false;
    if (features1.length !== features2.length) return false;
    
    if (features1.length <= 100) {
      try {
        return JSON.stringify(features1) === JSON.stringify(features2);
      } catch (e) {
        return false;
      }
    }
    
    try {
      const str1 = JSON.stringify(features1.slice(0, 10));
      const str2 = JSON.stringify(features2.slice(0, 10));
      return str1 === str2;
    } catch (e) {
      return false;
    }
  }, []);
  
  /**
   * Навигация с проверкой несохраненных изменений
   */
  const navigateWithCheck = useCallback((to) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу? Несохраненные изменения будут потеряны.'
      );
      if (!confirmed) {
        return;
      }
    }
    navigate(to);
  }, [hasUnsavedChanges, navigate]);
  
  useEffect(() => {
    if (initialFeaturesRef.current === null && !layerIdParam) {
      initialFeaturesRef.current = [];
      setHasUnsavedChanges(false);
    }
  }, [layerIdParam]);
  
  useEffect(() => {
    if (initialFeaturesRef.current === null) {
      return;
    }
    const hasChanged = !compareFeatures(drawnFeatures, initialFeaturesRef.current);
    setHasUnsavedChanges(hasChanged);
  }, [drawnFeatures, compareFeatures]);
  
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
  
  const visibleFeatures = useMemo(() => {
    return drawnFeatures.slice(0, displayedFeaturesCount);
  }, [drawnFeatures, displayedFeaturesCount]);
  
  const hasMoreFeatures = drawnFeatures.length > displayedFeaturesCount;

  useEffect(() => {
    setDisplayedFeaturesCount(9);
  }, [drawnFeatures.length]);

  useLayoutEffect(() => {
    if (!featuresListRef.current || !hasMoreFeatures || drawnFeatures.length === 0) return;
    
    const container = featuresListRef.current;
    const timeoutId = setTimeout(() => {
      const hasScroll = container.scrollHeight > container.clientHeight;
      
      if (!hasScroll && displayedFeaturesCount < drawnFeatures.length && displayedFeaturesCount < 50) {
        const newCount = Math.min(displayedFeaturesCount + 5, drawnFeatures.length);
        if (newCount > displayedFeaturesCount) {
          setDisplayedFeaturesCount(newCount);
        }
      }
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [displayedFeaturesCount, hasMoreFeatures, drawnFeatures.length]);

  const handleFeaturesListScroll = useCallback((e) => {
    const container = e.currentTarget || e.target;
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom < 100 && hasMoreFeatures) {
      setDisplayedFeaturesCount(prev => {
        const newCount = Math.min(prev + 1, drawnFeatures.length);
        return newCount;
      });
    }
  }, [hasMoreFeatures, drawnFeatures.length]);

  /**
   * Подсвечивает объект и перемещает камеру к нему
   */
  const handleFocusFeature = useCallback((feature) => {
    if (!mapRef.current || !feature || !feature.geometry) return;
    
    const map = mapRef.current;
    const draw = drawRef.current;
    
    let featureToHighlight = feature;
    if (draw && feature.id) {
      const allFeatures = draw.getAll();
      if (allFeatures && allFeatures.features) {
        const foundFeature = allFeatures.features.find(f => f.id === feature.id);
        if (foundFeature) {
          featureToHighlight = foundFeature;
        }
      }
    }
    
    if (featureToHighlight.id) {
      setHoveredFeatureId(featureToHighlight.id);
    }
    
    const bounds = new mapboxgl.LngLatBounds();
    const geometry = featureToHighlight.geometry;
    
    try {
      if (geometry.type === 'Point') {
        bounds.extend(geometry.coordinates);
      } else if (geometry.type === 'LineString') {
        geometry.coordinates.forEach(coord => bounds.extend(coord));
      } else if (geometry.type === 'Polygon') {
        geometry.coordinates[0].forEach(coord => bounds.extend(coord));
      } else if (geometry.type === 'MultiLineString') {
        geometry.coordinates.forEach(line => {
          line.forEach(coord => bounds.extend(coord));
        });
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(polygon => {
          polygon[0].forEach(coord => bounds.extend(coord));
        });
      }
      
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter();
        const currentZoom = map.getZoom();
        
        map.flyTo({
          center: [center.lng, center.lat],
          zoom: Math.min(18, currentZoom + 1),
          duration: 1000,
        });
        
        setTimeout(() => {
          map.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            maxZoom: 18,
          });
        }, 1100);
      }
    } catch (error) {
      console.warn('Ошибка при вычислении границ объекта:', error);
      if (geometry.type === 'Point') {
        map.flyTo({
          center: geometry.coordinates,
          zoom: 15,
          duration: 1500,
        });
      }
    }
  }, []);

  const SIMPLESTYLE_PROPERTIES = [
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'fill',
    'fill-opacity',
    'marker-color',
    'marker-size',
    'marker-symbol'
  ];

  /**
   * Фильтрует properties, оставляя только simplestyle свойства
   */
  const filterSimplestyleProperties = useCallback((properties) => {
    const result = {};
    Object.keys(properties).forEach(key => {
      if (SIMPLESTYLE_PROPERTIES.includes(key.toLowerCase())) {
        result[key] = properties[key];
      }
    });
    return result;
  }, []);

  const RESERVED_FEATURE_KEYS = new Set([
    'type', 'id', 'geometry', 'properties', 'bbox',
    '_mapboxFeatureId', '_mapboxFeatureState'
  ]);

  /**
   * Извлекает все нестандартные поля из корня объекта и properties._rootFields
   */
  const extractRootFieldsForSave = useCallback((feature) => {
    const root = {};

    Object.keys(feature || {}).forEach((k) => {
      if (RESERVED_FEATURE_KEYS.has(k)) return;
      root[k] = feature[k];
    });

    const fromCompat = feature?.properties?._rootFields;
    if (fromCompat && typeof fromCompat === 'object') {
      Object.keys(fromCompat).forEach((k) => {
        if (RESERVED_FEATURE_KEYS.has(k)) return;
        if (!(k in root)) root[k] = fromCompat[k];
      });
    }

    return root;
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('mapbox_access_token');
    if (savedToken) {
      mapboxgl.accessToken = savedToken;
      setMapboxToken(savedToken);
    } else {
      setMapboxToken(defaultMapboxToken);
    }
  }, []);

  const handleSaveMapboxToken = () => {
    if (mapboxToken && mapboxToken.trim()) {
      localStorage.setItem('mapbox_access_token', mapboxToken.trim());
      mapboxgl.accessToken = mapboxToken.trim();
      setMapboxTokenDialogOpen(false);
      if (mapRef.current) {
        const currentStyle = mapRef.current.getStyle();
        if (currentStyle) {
          mapRef.current.setStyle(currentStyle);
        }
      }
    }
  };

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

    const handleMapSettingsUpdate = () => {
      loadUserMapSettings();
    };
    window.addEventListener('mapSettingsUpdated', handleMapSettingsUpdate);

    return () => {
      window.removeEventListener('mapSettingsUpdated', handleMapSettingsUpdate);
    };
  }, []);

  /**
   * Нормализует feature для загрузки в MapboxDraw
   */
  const normalizeFeatureForDraw = useCallback((f) => {
    if (!f || typeof f !== 'object') return null;

    if (f.type === 'FeatureCollection') {
      return { __fc: true, features: Array.isArray(f.features) ? f.features : [] };
    }

    const out = {
      type: 'Feature',
      id: f.id,
      geometry: f.geometry,
      properties: (f.properties && typeof f.properties === 'object') ? f.properties : {},
    };

    if (!out.geometry || !out.geometry.type) return null;
    if (out.geometry.coordinates == null) return null;
    if (Array.isArray(out.geometry.coordinates) && out.geometry.coordinates.length === 0) return null;

    return out;
  }, []);

  // Загрузка слоя для редактирования
  useEffect(() => {
    if (!layerIdParam) return;
    
    let cancelled = false;
    
    const loadLayerForEdit = async () => {
      if (cancelled) return;
      setLoadingLayer(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('Требуется авторизация для загрузки слоя');
          setLoadingLayer(false);
          return;
        }

        const dbId = layerIdParam.replace('custom-', '');
        
        const response = await fetch(`/api/custom-layers/${dbId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const layer = await response.json();
          setEditingLayerId(layer.id);
          setEditingLayerName(layer.name);
          setLayerName(layer.name);
          
          if (layer.geojson_data && layer.geojson_data.features) {
            const draw = drawRef.current;
            if (!draw) {
              console.error('MapboxDraw не инициализирован');
              setLoadingLayer(false);
              return;
            }
            
            const rawFeatures = layer.geojson_data.features;
            
            const normalizedToLoad = [];
            for (const f of rawFeatures) {
              const n = normalizeFeatureForDraw(f);
              if (!n) continue;

              if (n.__fc) {
                for (const ff of n.features) {
                  const nn = normalizeFeatureForDraw(ff);
                  if (nn && !nn.__fc) normalizedToLoad.push(nn);
                }
              } else {
                normalizedToLoad.push(n);
              }
            }
            
            const featureCount = normalizedToLoad.length;
            
            if (featureCount === 0) {
              setLoadingMessage('Слой пустой или не содержит валидных объектов');
              setTimeout(() => {
                if (cancelled) return;
                setLoadingLayer(false);
                setLoadingProgress(0);
                setLoadingMessage('Загрузка слоя...');
              }, 500);
              return;
            }
            
            setLoadingMessage(`Загрузка ${featureCount} объектов...`);
            setLoadingProgress(0);
            
            const allFeatures = draw.getAll();
            if (allFeatures && allFeatures.features && allFeatures.features.length > 0) {
              if (allFeatures.features.length > 100) {
                const deleteBatch = (featuresToDelete, index = 0) => {
                  if (cancelled) return;
                  const batchSize = 50;
                  const batch = featuresToDelete.slice(index, index + batchSize);
                  batch.forEach(feature => {
                    try {
                      draw.delete(feature.id);
                    } catch (e) {
                      // Игнорируем ошибки удаления
                    }
                  });
                  
                  if (index + batchSize < featuresToDelete.length) {
                    requestAnimationFrame(() => deleteBatch(featuresToDelete, index + batchSize));
                  } else {
                    if (!cancelled) loadFeaturesInBatches(normalizedToLoad);
                  }
                };
                deleteBatch(allFeatures.features);
              } else {
                allFeatures.features.forEach(feature => {
                  try {
                    draw.delete(feature.id);
                  } catch (e) {
                    // Игнорируем ошибки удаления
                  }
                });
                if (!cancelled) loadFeaturesInBatches(normalizedToLoad);
              }
            } else {
              if (!cancelled) loadFeaturesInBatches(normalizedToLoad);
            }
            
            function loadFeaturesInBatches(featuresToLoad) {
              const BATCH_SIZE = 100;
              let currentIndex = 0;
              
              const addBatch = () => {
                if (cancelled) return;
                
                const currentDraw = drawRef.current;
                if (!currentDraw) {
                  console.warn('MapboxDraw был удален во время загрузки');
                  if (!cancelled) setLoadingLayer(false);
                  return;
                }
                
                const endIndex = Math.min(currentIndex + BATCH_SIZE, featuresToLoad.length);
                const batch = featuresToLoad.slice(currentIndex, endIndex);
                
                batch.forEach((feature, idx) => {
                  if (cancelled) return;
                  try {
                    const n = normalizeFeatureForDraw(feature);
                    if (!n || n.__fc) return;
                    currentDraw.add(n);
                  } catch (e) {
                    console.warn('Ошибка при добавлении объекта:', currentIndex + idx, feature, e);
                  }
                });
                
                currentIndex = endIndex;
                
                if (!cancelled) {
                  const progress = Math.round((currentIndex / featureCount) * 100);
                  setLoadingProgress(progress);
                  setLoadingMessage(`Загрузка объектов: ${currentIndex}/${featureCount}`);
                }
                
                if (currentIndex < featuresToLoad.length) {
                  if (!cancelled) requestAnimationFrame(addBatch);
                } else {
                  if (cancelled) return;
                  setLoadingMessage('Обработка данных...');
                  setTimeout(() => {
                    if (cancelled) return;
                    const currentDraw = drawRef.current;
                    if (!currentDraw) {
                      console.warn('MapboxDraw был удален во время загрузки');
                      if (!cancelled) setLoadingLayer(false);
                      return;
                    }
                    
                    const updatedFeatures = currentDraw.getAll();
                    const loadedFeatures = (updatedFeatures && updatedFeatures.features) ? updatedFeatures.features : [];
                    
                    if (currentDraw.getMode() !== 'simple_select') {
                      currentDraw.changeMode('simple_select');
                    }
                    
                    updateDrawnFeaturesDebounced(loadedFeatures, true);
                    
                    initialFeaturesRef.current = JSON.parse(JSON.stringify(loadedFeatures));
                    setHasUnsavedChanges(false);
                    
                    if (mapRef.current) {
                      const ensureDrawLayersVisible = () => {
                        if (!mapRef.current || !mapRef.current.getStyle()) return;
                        const style = mapRef.current.getStyle();
                        if (style && style.layers) {
                          style.layers.forEach(layer => {
                            if (layer.id && layer.id.startsWith('gl-draw-') && mapRef.current.getLayer(layer.id)) {
                              try {
                                const v = mapRef.current.getLayoutProperty(layer.id, 'visibility');
                                if (v !== 'visible') {
                                  mapRef.current.setLayoutProperty(layer.id, 'visibility', 'visible');
                                }
                              } catch (e) {
                                // Игнорируем ошибки
                              }
                            }
                          });
                        }
                      };
                      ensureDrawLayersVisible();
                      mapRef.current.triggerRepaint();
                    }
                    
                    if (mapRef.current && updatedFeatures && updatedFeatures.features && updatedFeatures.features.length > 0) {
                      computeBoundsAsync(updatedFeatures.features);
                    }
                    
                    if (!cancelled) {
                      setLoadingLayer(false);
                      setLoadingProgress(0);
                      setLoadingMessage('Загрузка слоя...');
                    }
                  }, 100);
                }
              };
              
              if (!cancelled) addBatch();
            }
            
            function computeBoundsAsync(features) {
              if (cancelled) return;
              const bounds = new mapboxgl.LngLatBounds();
              const BATCH_SIZE = 500;
              let index = 0;
              
              const processBatch = () => {
                if (cancelled) return;
                const endIndex = Math.min(index + BATCH_SIZE, features.length);
                
                for (let i = index; i < endIndex; i++) {
                  const feature = features[i];
                  if (!feature.geometry) continue;
                  
                  try {
                    if (feature.geometry.type === 'Point') {
                      bounds.extend(feature.geometry.coordinates);
                    } else if (feature.geometry.type === 'LineString') {
                      feature.geometry.coordinates.forEach(coord => bounds.extend(coord));
                    } else if (feature.geometry.type === 'Polygon') {
                      feature.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
                    }
                  } catch (e) {
                    // Игнорируем ошибки
                  }
                }
                
                index = endIndex;
                
                if (index < features.length) {
                  if (!cancelled) requestAnimationFrame(processBatch);
                } else {
                  if (!cancelled && !bounds.isEmpty() && mapRef.current) {
                    mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
                  }
                }
              };
              
              if (!cancelled) processBatch();
            }
          } else {
            setLoadingMessage('Слой пустой');
            setTimeout(() => {
              if (!cancelled) {
                setLoadingLayer(false);
                setLoadingProgress(0);
                setLoadingMessage('Загрузка слоя...');
              }
            }, 500);
          }
        } else {
          console.error('Ошибка при загрузке слоя:', response.statusText);
          if (!cancelled) {
            setLoadingLayer(false);
            setLoadingProgress(0);
            setLoadingMessage('Загрузка слоя...');
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке слоя:', error);
        if (!cancelled) {
          setLoadingLayer(false);
          setLoadingProgress(0);
          setLoadingMessage('Загрузка слоя...');
        }
      }
    };

    const checkAndLoad = () => {
      if (cancelled) return;
      if (drawRef.current) {
        loadLayerForEdit();
      } else {
        setTimeout(checkAndLoad, 100);
      }
    };
    
    checkAndLoad();
    
    return () => {
      cancelled = true;
    };
  }, [layerIdParam, normalizeFeatureForDraw]);

  /**
   * Обновляет предпросмотр прямоугольника выделения вершин
   */
  const updateBoxSelectionPreview = useCallback((start, end) => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = [
      [Math.min(start.lng, end.lng), Math.min(start.lat, end.lat)],
      [Math.max(start.lng, end.lng), Math.max(start.lat, end.lat)]
    ];

    const rectangle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds[0][0], bounds[0][1]],
          [bounds[1][0], bounds[0][1]],
          [bounds[1][0], bounds[1][1]],
          [bounds[0][0], bounds[1][1]],
          [bounds[0][0], bounds[0][1]]
        ]]
      }
    };

    const sourceId = 'box-selection-preview';
    const source = map.getSource(sourceId);
    
    if (source) {
      source.setData(rectangle);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: rectangle
      });
      
      map.addLayer({
        id: 'box-selection-preview-fill',
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#2196F3',
          'fill-opacity': 0.2
        }
      });
      
      map.addLayer({
        id: 'box-selection-preview-line',
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#2196F3',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });
    }
  }, []);

  /**
   * Удаляет предпросмотр прямоугольника выделения
   */
  const removeBoxSelectionPreview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer('box-selection-preview-fill')) {
      map.removeLayer('box-selection-preview-fill');
    }
    if (map.getLayer('box-selection-preview-line')) {
      map.removeLayer('box-selection-preview-line');
    }
    if (map.getSource('box-selection-preview')) {
      map.removeSource('box-selection-preview');
    }
  }, []);

  /**
   * Проверяет, попадает ли точка в прямоугольник
   */
  const isPointInBox = useCallback((point, boxStart, boxEnd) => {
    const minLng = Math.min(boxStart.lng, boxEnd.lng);
    const maxLng = Math.max(boxStart.lng, boxEnd.lng);
    const minLat = Math.min(boxStart.lat, boxEnd.lat);
    const maxLat = Math.max(boxStart.lat, boxEnd.lat);
    
    return point.lng >= minLng && point.lng <= maxLng &&
           point.lat >= minLat && point.lat <= maxLat;
  }, []);

  /**
   * Получает все вершины объекта с их путями для редактирования
   */
  const getVerticesWithPaths = useCallback((feature) => {
    const vertices = [];
    
    if (feature.geometry.type === 'Point') {
      return vertices;
    } else if (feature.geometry.type === 'LineString') {
      feature.geometry.coordinates.forEach((coord, index) => {
        vertices.push({
          path: [index],
          coordinates: coord
        });
      });
    } else if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring, ringIndex) => {
        ring.forEach((coord, coordIndex) => {
          if (coordIndex < ring.length - 1) {
            vertices.push({
              path: [ringIndex, coordIndex],
              coordinates: coord
            });
          }
        });
      });
    }
    
    return vertices;
  }, []);

  /**
   * Обработчик готовности карты - инициализирует все компоненты
   */
  const handleMapReady = useCallback((map) => {
    if (!map) return;
    mapRef.current = map;

    if (!mapboxgl.accessToken) {
      console.error('Mapbox access token is not set!');
      return;
    }

    map.on('error', (e) => {
      if (e.error && e.error.message) {
        console.error('Mapbox error:', e.error.message);
        if (e.error.message.includes('401') || e.error.message.includes('Unauthorized')) {
          console.error('Mapbox access token is invalid or expired');
        } else if (e.error.message.includes('ERR_CONNECTION_CLOSED') || e.error.message.includes('network')) {
          console.error('Network error: Unable to connect to Mapbox API. Check your internet connection.');
        }
      }
    });

    if (map.loaded()) {
      map.easeTo({
        padding: {
          right: rightSidebarCollapsed ? 0 : 300
        },
        duration: 0 // Мгновенно при загрузке
      });
    } else {
      map.once('load', () => {
        map.easeTo({
          padding: {
            right: rightSidebarCollapsed ? 0 : 300
          },
          duration: 0
        });
      });
    }

    // Инициализируем Mapbox Geocoder после загрузки карты
    if (!geocoderRef.current && geocoderContainerRef.current) {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        placeholder: 'Поиск городов...',
        language: 'ru',
        types: 'place', // Только города
        proximity: [66.9, 48.0], // Близость к Казахстану для приоритизации результатов
        limit: 5,
        marker: false, // Отключаем автоматическое добавление маркера
      });

      // Добавляем geocoder в контейнер
      geocoderContainerRef.current.appendChild(geocoder.onAdd(map));
      geocoderRef.current = geocoder;

      // Создаем обработчики и сохраняем их для правильного cleanup
      const onGeocoderResult = (e) => {
        const { result } = e;
        if (result && result.center) {
          // Только приближаем камеру к выбранному месту, без добавления маркера
          map.flyTo({
            center: result.center,
            zoom: 12,
            duration: 1500,
          });
        }
      };

      const onGeocoderError = (e) => {
        console.warn('Geocoder error:', e);
      };

      // Сохраняем обработчики для правильного cleanup
      geocoder._handlers = { onGeocoderResult, onGeocoderError };

      // Обработчик выбора результата - только приближение камеры, без маркера
      geocoder.on('result', onGeocoderResult);

      // Обработчик ошибок
      geocoder.on('error', onGeocoderError);
    }

    // Инициализируем Mapbox Draw
    if (!drawRef.current) {
      // Создаем кастомный режим simple_select, который отключает только перетаскивание и выбор
      // Клонируем встроенный режим как объект (рекомендуемый подход)
      const baseSimpleSelect = MapboxDraw.modes.simple_select;
      
      const customSimpleSelect = {
        ...baseSimpleSelect,
        
        // запрет перетаскивания фичи (но разрешаем, если кнопка Edit активна)
        dragMove(state, e) {
          if (activeToolRef.current !== 'select') {
            return; // блокируем перетаскивание, если кнопка Edit не активна
          }
          // Разрешаем перетаскивание при активной кнопке Edit
          return baseSimpleSelect.dragMove.call(this, state, e);
        },
        
        // запрет выбора кликом, если Edit не активен
        onClick(state, e) {
          if (activeToolRef.current !== 'select') return;
          return baseSimpleSelect.onClick.call(this, state, e);
        },
        
        // ВАЖНО: toDisplayFeatures НЕ трогаем — он уже есть в baseSimpleSelect
      };

      // Создаем кастомный режим direct_select для поддержки массового выбора вершин рамкой
      const baseDirectSelect = MapboxDraw.modes.direct_select;
      
      const customDirectSelect = {
        ...baseDirectSelect,

        onSetup(opts) {
          const state = baseDirectSelect.onSetup.call(this, opts);

          // поддержка массового выбора вершин рамкой
          if (opts && Array.isArray(opts.selectedCoordPaths) && opts.selectedCoordPaths.length) {
            // ВАЖНО: MapboxDraw внутри обычно хранит пути как строки вида "0.12" / "5"
            state.selectedCoordPaths = opts.selectedCoordPaths.map((p) =>
              Array.isArray(p) ? p.join('.') : String(p)
            );

            // чтобы Draw понимал "активную" вершину, можно задать первую
            if (!opts.coordPath) {
              state.coordPath = state.selectedCoordPaths[0];
            }
          }

          return state;
        },
      };

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          point: true,
          line_string: true,
          polygon: true,
          trash: true
        },
        modes: {
          ...MapboxDraw.modes,
          simple_select: customSimpleSelect,
          direct_select: customDirectSelect,
        },
        // Включаем поддержку simplestyle (включено по умолчанию, но явно указываем)
        defaultMode: 'simple_select',
        // ВАЖНО: Включаем userProperties для поддержки пользовательских свойств (simplestyle)
        userProperties: true,
        // Кастомные стили для применения simplestyle свойств
        styles: [
          // POLYGON fill (inactive)
          {
            id: 'gl-draw-polygon-fill-inactive',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false'], ['==', 'meta', 'feature']],
            paint: {
              'fill-color': ['coalesce', ['get', 'user_fill'], '#3bb2d0'],
              'fill-opacity': ['coalesce', ['get', 'user_fill-opacity'], 0.3],
            },
          },
          // POLYGON fill (active)
          {
            id: 'gl-draw-polygon-fill-active',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true'], ['==', 'meta', 'feature']],
            paint: {
              'fill-color': ['coalesce', ['get', 'user_fill'], '#3bb2d0'],
              'fill-opacity': ['coalesce', ['get', 'user_fill-opacity'], 0.3],
            },
          },
          // POLYGON outline (inactive)
          {
            id: 'gl-draw-polygon-stroke-inactive',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false'], ['==', 'meta', 'feature']],
            paint: {
              'line-color': ['coalesce', ['get', 'user_stroke'], '#555555'],
              'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
              'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
            },
          },
          // POLYGON outline (active)
          {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true'], ['==', 'meta', 'feature']],
            paint: {
              'line-color': ['coalesce', ['get', 'user_stroke'], '#555555'],
              'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
              'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
            },
          },
          // LINESTRING (inactive)
          {
            id: 'gl-draw-line-inactive',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false'], ['==', 'meta', 'feature']],
            paint: {
              'line-color': ['coalesce', ['get', 'user_stroke'], '#555555'],
              'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
              'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
            },
          },
          // LINESTRING (active)
          {
            id: 'gl-draw-line-active',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true'], ['==', 'meta', 'feature']],
            paint: {
              'line-color': ['coalesce', ['get', 'user_stroke'], '#555555'],
              'line-width': ['coalesce', ['get', 'user_stroke-width'], 2],
              'line-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
            },
          },
          // POINT (inactive)
          {
            id: 'gl-draw-point-inactive',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['==', 'active', 'false'], ['==', 'meta', 'feature']],
            paint: {
              'circle-color': ['coalesce', ['get', 'user_fill'], '#D60000'],
              'circle-opacity': ['coalesce', ['get', 'user_fill-opacity'], 1],
              'circle-radius': 6,
              'circle-stroke-color': ['coalesce', ['get', 'user_stroke'], '#555555'],
              'circle-stroke-width': ['coalesce', ['get', 'user_stroke-width'], 2],
              'circle-stroke-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
            },
          },
          // POINT (active)
          {
            id: 'gl-draw-point-active',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['==', 'meta', 'feature']],
            paint: {
              'circle-color': ['coalesce', ['get', 'user_fill'], '#D60000'],
              'circle-opacity': ['coalesce', ['get', 'user_fill-opacity'], 1],
              'circle-radius': 6,
              'circle-stroke-color': ['coalesce', ['get', 'user_stroke'], '#555555'],
              'circle-stroke-width': ['coalesce', ['get', 'user_stroke-width'], 2],
              'circle-stroke-opacity': ['coalesce', ['get', 'user_stroke-opacity'], 1],
            },
          },
          // MIDPOINTS (для добавления новых вершин на ребрах)
          {
            id: 'gl-draw-polygon-midpoint',
            type: 'circle',
            filter: ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'midpoint']
            ],
            paint: {
              'circle-radius': 4,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#555555',
              'circle-stroke-width': 2
            }
          },
          {
            id: 'gl-draw-line-midpoint',
            type: 'circle',
            filter: ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'midpoint']
            ],
            paint: {
              'circle-radius': 4,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#555555',
              'circle-stroke-width': 2
            }
          },
          // VERTEX halo (active)
          {
            id: 'gl-draw-polygon-and-line-vertex-halo-active',
            type: 'circle',
            filter: ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'vertex'],
              ['==', 'active', 'true']
            ],
            paint: {
              'circle-radius': 10,
              'circle-color': '#2196F3',
              'circle-opacity': 0.3
            }
          },
          // VERTEX (active)
          {
            id: 'gl-draw-polygon-and-line-vertex-active',
            type: 'circle',
            filter: ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'vertex'],
              ['==', 'active', 'true']
            ],
            paint: {
              'circle-radius': 6,
              'circle-color': '#2196F3',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2
            }
          },
          // VERTEX halo (inactive)
          {
            id: 'gl-draw-polygon-and-line-vertex-halo-inactive',
            type: 'circle',
            filter: ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'vertex'],
              ['==', 'active', 'false']
            ],
            paint: {
              'circle-radius': 8,
              'circle-color': '#ffffff',
              'circle-opacity': 0.7
            }
          },
          // VERTEX (inactive)
          {
            id: 'gl-draw-polygon-and-line-vertex-inactive',
            type: 'circle',
            filter: ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'vertex'],
              ['==', 'active', 'false']
            ],
            paint: {
              'circle-radius': 5,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#555555',
              'circle-stroke-width': 2,
              'circle-opacity': 0.7
            }
          },
        ],
      });
      map.addControl(draw, 'top-left');
      drawRef.current = draw;
      
      // Обработчик изменения выделения для надежного получения featureId
      const onSelectionChange = (e) => {
        selectedFeatureIdRef.current = (e.features && e.features[0] && e.features[0].id) ? e.features[0].id : null;
      };
      map.on('draw.selectionchange', onSelectionChange);
      // Сохраняем для cleanup
      draw._onSelectionChange = onSelectionChange;
      
      // Удаляем CSS стили, которые могут скрывать объекты
      // Вместо этого используем только обработчики событий

      // Скрываем mapboxgl-control-container
      const hideControlContainer = () => {
        const controlContainer = map.getContainer().querySelector('.mapboxgl-control-container');
        if (controlContainer) {
          controlContainer.style.display = 'none';
        }
      };
      // Пытаемся скрыть сразу
      hideControlContainer();
      // Также проверяем после небольшой задержки на случай, если элемент создается позже
      setTimeout(hideControlContainer, 100);
      setTimeout(hideControlContainer, 500);

      // Устанавливаем режим выбора по умолчанию, но редактирование будет доступно только при нажатии кнопки Edit
      // Это гарантирует, что объекты будут отображаться
      draw.changeMode('simple_select');
      
      // Убеждаемся, что все слои MapboxDraw видимы (hot/cold - это реальные слои геометрии!)
      const ensureDrawLayersVisible = () => {
        if (!map || !map.getStyle()) return;
        const style = map.getStyle();
        if (style && style.layers) {
          style.layers.forEach(layer => {
            if (layer.id && layer.id.startsWith('gl-draw-') && map.getLayer(layer.id)) {
              try {
                // Убеждаемся, что слой видим
                const v = map.getLayoutProperty(layer.id, 'visibility');
                if (v !== 'visible') {
                  map.setLayoutProperty(layer.id, 'visibility', 'visible');
                }
                // Также проверяем opacity для paint свойств
                const opacity = map.getPaintProperty(layer.id, 'fill-opacity') || 
                               map.getPaintProperty(layer.id, 'line-opacity') ||
                               map.getPaintProperty(layer.id, 'circle-opacity');
                // Если opacity равен 0, устанавливаем нормальное значение
                if (opacity === 0) {
                  if (layer.type === 'fill') {
                    map.setPaintProperty(layer.id, 'fill-opacity', 0.3);
                  } else if (layer.type === 'line') {
                    map.setPaintProperty(layer.id, 'line-opacity', 1);
                  } else if (layer.type === 'circle') {
                    map.setPaintProperty(layer.id, 'circle-opacity', 1);
                  }
                }
              } catch (e) {
                // Игнорируем ошибки
                console.warn('Ошибка при установке видимости слоя:', layer.id, e);
              }
            }
          });
        }
      };
      
      // Проверяем видимость слоев после загрузки стиля
      const checkAndEnsureVisibility = () => {
        ensureDrawLayersVisible();
        // Также обновляем список объектов, если они уже есть
        const existingFeatures = draw.getAll();
        if (existingFeatures.features.length > 0) {
          updateDrawnFeaturesDebounced(existingFeatures.features);
        }
      };
      
      if (map.loaded() && map.isStyleLoaded()) {
        setTimeout(checkAndEnsureVisibility, 100);
        // Дополнительная проверка через больший интервал для надежности
        setTimeout(checkAndEnsureVisibility, 500);
      } else {
        map.once('style.load', () => {
          setTimeout(checkAndEnsureVisibility, 100);
          setTimeout(checkAndEnsureVisibility, 500);
        });
      }
      
      // Также проверяем при каждом обновлении стиля
      map.on('style.load', checkAndEnsureVisibility);
      
      // Убрано: map.on('data', ...) - событие data срабатывает слишком часто
      // Вместо этого полагаемся на style.load и явные вызовы ensureDrawLayersVisible
      // при add/delete/update операциях

      // Создаем source для hover highlight один раз при инициализации
      const hoverSourceId = 'hover-highlight';
      if (!map.getSource(hoverSourceId)) {
        map.addSource(hoverSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      // Блокируем только правые клики на объектах (контекстное меню)
      const blockContextMenu = (e) => {
        // Получаем все слои карты
        const style = map.getStyle();
        if (!style || !style.layers) return;
        
        // Находим все слои MapboxDraw (hot/cold - это реальные слои геометрии!)
        const drawLayerIds = style.layers
          .map(l => l.id)
          .filter((id) =>
            id &&
            id.startsWith('gl-draw-') &&
            map.getLayer(id) // Проверяем, что слой действительно существует
          );
        
        if (drawLayerIds.length === 0) return;
        
        // Используем queryRenderedFeatures для точного определения кликов по объектам MapboxDraw
        try {
          const features = map.queryRenderedFeatures(e.point, {
            layers: drawLayerIds
          });
          
          // Если клик был по объекту MapboxDraw, блокируем контекстное меню
          if (features.length > 0) {
            e.preventDefault?.();
            e.originalEvent?.preventDefault?.();
            e.originalEvent?.stopPropagation?.();
            return false;
          }
        } catch (err) {
          // Игнорируем ошибки при запросе (например, если слои еще не загружены)
          console.warn('Error querying rendered features:', err);
        }
      };

      // Блокируем только правые клики (контекстное меню) на объектах
      map.on('contextmenu', blockContextMenu);

      // Обработчик изменения режима - предотвращаем автоматическое редактирование при клике
      // MapboxDraw события обрабатываются через карту, а не через сам объект draw
      const originalChangeMode = draw.changeMode.bind(draw);
      
      // Обработчик клика по объекту для входа в direct_select (только в режиме Edit)
      const onMapClickEnterDirectSelect = (e) => {
        // Работаем только когда нажата кнопка Edit
        if (activeToolRef.current !== 'select') return;

        // Переходим в direct_select только из simple_select
        const mode = draw.getMode();
        if (mode !== 'simple_select') return;

        const style = map.getStyle();
        if (!style?.layers) return;

        // Берем draw-слои, исключаем только vertex/midpoint (hot/cold - это реальные слои геометрии!)
        const drawLayerIds = style.layers
          .map(l => l.id)
          .filter((id) =>
            id &&
            id.startsWith('gl-draw-') &&
            !id.includes('vertex') &&
            !id.includes('midpoint') &&
            map.getLayer(id)
          );

        if (!drawLayerIds.length) return;

        let features = [];
        try {
          features = map.queryRenderedFeatures(e.point, { layers: drawLayerIds });
        } catch (err) {
          return;
        }

        if (!features.length) return;

        // MapboxDraw обычно кладёт id в feature.id, иногда дублирует в properties.id
        const clicked = features[0];
        const featureId = clicked?.properties?.id || clicked?.id;
        if (!featureId) return;

        // Входим в direct_select и запоминаем что редактируем
        editingFeatureIdRef.current = featureId;
        selectedFeatureIdRef.current = featureId; // для консистентности

        try {
          originalChangeMode('direct_select', { featureId });
        } catch (err) {
          console.warn('Failed to enter direct_select:', err);
        }

        // Чтобы не было "побочных" кликов/панорамирования
        e.preventDefault?.();
        e.originalEvent?.preventDefault?.();
      };

      map.on('click', onMapClickEnterDirectSelect);
      draw._onMapClickEnterDirectSelect = onMapClickEnterDirectSelect; // для cleanup
      
      // Флаг для предотвращения рекурсии при обработке событий
      let isProcessingCreate = false;
      
      // Обработчик событий рисования
      map.on('draw.create', (e) => {
        // Предотвращаем рекурсию
        if (isProcessingCreate) return;
        isProcessingCreate = true;
        
        try {
          // Сначала получаем все объекты, включая только что созданный
          const features = draw.getAll();
          updateDrawnFeaturesDebounced(features.features);
          
          // Сбрасываем состояние рисования
          setDrawingMode(DRAWING_MODES.NONE);
          setActiveTool(null);
          activeToolRef.current = null;
          
          // Принудительно обновляем видимость слоев MapboxDraw и режим
          setTimeout(() => {
            // Убеждаемся, что режим simple_select активен для отображения объектов
            // Это важно - объекты отображаются только в режиме simple_select
            if (draw.getMode() !== 'simple_select') {
              originalChangeMode('simple_select');
            }
            
            // Убеждаемся, что все слои видимы
            ensureDrawLayersVisible();
            
            // Получаем все объекты и обновляем состояние
            const allFeatures = draw.getAll();
            if (allFeatures.features.length > 0) {
              // Принудительно обновляем состояние для отображения
              updateDrawnFeaturesDebounced([...allFeatures.features]);
              
              // Принудительно обновляем карту для перерисовки
              map.triggerRepaint();
              
              // Дополнительная проверка видимости через небольшую задержку
              setTimeout(() => {
                ensureDrawLayersVisible();
                map.triggerRepaint();
              }, 50);
            }
            
            isProcessingCreate = false;
          }, 50);
        } catch (error) {
          console.error('Error in draw.create handler:', error);
          isProcessingCreate = false;
        }
      });
      const modeChangeHandler = (e) => {
        // Если режим изменился на direct_select (редактирование), но кнопка Edit не активна,
        // немедленно возвращаемся в simple_select и снимаем выделение
        if (e.mode === 'direct_select' && activeToolRef.current !== 'select') {
          // Немедленно возвращаемся в simple_select (синхронно, без задержки)
          const selected = draw.getSelected();
          if (selected.features.length > 0) {
            // Используем синхронный вызов для немедленного возврата
            // Снимаем выделение объекта через changeMode
            originalChangeMode('simple_select', { featureIds: [] });
            setSelectedFeature(null);
          }
        }
        // Если вышли из режима direct_select, очищаем box selection и editingFeatureIdRef
        if (e.mode !== 'direct_select') {
          editingFeatureIdRef.current = null;
          selectedFeatureIdRef.current = null;
          isBoxSelectingRef.current = false;
          boxSelectionStartRef.current = null;
          removeBoxSelectionPreview();
        }
      };
      
      // MapboxDraw события обрабатываются через карту
      map.on('draw.modechange', modeChangeHandler);
      
      // Обработчик для выбора нескольких вершин в режиме редактирования
      // В MapboxDraw выбор нескольких вершин работает с Ctrl/Shift
      // Мы добавляем обработчик для визуальной обратной связи
      const vertexClickHandler = (e) => {
        const currentMode = draw.getMode();
        if (currentMode === 'direct_select' && multiVertexSelectModeRef.current) {
          // В этом режиме пользователь должен использовать Ctrl/Shift для выбора нескольких вершин
          // MapboxDraw автоматически поддерживает это поведение
        }
      };
      
      map.on('click', vertexClickHandler);
      
      // Переопределяем метод changeMode для перехвата попыток перехода в direct_select
      // Это перехватывает переход ДО того, как он произойдет
      // НО: не блокируем режимы рисования (draw_point, draw_line_string, draw_polygon)
      draw.changeMode = function(mode, options) {
        // Всегда запоминаем featureId при входе в direct_select
        if (mode === 'direct_select' && options?.featureId) {
          editingFeatureIdRef.current = options.featureId;
          selectedFeatureIdRef.current = options.featureId; // опционально, но полезно
        }

        // Если пытаемся перейти в direct_select, но кнопка Edit не активна, блокируем это
        if (mode === 'direct_select' && activeToolRef.current !== 'select') {
          const selected = draw.getSelected();
          if (selected.features.length > 0) {
            // Вместо редактирования просто снимаем выделение
            originalChangeMode('simple_select', { featureIds: [] });
            setSelectedFeature(null);
            return draw;
          }
        }
        // Для всех остальных режимов (включая режимы рисования) вызываем оригинальный метод
        return originalChangeMode(mode, options);
      };
      
      // Сохраняем ссылку на оригинальный метод для восстановления при cleanup
      draw._originalChangeMode = originalChangeMode;
      
      // Удалено: setInterval для проверки режима (слишком тяжело - 100 раз в секунду)
      // Вместо этого полагаемся на события draw.modechange и перехват changeMode

      // Обработчики кликов на нарисованных объектах удалены
      
      // Обработчик двойного клика для завершения рисования линии и открытия свойств объекта
      const dblclickHandler = (e) => {
        const currentMode = draw.getMode();
        // Если мы в режиме рисования линии, завершаем рисование
        if (currentMode === 'draw_line_string') {
          // Завершаем рисование линии, переключаясь в режим выбора
          // Mapbox Draw автоматически завершит текущую линию при смене режима
          // Используем оригинальный метод, чтобы избежать рекурсии
          originalChangeMode('simple_select');
          setDrawingMode(DRAWING_MODES.NONE);
          setActiveTool(null);
          activeToolRef.current = null;
          
          // Обновляем список объектов
          setTimeout(() => {
            const features = draw.getAll();
            updateDrawnFeaturesDebounced(features.features);
          }, 50);
          
          // Предотвращаем стандартное поведение двойного клика (зум)
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
          return;
        }
        
        // Если мы в обычном режиме (simple_select) и не в режиме редактирования, проверяем клик по объекту
        if (currentMode === 'simple_select' && activeToolRef.current !== 'select') {
          // Получаем все слои карты
          const style = map.getStyle();
          if (!style || !style.layers) return;
          
          // Находим все слои MapboxDraw (исключая только vertex/midpoint, hot/cold - это реальные слои!)
          const drawLayerIds = style.layers
            .map(l => l.id)
            .filter((id) =>
              id &&
              id.startsWith('gl-draw-') &&
              !id.includes('vertex') &&
              !id.includes('midpoint') &&
              map.getLayer(id)
            );
          
          if (drawLayerIds.length === 0) return;
          
          // Проверяем, был ли клик по объекту MapboxDraw
          try {
            const features = map.queryRenderedFeatures(e.point, {
              layers: drawLayerIds
            });
            
            // Если клик был по объекту, открываем диалог свойств
            if (features.length > 0) {
              const clickedFeature = features[0];
              const featureId = clickedFeature.properties?.id || clickedFeature.id;
              
              if (featureId) {
                // Получаем полный объект из draw
                const allFeatures = draw.getAll();
                const feature = allFeatures.features.find(f => f.id === featureId);
                
                if (feature) {
                  // Очищаем объект от ссылок на карту перед установкой
                  const cleanedFeature = safeClone(feature) || feature;
                  setSelectedFeature(cleanedFeature);
                  setFeatureDialogOpen(true);
                  setDialogTab(0);
                  
                  // Предотвращаем стандартное поведение двойного клика (зум)
                  e.preventDefault?.();
                  e.originalEvent?.preventDefault?.();
                  e.originalEvent?.stopPropagation?.();
                }
              }
            }
          } catch (err) {
            // Игнорируем ошибки при запросе
            console.warn('Error querying rendered features on double click:', err);
          }
        }
      };
      
      map.on('dblclick', dblclickHandler);

      map.on('draw.update', (e) => {
        const features = draw.getAll();
        updateDrawnFeaturesDebounced(features.features);
        // Убеждаемся, что слои видимы после обновления
        setTimeout(() => {
          ensureDrawLayersVisible();
        }, 50);
      });

      map.on('draw.delete', (e) => {
        const features = draw.getAll();
        updateDrawnFeaturesDebounced(features.features);
        // Убеждаемся, что слои видимы после удаления
        setTimeout(() => {
          ensureDrawLayersVisible();
        }, 50);
      });

      // Обработчики для box selection вершин через DOM-capture (перехватываем раньше dragPan)
      const canvas = map.getCanvasContainer();

      const getLngLatFromMouseEvent = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const point = [
          ev.clientX - rect.left,
          ev.clientY - rect.top,
        ];
        return map.unproject(point);
      };

      const onCanvasMouseDownCapture = (ev) => {
        // Условия рамки
        const currentMode = draw.getMode();
        if (currentMode !== 'direct_select' || !multiVertexSelectModeRef.current) return;
        if (ev.button !== 0) return; // только ЛКМ

        // ВАЖНО: блокируем дефолт ДО того, как Mapbox начнёт dragPan
        ev.preventDefault();
        ev.stopPropagation();

        // Если клик по вершине — не начинаем рамку
        try {
          const vertexLayerIds = (map.getStyle()?.layers || [])
            .map(l => l.id)
            .filter(id =>
              id &&
              id.startsWith('gl-draw-') &&
              id.includes('vertex') &&
              map.getLayer(id)
            );

          if (vertexLayerIds.length) {
            const rect = canvas.getBoundingClientRect();
            const p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
            const feats = map.queryRenderedFeatures(p, { layers: vertexLayerIds });
            if (feats.length > 0) return;
          }
        } catch (e) {
          // Игнорируем ошибки
        }

        isBoxSelectingRef.current = true;

        const lngLat = getLngLatFromMouseEvent(ev);
        boxSelectionStartRef.current = lngLat;

        // На всякий случай отключаем панорамирование на время рамки
        map.dragPan.disable();

        // Включаем глобальные listeners, чтобы mouseup сработал даже если курсор ушёл за карту
        window.addEventListener('mousemove', onWindowMouseMoveCapture, true);
        window.addEventListener('mouseup', onWindowMouseUpCapture, true);
      };

      const onWindowMouseMoveCapture = (ev) => {
        if (!isBoxSelectingRef.current || !boxSelectionStartRef.current) return;
        ev.preventDefault();
        ev.stopPropagation();
        const lngLat = getLngLatFromMouseEvent(ev);
        updateBoxSelectionPreview(boxSelectionStartRef.current, lngLat);
      };

      const onWindowMouseUpCapture = (ev) => {
        if (!isBoxSelectingRef.current || !boxSelectionStartRef.current) {
          map.dragPan.enable();
          window.removeEventListener('mousemove', onWindowMouseMoveCapture, true);
          window.removeEventListener('mouseup', onWindowMouseUpCapture, true);
          return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        const boxStart = boxSelectionStartRef.current;
        const boxEnd = getLngLatFromMouseEvent(ev);

        isBoxSelectingRef.current = false;
        boxSelectionStartRef.current = null;

        removeBoxSelectionPreview();
        map.dragPan.enable();

        window.removeEventListener('mousemove', onWindowMouseMoveCapture, true);
        window.removeEventListener('mouseup', onWindowMouseUpCapture, true);

        // Обновляем выделение вершин
        setTimeout(() => {
          const featureId =
            editingFeatureIdRef.current ||
            selectedFeatureIdRef.current ||
            (typeof draw.getSelectedIds === 'function' ? draw.getSelectedIds()[0] : null);

          if (!featureId) return;

          const feature = typeof draw.get === 'function' ? draw.get(featureId) : null;
          if (!feature) return;

          const vertices = getVerticesWithPaths(feature);
          const selectedVertices = vertices.filter(v => {
            const p = { lng: v.coordinates[0], lat: v.coordinates[1] };
            return isPointInBox(p, boxStart, boxEnd);
          });

          if (!selectedVertices.length) return;

          const selectedCoordPaths = selectedVertices.map(v =>
            Array.isArray(v.path) ? v.path.join('.') : String(v.path)
          );

          const original = draw._originalChangeMode || draw.changeMode;
          try {
            original.call(draw, 'direct_select', {
              featureId,
              coordPath: selectedCoordPaths[0],
              selectedCoordPaths
            });
          } catch (e) {
            console.warn('Error setting selected vertices:', e);
          }
        }, 0);
      };

      // Регистрируем перехватчик mousedown в CAPTURE
      canvas.addEventListener('mousedown', onCanvasMouseDownCapture, true);

      // Сохраняем для cleanup
      boxSelectionHandlersRef.current = {
        domDown: onCanvasMouseDownCapture,
        winMove: onWindowMouseMoveCapture,
        winUp: onWindowMouseUpCapture,
        canvas
      };

      // Сохраняем cleanup функцию в ref для вызова при размонтировании компонента
      mapCleanupRef.current = () => {
        if (map) {
          // Очищаем обработчики box selection (DOM-capture)
          if (boxSelectionHandlersRef.current?.canvas && boxSelectionHandlersRef.current?.domDown) {
            boxSelectionHandlersRef.current.canvas.removeEventListener(
              'mousedown',
              boxSelectionHandlersRef.current.domDown,
              true
            );
          }
          if (boxSelectionHandlersRef.current?.winMove) {
            window.removeEventListener('mousemove', boxSelectionHandlersRef.current.winMove, true);
          }
          if (boxSelectionHandlersRef.current?.winUp) {
            window.removeEventListener('mouseup', boxSelectionHandlersRef.current.winUp, true);
          }
          boxSelectionHandlersRef.current = null;
          removeBoxSelectionPreview();
          
          // Очищаем обработчики событий карты
          map.off('dblclick', dblclickHandler);
          map.off('click', vertexClickHandler);
          map.off('draw.modechange', modeChangeHandler);
          if (draw._onSelectionChange) {
            map.off('draw.selectionchange', draw._onSelectionChange);
            delete draw._onSelectionChange;
          }
          if (draw._onMapClickEnterDirectSelect) {
            map.off('click', draw._onMapClickEnterDirectSelect);
            delete draw._onMapClickEnterDirectSelect;
          }
          map.off('contextmenu', blockContextMenu);
          map.off('style.load', checkAndEnsureVisibility);
        }
        if (draw) {
          // Восстанавливаем оригинальный метод changeMode
          if (draw._originalChangeMode) {
            draw.changeMode = draw._originalChangeMode;
            delete draw._originalChangeMode;
          }
        }
      };
    }
  }, [rightSidebarCollapsed, updateBoxSelectionPreview, removeBoxSelectionPreview, getVerticesWithPaths, isPointInBox]);

  // Функция для очистки текущего рисунка
  const clearCurrentDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (currentFeatureRef.current) {
      const { sourceId, layerIds } = currentFeatureRef.current;
      layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      currentFeatureRef.current = null;
    }
    drawingPointsRef.current = [];
  }, []);

  // Функция для обновления отображения текущего рисунка
  const updateDrawing = useCallback((points, mode) => {
    const map = mapRef.current;
    if (!map || !map.loaded() || points.length === 0) return;

    const coordinates = points.map(p => [p.lng, p.lat]);
    let geometry;
    let layerType;

    if (mode === DRAWING_MODES.POINT && points.length === 1) {
      geometry = {
        type: 'Point',
        coordinates: coordinates[0]
      };
      layerType = 'circle';
    } else if (mode === DRAWING_MODES.LINE && points.length >= 2) {
      geometry = {
        type: 'LineString',
        coordinates: coordinates
      };
      layerType = 'line';
    } else if (mode === DRAWING_MODES.POLYGON && points.length >= 3) {
      geometry = {
        type: 'Polygon',
        coordinates: [[...coordinates, coordinates[0]]]
      };
      layerType = 'fill';
    } else {
      return;
    }

    const feature = {
      type: 'Feature',
      geometry: geometry
    };

    const sourceId = 'current-drawing';
    const source = map.getSource(sourceId);

    if (source) {
      source.setData(feature);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: feature
      });

      if (layerType === 'fill') {
        map.addLayer({
          id: 'current-drawing-fill',
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#4CAF50',
            'fill-opacity': 0.3
          }
        });
        map.addLayer({
          id: 'current-drawing-line',
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#4CAF50',
            'line-width': 2
          }
        });
      } else if (layerType === 'line') {
        map.addLayer({
          id: 'current-drawing-line',
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#4CAF50',
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      } else if (layerType === 'circle') {
        map.addLayer({
          id: 'current-drawing-point',
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 8,
            'circle-color': '#4CAF50',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      // Добавляем точки
      const pointsFeature = {
        type: 'FeatureCollection',
        features: points.map((p, i) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.lng, p.lat]
          },
          properties: { index: i }
        }))
      };

      map.addSource('current-drawing-points', {
        type: 'geojson',
        data: pointsFeature
      });

      map.addLayer({
        id: 'current-drawing-points',
        type: 'circle',
        source: 'current-drawing-points',
        paint: {
          'circle-radius': 5,
          'circle-color': '#4CAF50',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    // Обновляем точки
    const pointsSource = map.getSource('current-drawing-points');
    if (pointsSource) {
      const pointsFeature = {
        type: 'FeatureCollection',
        features: points.map((p, i) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.lng, p.lat]
          },
          properties: { index: i }
        }))
      };
      pointsSource.setData(pointsFeature);
    }

    currentFeatureRef.current = {
      sourceId,
      layerIds: layerType === 'fill' 
        ? ['current-drawing-fill', 'current-drawing-line', 'current-drawing-points']
        : layerType === 'line'
        ? ['current-drawing-line', 'current-drawing-points']
        : ['current-drawing-point', 'current-drawing-points']
    };
  }, []);

  // Обработка режима рисования
  // Примечание: для точки, линии и полигона используется MapboxDraw,
  // поэтому кастомные обработчики не нужны. Они используются только для
  // прямоугольника и круга, которые обрабатываются отдельно.
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    
    // Если используется MapboxDraw для рисования (точка, линия, полигон),
    // не добавляем кастомные обработчики - MapboxDraw сам обработает события
    if (draw && (drawingMode === DRAWING_MODES.POINT || 
                 drawingMode === DRAWING_MODES.LINE || 
                 drawingMode === DRAWING_MODES.POLYGON)) {
      // MapboxDraw сам обработает рисование, кастомные обработчики не нужны
      return;
    }
    
    if (!map || drawingMode === DRAWING_MODES.NONE || drawingMode === DRAWING_MODES.SELECT) {
      clearCurrentDrawing();
      if (map) {
        map.getCanvas().style.cursor = '';
        map.dragPan.enable();
        map.boxZoom.enable();
        map.dragRotate.enable();
        map.doubleClickZoom.enable();
      }
      return;
    }

    // Ждем загрузки карты
    if (!map.loaded() || !map.isStyleLoaded()) {
      const handleMapLoad = () => {
        if (mapRef.current && mapRef.current.loaded() && mapRef.current.isStyleLoaded()) {
          // Эффект перезапустится автоматически
        }
      };
      map.once('load', handleMapLoad);
      map.once('style.load', handleMapLoad);
      return () => {
        map.off('load', handleMapLoad);
        map.off('style.load', handleMapLoad);
      };
    }

    // Устанавливаем курсор для рисования
    map.getCanvas().style.cursor = 'crosshair';
    
    // Отключаем взаимодействия, которые мешают рисованию
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.doubleClickZoom.disable();

    const handleClick = (e) => {
      if (e.originalEvent.button !== 0) return;
      
      const point = e.lngLat;
      
      if (drawingMode === DRAWING_MODES.POINT) {
        // Для точки - сразу завершаем
        drawingPointsRef.current = [point];
        updateDrawing([point], DRAWING_MODES.POINT);
        setDrawingMode(DRAWING_MODES.NONE);
        // НЕ переключаемся автоматически в режим редактирования
        if (drawRef.current) {
          drawRef.current.changeMode('simple_select');
          setActiveTool(null);
          activeToolRef.current = null;
        }
      } else {
        // Для линии и полигона - добавляем точку
        drawingPointsRef.current = [...drawingPointsRef.current, point];
        updateDrawing(drawingPointsRef.current, drawingMode);
      }
    };

    const handleDoubleClick = (e) => {
      if (drawingMode === DRAWING_MODES.POLYGON && drawingPointsRef.current.length >= 3) {
        // Завершаем полигон
        e.preventDefault();
        setDrawingMode(DRAWING_MODES.NONE);
        // НЕ переключаемся автоматически в режим редактирования
        if (drawRef.current) {
          drawRef.current.changeMode('simple_select');
          setActiveTool(null);
          activeToolRef.current = null;
        }
      }
    };

    map.on('click', handleClick);
    map.on('dblclick', handleDoubleClick);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDoubleClick);
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
    };
  }, [drawingMode, updateDrawing, clearCurrentDrawing]);

  // Функция для сохранения нарисованного слоя
  const handleSave = useCallback(() => {
    if (drawnFeatures.length === 0) {
      alert(t('drawLayer.noObjectsToSave'));
      return;
    }
    
    // Если редактируем существующий слой, показываем диалог выбора
    if (editingLayerId) {
      setReplaceOrCopyDialogOpen(true);
    } else {
      // Если создаем новый слой, показываем обычный диалог сохранения
      setLayerName(''); // Сбрасываем название при открытии диалога
      setSaveError(null);
      setSaveDialogOpen(true);
    }
  }, [drawnFeatures, editingLayerId]);

  // Функция для подготовки данных слоя
  const prepareLayerData = useCallback(() => {
    const fc = drawRef.current ? drawRef.current.getAll() : { type: 'FeatureCollection', features: drawnFeatures };

    const normalized = {
      type: 'FeatureCollection',
      features: (fc.features || []).map((f) => {
        const props = f.properties || {};

        const simplestyle = filterSimplestyleProperties(props);
        const rootFields = extractRootFieldsForSave(f);

        // 1) всё из properties._rootFields -> в корень
        if (props._rootFields && typeof props._rootFields === 'object') {
          const clonedRootFields = safeClone(props._rootFields);
          if (clonedRootFields) {
            Object.assign(rootFields, clonedRootFields);
          }
        }

        // 2) на всякий случай: любые не-simplestyle ключи из properties -> в корень
        Object.entries(props).forEach(([k, v]) => {
          if (k === '_rootFields') return;
          if (SIMPLESTYLE_PROPERTIES.includes(k.toLowerCase())) return;
          // Используем безопасное клонирование для значений, чтобы избежать циклических ссылок
          const cloned = safeClone(v);
          // Пропускаем undefined значения (циклические ссылки или несериализуемые объекты)
          if (cloned !== undefined) {
            rootFields[k] = cloned;
          }
        });

        const out = {
          type: 'Feature',
          geometry: f.geometry,
          properties: simplestyle,
          ...rootFields
        };

        if (f.id !== undefined && f.id !== null) out.id = f.id;
        if (f.bbox) out.bbox = f.bbox;

        return out;
      }),
    };
    
    // Используем безопасное клонирование для финального normalized, чтобы гарантировать отсутствие циклических ссылок
    const safeNormalized = safeClone(normalized) || normalized;

    // Определяем цвета из GeoJSON
    let fillColor = null;
    let lineColor = null;
    
    // Ищем первый полигон для fill_color
    const firstPolygon = normalized.features.find(f => f.geometry?.type === 'Polygon');
    if (firstPolygon?.properties?.fill) {
      fillColor = firstPolygon.properties.fill;
    }
    
    // Ищем первую линию или полигон для line_color
    const firstLineOrPolygon = normalized.features.find(f => 
      f.geometry?.type === 'LineString' || f.geometry?.type === 'Polygon'
    );
    if (firstLineOrPolygon?.properties?.stroke) {
      lineColor = firstLineOrPolygon.properties.stroke;
    }

    return { safeNormalized, fillColor, lineColor };
  }, [drawnFeatures, filterSimplestyleProperties, extractRootFieldsForSave]);

  // Функция для завершения сохранения
  const handleFinishSave = useCallback(async () => {
    if (!layerName.trim()) {
      setSaveError('Введите название слоя');
      return;
    }

    if (drawnFeatures.length === 0) {
      setSaveError('Нет объектов для сохранения');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const { safeNormalized, fillColor, lineColor } = prepareLayerData();

      // Сохраняем в базу данных
      const token = localStorage.getItem('token');
      if (!token) {
        setSaveError('Требуется авторизация для сохранения слоя');
        setSaving(false);
        return;
      }

      // Создаем новый слой (handleFinishSave используется только для новых слоев)
      const response = await fetch('/api/custom-layers/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: layerName.trim(),
          geojson_data: safeNormalized,
          fill_color: fillColor,
          line_color: lineColor
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка при сохранении слоя в БД:', errorText);
        
        // Проверяем, является ли ошибка связанной с дублированием имени
        if (response.status === 400) {
          try {
            const errorData = await response.json();
            setSaveError(errorData.detail || 'Слой с таким именем уже существует');
          } catch {
            setSaveError('Слой с таким именем уже существует');
          }
        } else {
          setSaveError('Ошибка при сохранении слоя в базу данных');
        }
        setSaving(false);
        return;
      }

      const savedLayer = await response.json();
      
      // Сбрасываем флаг несохраненных изменений
      setHasUnsavedChanges(false);
      initialFeaturesRef.current = JSON.parse(JSON.stringify(drawnFeatures));
      
      setSaveDialogOpen(false);
      setLayerName('');
      setEditingLayerId(null);
      setEditingLayerName(null);
      setSaving(false);
      
      // Переходим на страницу слоев
      navigate('/app/layers');
    } catch (error) {
      console.error('Ошибка при сохранении слоя:', error);
      setSaveError('Ошибка при сохранении слоя: ' + (error.message || 'Неизвестная ошибка'));
      setSaving(false);
    }
  }, [layerName, drawnFeatures, navigate, prepareLayerData]);

  // Функция для замены существующего слоя
  const handleReplaceLayer = useCallback(async () => {
    if (drawnFeatures.length === 0) {
      setSaveError('Нет объектов для сохранения');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setReplaceOrCopyDialogOpen(false);

    try {
      const { safeNormalized, fillColor, lineColor } = prepareLayerData();

      const token = localStorage.getItem('token');
      if (!token) {
        setSaveError('Требуется авторизация для сохранения слоя');
        setSaving(false);
        return;
      }

      // Обновляем существующий слой
      const response = await fetch(`/api/custom-layers/${editingLayerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: layerName.trim(),
          geojson_data: safeNormalized,
          fill_color: fillColor,
          line_color: lineColor
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка при сохранении слоя в БД:', errorText);
        setSaveError('Ошибка при сохранении слоя в базу данных');
        setSaving(false);
        return;
      }

      const savedLayer = await response.json();
      
      // Сбрасываем флаг несохраненных изменений
      setHasUnsavedChanges(false);
      initialFeaturesRef.current = JSON.parse(JSON.stringify(drawnFeatures));
      
      setLayerName('');
      setEditingLayerId(null);
      setEditingLayerName(null);
      setSaving(false);
      
      // Переходим на страницу слоев
      navigate('/app/layers');
    } catch (error) {
      console.error('Ошибка при сохранении слоя:', error);
      setSaveError('Ошибка при сохранении слоя: ' + (error.message || 'Неизвестная ошибка'));
      setSaving(false);
    }
  }, [editingLayerId, layerName, drawnFeatures, navigate, prepareLayerData]);

  // Функция для открытия диалога сохранения копии
  const handleSaveCopyClick = useCallback(() => {
    setReplaceOrCopyDialogOpen(false);
    // Устанавливаем имя по умолчанию: имя редактируемого слоя + " copy"
    const defaultCopyName = editingLayerName ? `${editingLayerName} copy` : 'copy';
    setCopyLayerName(defaultCopyName);
    setCopyNameDialogOpen(true);
  }, [editingLayerName]);

  // Функция для сохранения копии слоя
  const handleSaveCopy = useCallback(async () => {
    if (!copyLayerName.trim()) {
      setSaveError('Введите название слоя');
      return;
    }

    if (drawnFeatures.length === 0) {
      setSaveError('Нет объектов для сохранения');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setCopyNameDialogOpen(false);

    try {
      const { safeNormalized, fillColor, lineColor } = prepareLayerData();

      const token = localStorage.getItem('token');
      if (!token) {
        setSaveError('Требуется авторизация для сохранения слоя');
        setSaving(false);
        return;
      }

      // Создаем новый слой (копию)
      const response = await fetch('/api/custom-layers/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: copyLayerName.trim(),
          geojson_data: safeNormalized,
          fill_color: fillColor,
          line_color: lineColor
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка при сохранении слоя в БД:', errorText);
        
        // Проверяем, является ли ошибка связанной с дублированием имени
        if (response.status === 400) {
          try {
            const errorData = await response.json();
            setSaveError(errorData.detail || 'Слой с таким именем уже существует');
          } catch {
            setSaveError('Слой с таким именем уже существует');
          }
        } else {
          setSaveError('Ошибка при сохранении слоя в базу данных');
        }
        setSaving(false);
        return;
      }

      const savedLayer = await response.json();
      
      // Сбрасываем флаг несохраненных изменений
      setHasUnsavedChanges(false);
      initialFeaturesRef.current = JSON.parse(JSON.stringify(drawnFeatures));
      
      setCopyLayerName('');
      setEditingLayerId(null);
      setEditingLayerName(null);
      setSaving(false);
      
      // Переходим на страницу слоев
      navigate('/app/layers');
    } catch (error) {
      console.error('Ошибка при сохранении слоя:', error);
      setSaveError('Ошибка при сохранении слоя: ' + (error.message || 'Неизвестная ошибка'));
      setSaving(false);
    }
  }, [copyLayerName, drawnFeatures, navigate, prepareLayerData]);

  // Функции управления картой
  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleResetView = () => {
    // Используем easeTo вместо fitBounds с одинаковыми координатами
    // fitBounds с одинаковыми точками некорректно/бессмысленно
    mapRef.current?.easeTo({ 
      center: [66.9, 48.0], 
      zoom: 5, 
      duration: 800 
    });
  };

  // Функция для очистки предпросмотров и обработчиков
  const clearPreviews = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Очищаем обработчики прямоугольника
    if (rectangleHandlersRef.current) {
      const { mousedown, mousemove, mouseup } = rectangleHandlersRef.current;
      map.off('mousedown', mousedown);
      map.off('mousemove', mousemove);
      map.off('mouseup', mouseup);
      rectangleHandlersRef.current = null;
    }

    // Очищаем обработчики круга
    if (circleHandlersRef.current) {
      const { mousedown, mousemove, mouseup } = circleHandlersRef.current;
      map.off('mousedown', mousedown);
      map.off('mousemove', mousemove);
      map.off('mouseup', mouseup);
      circleHandlersRef.current = null;
    }

    // Очищаем предпросмотр прямоугольника
    if (map.getLayer('rectangle-preview-fill')) {
      map.removeLayer('rectangle-preview-fill');
    }
    if (map.getLayer('rectangle-preview-line')) {
      map.removeLayer('rectangle-preview-line');
    }
    if (map.getSource('rectangle-preview')) {
      map.removeSource('rectangle-preview');
    }

    // Очищаем предпросмотр круга
    if (map.getLayer('circle-preview-fill')) {
      map.removeLayer('circle-preview-fill');
    }
    if (map.getLayer('circle-preview-line')) {
      map.removeLayer('circle-preview-line');
    }
    if (map.getSource('circle-preview')) {
      map.removeSource('circle-preview');
    }

    // Очищаем предпросмотр box selection
    removeBoxSelectionPreview();

    // Сбрасываем флаги рисования
    isDrawingRectangleRef.current = false;
    isDrawingCircleRef.current = false;
    rectangleStartRef.current = null;
    circleCenterRef.current = null;
    isBoxSelectingRef.current = false;
    boxSelectionStartRef.current = null;
  }, [removeBoxSelectionPreview]);

  // Функция для обновления предпросмотра прямоугольника
  const updateRectanglePreview = useCallback((start, end) => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = [
      [Math.min(start.lng, end.lng), Math.min(start.lat, end.lat)],
      [Math.max(start.lng, end.lng), Math.max(start.lat, end.lat)]
    ];

    const rectangle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds[0][0], bounds[0][1]],
          [bounds[1][0], bounds[0][1]],
          [bounds[1][0], bounds[1][1]],
          [bounds[0][0], bounds[1][1]],
          [bounds[0][0], bounds[0][1]]
        ]]
      }
    };

    const sourceId = 'rectangle-preview';
    const source = map.getSource(sourceId);
    
    if (source) {
      source.setData(rectangle);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: rectangle
      });
      
      map.addLayer({
        id: 'rectangle-preview-fill',
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#4CAF50',
          'fill-opacity': 0.3
        }
      });
      
      map.addLayer({
        id: 'rectangle-preview-line',
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#4CAF50',
          'line-width': 2
        }
      });
    }
  }, []);

  // Функция для завершения прямоугольника
  const finishRectangle = useCallback((start, end) => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    // Удаляем предпросмотр
    if (map.getLayer('rectangle-preview-fill')) {
      map.removeLayer('rectangle-preview-fill');
    }
    if (map.getLayer('rectangle-preview-line')) {
      map.removeLayer('rectangle-preview-line');
    }
    if (map.getSource('rectangle-preview')) {
      map.removeSource('rectangle-preview');
    }

    const bounds = [
      [Math.min(start.lng, end.lng), Math.min(start.lat, end.lat)],
      [Math.max(start.lng, end.lng), Math.max(start.lat, end.lat)]
    ];

    const rectangle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds[0][0], bounds[0][1]],
          [bounds[1][0], bounds[0][1]],
          [bounds[1][0], bounds[1][1]],
          [bounds[0][0], bounds[1][1]],
          [bounds[0][0], bounds[0][1]]
        ]]
      }
    };

    draw.add(rectangle);
    const features = draw.getAll();
    updateDrawnFeaturesDebounced(features.features);
  }, [updateDrawnFeaturesDebounced]);

  // Функция для обновления предпросмотра круга
  const updateCirclePreview = useCallback((center, edge) => {
    const map = mapRef.current;
    if (!map) return;

    // Вычисляем радиус в градусах
    const radius = Math.sqrt(
      Math.pow(edge.lng - center.lng, 2) + Math.pow(edge.lat - center.lat, 2)
    );

    // Создаем полигон, аппроксимирующий круг
    const points = 64;
    const coordinates = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const lng = center.lng + radius * Math.cos(angle);
      const lat = center.lat + radius * Math.sin(angle);
      coordinates.push([lng, lat]);
    }
    coordinates.push(coordinates[0]); // Замыкаем полигон

    const circle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    };

    const sourceId = 'circle-preview';
    const source = map.getSource(sourceId);
    
    if (source) {
      source.setData(circle);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: circle
      });
      
      map.addLayer({
        id: 'circle-preview-fill',
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#4CAF50',
          'fill-opacity': 0.3
        }
      });
      
      map.addLayer({
        id: 'circle-preview-line',
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#4CAF50',
          'line-width': 2
        }
      });
    }
  }, []);

  // Функция для завершения круга
  const finishCircle = useCallback((center, edge) => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    // Удаляем предпросмотр
    if (map.getLayer('circle-preview-fill')) {
      map.removeLayer('circle-preview-fill');
    }
    if (map.getLayer('circle-preview-line')) {
      map.removeLayer('circle-preview-line');
    }
    if (map.getSource('circle-preview')) {
      map.removeSource('circle-preview');
    }

    // Вычисляем радиус в градусах
    const radius = Math.sqrt(
      Math.pow(edge.lng - center.lng, 2) + Math.pow(edge.lat - center.lat, 2)
    );

    // Создаем полигон, аппроксимирующий круг
    const points = 64;
    const coordinates = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const lng = center.lng + radius * Math.cos(angle);
      const lat = center.lat + radius * Math.sin(angle);
      coordinates.push([lng, lat]);
    }
    coordinates.push(coordinates[0]); // Замыкаем полигон

    const circle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    };

    draw.add(circle);
    const features = draw.getAll();
    updateDrawnFeaturesDebounced(features.features);
  }, [updateDrawnFeaturesDebounced]);

  // Функция для начала рисования прямоугольника
  const startRectangleDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    map.getCanvas().style.cursor = 'crosshair';
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.doubleClickZoom.disable();

    const handleMouseDown = (e) => {
      if (e.originalEvent.button !== 0) return;
      isDrawingRectangleRef.current = true;
      rectangleStartRef.current = e.lngLat;
      map.dragPan.disable();
    };

    const handleMouseMove = (e) => {
      if (!isDrawingRectangleRef.current || !rectangleStartRef.current) return;
      updateRectanglePreview(rectangleStartRef.current, e.lngLat);
    };

    const handleMouseUp = (e) => {
      if (!isDrawingRectangleRef.current || !rectangleStartRef.current) {
        map.dragPan.enable();
        return;
      }
      
      isDrawingRectangleRef.current = false;
      map.dragPan.enable();
      
      const endPoint = e.lngLat;
      finishRectangle(rectangleStartRef.current, endPoint);
      
      // Очищаем обработчики
      if (rectangleHandlersRef.current) {
        const { mousedown, mousemove, mouseup } = rectangleHandlersRef.current;
        map.off('mousedown', mousedown);
        map.off('mousemove', mousemove);
        map.off('mouseup', mouseup);
        rectangleHandlersRef.current = null;
      }
      
      // НЕ переключаемся автоматически в режим редактирования после завершения прямоугольника
      if (drawRef.current) {
        drawRef.current.changeMode('simple_select');
        setActiveTool(null);
        activeToolRef.current = null;
        setDrawingMode(DRAWING_MODES.NONE);
      } else {
        setActiveTool(null);
        activeToolRef.current = null;
        setDrawingMode(DRAWING_MODES.NONE);
      }
      map.getCanvas().style.cursor = '';
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
    };

    // Сохраняем ссылки на обработчики
    rectangleHandlersRef.current = {
      mousedown: handleMouseDown,
      mousemove: handleMouseMove,
      mouseup: handleMouseUp
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
  }, [updateRectanglePreview, finishRectangle]);

  // Функция для начала рисования круга
  const startCircleDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    map.getCanvas().style.cursor = 'crosshair';
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.doubleClickZoom.disable();

    const handleMouseDown = (e) => {
      if (e.originalEvent.button !== 0) return;
      isDrawingCircleRef.current = true;
      circleCenterRef.current = e.lngLat;
      map.dragPan.disable();
    };

    const handleMouseMove = (e) => {
      if (!isDrawingCircleRef.current || !circleCenterRef.current) return;
      updateCirclePreview(circleCenterRef.current, e.lngLat);
    };

    const handleMouseUp = (e) => {
      if (!isDrawingCircleRef.current || !circleCenterRef.current) {
        map.dragPan.enable();
        return;
      }
      
      isDrawingCircleRef.current = false;
      map.dragPan.enable();
      
      const endPoint = e.lngLat;
      finishCircle(circleCenterRef.current, endPoint);
      
      // Очищаем обработчики
      if (circleHandlersRef.current) {
        const { mousedown, mousemove, mouseup } = circleHandlersRef.current;
        map.off('mousedown', mousedown);
        map.off('mousemove', mousemove);
        map.off('mouseup', mouseup);
        circleHandlersRef.current = null;
      }
      
      // НЕ переключаемся автоматически в режим редактирования после завершения круга
      if (drawRef.current) {
        drawRef.current.changeMode('simple_select');
        setActiveTool(null);
        activeToolRef.current = null;
        setDrawingMode(DRAWING_MODES.NONE);
      } else {
        setActiveTool(null);
        activeToolRef.current = null;
        setDrawingMode(DRAWING_MODES.NONE);
      }
      map.getCanvas().style.cursor = '';
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
    };

    // Сохраняем ссылки на обработчики
    circleHandlersRef.current = {
      mousedown: handleMouseDown,
      mousemove: handleMouseMove,
      mouseup: handleMouseUp
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
  }, [updateCirclePreview, finishCircle]);

  // Обработчики инструментов рисования
  const handleToolClick = useCallback((tool) => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;

    // Очищаем предпросмотры при переключении инструментов
    clearPreviews();

    // Если выбран тот же инструмент, отключаем его
    if (activeTool === tool) {
      setActiveTool(null);
      activeToolRef.current = null;
      draw.changeMode('simple_select');
      setDrawingMode(DRAWING_MODES.NONE);
      // Восстанавливаем стандартные настройки карты при отключении инструмента
      map.getCanvas().style.cursor = '';
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
      map.dragPan.enable();
      return;
    }

    setActiveTool(tool);
    activeToolRef.current = tool;
    
    switch (tool) {
      case 'point':
        // MapboxDraw сам управляет настройками карты для режимов рисования
        draw.changeMode('draw_point');
        setDrawingMode(DRAWING_MODES.POINT);
        break;
      case 'line':
        // MapboxDraw сам управляет настройками карты для режимов рисования
        draw.changeMode('draw_line_string');
        setDrawingMode(DRAWING_MODES.LINE);
        break;
      case 'polygon':
        // MapboxDraw сам управляет настройками карты для режимов рисования
        draw.changeMode('draw_polygon');
        setDrawingMode(DRAWING_MODES.POLYGON);
        break;
      case 'rectangle':
        setDrawingMode(DRAWING_MODES.RECTANGLE);
        startRectangleDrawing();
        break;
      case 'circle':
        setDrawingMode(DRAWING_MODES.CIRCLE);
        startCircleDrawing();
        break;
      case 'select':
        // Включаем режим редактирования только при нажатии кнопки Edit
        draw.changeMode('simple_select');
        setDrawingMode(DRAWING_MODES.SELECT);
        // Режим выбора нескольких вершин остается активным, если был включен
        break;
      default:
        draw.changeMode('simple_select');
        setDrawingMode(DRAWING_MODES.NONE);
    }
  }, [activeTool, clearPreviews, startRectangleDrawing, startCircleDrawing]);

  // Функция для переключения правой боковой панели
  const toggleRightSidebar = useCallback(() => {
    const newCollapsed = !rightSidebarCollapsed;
    setRightSidebarCollapsed(newCollapsed);
    
    // Обновляем padding карты для корректного отображения
    if (mapRef.current && mapRef.current.loaded()) {
      const padding = {
        right: newCollapsed ? 0 : 300
      };
      mapRef.current.easeTo({
        padding: padding,
        duration: 1000
      });
    }
  }, [rightSidebarCollapsed]);


  // Функция для преобразования editingProperties в полный объект GeoJSON
  const convertEditingPropertiesToObject = useCallback((props) => {
    const result = {};
    // Список числовых свойств simplestyle
    const numericProps = ['stroke-width', 'stroke-opacity', 'fill-opacity'];
    
    props.forEach(prop => {
      const key = prop.key.trim();
      const valueStr = prop.value.trim();
      
      // Пропускаем строки с пустыми ключами
      if (!key) return;
      
      // Пытаемся распарсить значение как JSON
      if (valueStr && (valueStr.startsWith('{') || valueStr.startsWith('['))) {
        try {
          result[key] = JSON.parse(valueStr);
        } catch (e) {
          // Если не удалось распарсить, сохраняем как строку
          result[key] = valueStr;
        }
      } else if (valueStr === '') {
        // Пустое значение сохраняем как пустую строку
        result[key] = '';
      } else {
        // Для числовых свойств simplestyle принудительно преобразуем в число
        if (numericProps.includes(key.toLowerCase()) && valueStr !== '') {
          const num = parseFloat(valueStr);
          result[key] = !isNaN(num) ? num : valueStr;
        } else if (valueStr === 'true') {
          result[key] = true;
        } else if (valueStr === 'false') {
          result[key] = false;
        } else if (!isNaN(valueStr) && valueStr !== '') {
          // Пытаемся преобразовать в число
          const num = parseFloat(valueStr);
          if (!isNaN(num)) {
            result[key] = num;
          } else {
            result[key] = valueStr;
          }
        } else {
          // Обычное строковое значение
          result[key] = valueStr;
        }
      }
    });
    return result;
  }, []);

  // Функция для обновления объекта на карте с новыми свойствами
  const updateFeaturePreview = useCallback((allFields) => {
    if (!drawRef.current || !selectedFeature) return;
    
    try {
      const currentFeatureId = selectedFeature.id;
      
      // Получаем текущий объект
      const allFeatures = drawRef.current.getAll();
      const featureToUpdate = allFeatures.features.find(f => f.id === currentFeatureId);
      
      if (featureToUpdate) {
        // Все поля из editingProperties
        // (id и type исключены из editingProperties, поэтому их здесь нет)
        const propertiesFields = allFields;
        
        // ID и type остаются неизменными (берем из исходного объекта)
        const finalId = featureToUpdate.id || currentFeatureId;
        const finalType = featureToUpdate.type || 'Feature';
        
        // Разделяем поля: simplestyle -> properties, остальные -> properties._rootFields
        const simplestyleProperties = {};
        const rootLevelFields = {};
        
        Object.keys(propertiesFields).forEach((key) => {
          if (SIMPLESTYLE_PROPERTIES.includes(key.toLowerCase())) {
            simplestyleProperties[key] = propertiesFields[key];
          } else {
            rootLevelFields[key] = propertiesFields[key];
          }
        });
        
        // Geometry остается неизменной (берем из текущего объекта)
        const finalGeometry = featureToUpdate.geometry;
        
        // ВАЖНО: rootLevelFields кладём в properties._rootFields (Draw это сохранит)
        // НЕ делаем ...rootLevelFields в корень — Draw их выкинет
        const updatedFeature = {
          id: finalId,
          type: finalType,
          geometry: finalGeometry,
          properties: {
            ...simplestyleProperties,
            _rootFields: rootLevelFields
          }
        };
        
        // Обновляем объект (ID остается неизменным)
        // Используем только add - MapboxDraw обновит фичу, если id совпадает
        // Это избегает ломания выделения/режимов и лишних событий
        drawRef.current.add(updatedFeature);
        
        // Обновляем список объектов
        const updatedFeatures = drawRef.current.getAll();
        updateDrawnFeaturesDebounced(updatedFeatures.features);
        
        // НЕ обновляем selectedFeature здесь, чтобы не вызывать перезапуск useEffect
        // и не перезаписывать editingProperties, которые пользователь редактирует
        // selectedFeature будет обновлен только при закрытии/открытии диалога
      }
    } catch (error) {
      console.warn('Error updating feature preview:', error);
    }
  }, [selectedFeature]);

  // Ref для отслеживания ID последнего инициализированного объекта
  const lastInitializedFeatureIdRef = useRef(null);

  // Эффект для инициализации свойств при открытии диалога
  useEffect(() => {
    if (featureDialogOpen && selectedFeature) {
      // Сбрасываем флаг сохранения при открытии диалога
      didSaveRef.current = false;
      
      // Инициализируем properties только если это новый объект (с другим ID) или диалог только открылся
      const currentFeatureId = selectedFeature.id;
      if (lastInitializedFeatureIdRef.current !== currentFeatureId) {
        // Сохраняем исходный объект для возможной отмены (используем безопасное клонирование)
        originalFeatureRef.current = safeClone(selectedFeature);
        
        // Преобразуем все ключи объекта в массив пар ключ-значение
        const propsArray = [];
        
        // Добавляем все ключи из корня объекта (но НЕ id, type, properties и geometry)
        Object.keys(selectedFeature).forEach(key => {
          // Пропускаем служебные поля и специальные поля GeoJSON
          if (key === '_mapboxFeatureId' || key === '_mapboxFeatureState' || 
              key === 'properties' || key === 'geometry' ||
              key === 'id' || key === 'type') {
            return;
          }
          
          const value = selectedFeature[key];
          // Если значение - объект или массив, преобразуем в JSON строку
          if (typeof value === 'object' && value !== null) {
            propsArray.push({ key, value: safeStringify(value, 2) });
          } else {
            propsArray.push({ key, value: String(value) });
          }
        });
        
        // Добавляем ключи из properties как отдельные строки
        const properties = selectedFeature.properties || {};
        
        // Сначала добавляем свойства из properties (кроме _rootFields)
        Object.keys(properties).forEach(key => {
          if (key === '_rootFields') return; // Пропускаем _rootFields, обработаем позже
          
          const value = properties[key];
          // Если значение - объект, преобразуем в JSON строку
          if (typeof value === 'object' && value !== null) {
            propsArray.push({ key, value: safeStringify(value, 2) });
          } else {
            propsArray.push({ key, value: String(value) });
          }
        });
        
        // Затем добавляем корневые поля из _rootFields (для обратной совместимости)
        // если они еще не были добавлены из корня объекта
        const rootFieldsFromProperties = properties._rootFields || {};
        Object.keys(rootFieldsFromProperties).forEach(key => {
          // Проверяем, не было ли это поле уже добавлено из корня объекта
          if (!propsArray.some(prop => prop.key === key)) {
            const value = rootFieldsFromProperties[key];
            // Если значение - объект, преобразуем в JSON строку
            if (typeof value === 'object' && value !== null) {
              propsArray.push({ key, value: safeStringify(value, 2) });
            } else {
              propsArray.push({ key, value: String(value) });
            }
          }
        });
        
        // Если свойств нет, добавляем одну пустую строку
        if (propsArray.length === 0) {
          propsArray.push({ key: '', value: '' });
        }
        setEditingProperties(propsArray);
        lastInitializedFeatureIdRef.current = currentFeatureId;
      }
    } else {
      setEditingProperties([]);
      originalFeatureRef.current = null;
      lastInitializedFeatureIdRef.current = null;
    }
  }, [featureDialogOpen, selectedFeature?.id]); // Используем только ID для отслеживания смены объекта

  // Ref для отслеживания того, что обновление инициировано програмно (не пользователем)
  const isInternalUpdateRef = useRef(false);

  // Эффект для обновления объекта на карте при изменении свойств (с debounce)
  useEffect(() => {
    if (!featureDialogOpen || !selectedFeature || editingProperties.length === 0) return;
    // Пропускаем обновление, если это внутреннее обновление от updateFeaturePreview
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    
    // Используем debounce для оптимизации обновлений
    const timeoutId = setTimeout(() => {
      try {
        const allFields = convertEditingPropertiesToObject(editingProperties);
        
        // Разделяем поля на simplestyle и остальные для сравнения
        const propertiesFields = allFields;
        const currentProperties = selectedFeature.properties || {};
        
        // Получаем текущие корневые поля из properties._rootFields
        const currentRootFields = currentProperties._rootFields || {};
        
        // Разделяем новые поля на simplestyle и остальные
        const newSimplestyle = {};
        const newRootFields = {};
        Object.keys(propertiesFields).forEach(key => {
          if (SIMPLESTYLE_PROPERTIES.includes(key.toLowerCase())) {
            newSimplestyle[key] = propertiesFields[key];
          } else {
            newRootFields[key] = propertiesFields[key];
          }
        });
        
        // Удаляем _rootFields из currentProperties для сравнения simplestyle
        const currentSimplestyle = { ...currentProperties };
        delete currentSimplestyle._rootFields;
        
        // Проверяем, изменились ли properties или корневые поля
        const propertiesChanged = safeStringify(newSimplestyle) !== safeStringify(currentSimplestyle);
        const rootFieldsChanged = safeStringify(newRootFields) !== safeStringify(currentRootFields);
        
        if (propertiesChanged || rootFieldsChanged) {
          isInternalUpdateRef.current = true;
          updateFeaturePreview(allFields);
        }
      } catch (error) {
        console.warn('Error updating feature from properties:', error);
      }
    }, 150); // Задержка 150ms для debounce

    return () => clearTimeout(timeoutId);
  }, [editingProperties, featureDialogOpen, selectedFeature, convertEditingPropertiesToObject, updateFeaturePreview]);

  // Эффект для подсветки объекта при наведении
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    
    if (!map || !draw || !map.loaded()) return;

    const sourceId = 'hover-highlight';
    let source = map.getSource(sourceId);
    
    // Если source не существует, создаем его
    if (!source) {
      try {
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        source = map.getSource(sourceId);
      } catch (e) {
        console.warn('Не удалось создать source для подсветки:', e);
        return;
      }
    }
    
    if (!source) return;

    // Если нет объекта для подсветки, устанавливаем пустую коллекцию
    if (!hoveredFeatureId) {
      source.setData({ type: 'FeatureCollection', features: [] });
      // Скрываем все слои подсветки
      ['hover-highlight-fill', 'hover-highlight-line', 'hover-highlight-point'].forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
      return;
    }

    // Находим объект по ID
    const allFeatures = draw.getAll();
    if (!allFeatures || !allFeatures.features) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    
    const feature = allFeatures.features.find(f => f.id === hoveredFeatureId);
    
    if (!feature) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const highlightFeature = {
      ...feature,
      properties: {
        ...feature.properties,
        highlight: true
      }
    };

    // Обновляем данные источника
    source.setData(highlightFeature);

    // Определяем тип геометрии и создаем/показываем соответствующие слои
    const geometry = feature.geometry;
    const layerIds = [];

    if (geometry.type === 'Polygon') {
      // Создаем слои один раз, если их нет
      if (!map.getLayer('hover-highlight-fill')) {
        map.addLayer({
          id: 'hover-highlight-fill',
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#FFD700',
            'fill-opacity': 0.5
          }
        });
      }
      if (!map.getLayer('hover-highlight-line')) {
        map.addLayer({
          id: 'hover-highlight-line',
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#FFD700',
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
      }
      // Показываем нужные слои, скрываем остальные
      if (map.getLayer('hover-highlight-fill')) {
        map.setLayoutProperty('hover-highlight-fill', 'visibility', 'visible');
      }
      if (map.getLayer('hover-highlight-line')) {
        map.setLayoutProperty('hover-highlight-line', 'visibility', 'visible');
      }
      if (map.getLayer('hover-highlight-point')) {
        map.setLayoutProperty('hover-highlight-point', 'visibility', 'none');
      }
      layerIds.push('hover-highlight-fill', 'hover-highlight-line');
    } else if (geometry.type === 'LineString') {
      if (!map.getLayer('hover-highlight-line')) {
        map.addLayer({
          id: 'hover-highlight-line',
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#FFD700',
            'line-width': 4,
            'line-opacity': 0.9
          }
        });
      }
      if (map.getLayer('hover-highlight-line')) {
        map.setLayoutProperty('hover-highlight-line', 'visibility', 'visible');
      }
      if (map.getLayer('hover-highlight-fill')) {
        map.setLayoutProperty('hover-highlight-fill', 'visibility', 'none');
      }
      if (map.getLayer('hover-highlight-point')) {
        map.setLayoutProperty('hover-highlight-point', 'visibility', 'none');
      }
      layerIds.push('hover-highlight-line');
    } else if (geometry.type === 'Point') {
      if (!map.getLayer('hover-highlight-point')) {
        map.addLayer({
          id: 'hover-highlight-point',
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 12,
            'circle-color': '#FFD700',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FFFFFF',
            'circle-opacity': 0.9
          }
        });
      }
      if (map.getLayer('hover-highlight-point')) {
        map.setLayoutProperty('hover-highlight-point', 'visibility', 'visible');
      }
      if (map.getLayer('hover-highlight-fill')) {
        map.setLayoutProperty('hover-highlight-fill', 'visibility', 'none');
      }
      if (map.getLayer('hover-highlight-line')) {
        map.setLayoutProperty('hover-highlight-line', 'visibility', 'none');
      }
      layerIds.push('hover-highlight-point');
    }

    // Перемещаем слои подсветки поверх всех слоев MapboxDraw
    const style = map.getStyle();
    if (style && style.layers) {
      const drawLayers = style.layers
        .filter(layer => layer.id && layer.id.startsWith('gl-draw-'))
        .map(layer => layer.id);
      
      if (drawLayers.length > 0 && layerIds.length > 0) {
        const lastDrawLayer = drawLayers[drawLayers.length - 1];
        layerIds.forEach(layerId => {
          try {
            map.moveLayer(layerId, lastDrawLayer);
          } catch (e) {
            // Игнорируем ошибки, если слой уже в правильной позиции
          }
        });
      }
    }
  }, [hoveredFeatureId]);

  // Cleanup geocoder и draw при размонтировании
  useEffect(() => {
    return () => {
      // Вызываем cleanup функции карты
      mapCleanupRef.current?.();
      
      // Очищаем таймауты при размонтировании
      if (featuresUpdateTimeoutRef.current) {
        clearTimeout(featuresUpdateTimeoutRef.current);
        featuresUpdateTimeoutRef.current = null;
      }
      
      if (geocoderRef.current) {
        const g = geocoderRef.current;
        try {
          // Правильно удаляем обработчики событий
          if (g._handlers) {
            if (g._handlers.onGeocoderResult) {
              g.off('result', g._handlers.onGeocoderResult);
            }
            if (g._handlers.onGeocoderError) {
              g.off('error', g._handlers.onGeocoderError);
            }
          }
          // Корректно удаляем контрол
          if (typeof g.onRemove === 'function') {
            g.onRemove();
          }
        } catch (e) {
          console.warn('Error cleaning up geocoder:', e);
        } finally {
          geocoderRef.current = null;
          if (geocoderContainerRef.current) {
            geocoderContainerRef.current.innerHTML = '';
          }
        }
      }
      if (drawRef.current && mapRef.current) {
        try {
          mapRef.current.removeControl(drawRef.current);
        } catch (e) {
          console.warn('Error cleaning up draw:', e);
        }
        drawRef.current = null;
      }
      // Очищаем подсветку при размонтировании
      if (mapRef.current) {
        const hoverLayers = ['hover-highlight-fill', 'hover-highlight-line', 'hover-highlight-point'];
        hoverLayers.forEach(layerId => {
          if (mapRef.current.getLayer(layerId)) {
            mapRef.current.removeLayer(layerId);
          }
        });
        if (mapRef.current.getSource('hover-highlight')) {
          mapRef.current.removeSource('hover-highlight');
        }
        highlightLayerRef.current = null;
      }
    };
  }, []);

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      position: 'relative',
      overflow: 'hidden',
      '& .mapboxgl-control-container': {
        display: 'none !important'
      }
    }}>
      {/* Индикатор загрузки слоя */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        open={loadingLayer}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: 3,
          p: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          minWidth: 300
        }}>
          <CircularProgress 
            color="inherit" 
            size={60}
            variant={loadingProgress > 0 ? "determinate" : "indeterminate"}
            value={loadingProgress}
            thickness={4}
          />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
              {loadingMessage}
            </Typography>
            {loadingProgress > 0 && (
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {loadingProgress}%
              </Typography>
            )}
          </Box>
        </Box>
      </Backdrop>

      {/* Контейнер для Mapbox Geocoder */}
      <Box
        ref={geocoderContainerRef}
        sx={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          width: '50%',
          maxWidth: 400,
          '& .mapboxgl-ctrl-geocoder': {
            minWidth: '100%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          },
        }}
      />

      {/* Кнопка назад */}
      <Button
        variant="contained"
        startIcon={<BackIcon />}
        onClick={() => navigateWithCheck('/app/layers')}
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 1000,
          borderRadius: 2
        }}
      >
        Назад
      </Button>

      {/* Карта */}
      <Map
        ref={mapComponentRef}
        mapId="draw-layer-map"
        style={`mapbox://styles/mapbox/${mapStyle}`}
        center={[66.9, 48.0]}
        zoom={5}
        pitch={0}
        bearing={0}
        projection={mapProjection}
        onMapReady={handleMapReady}
        disableAutoUpdate={true}
      />

      {/* Вертикальная панель инструментов */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {/* Группа 1: Инструменты навигации/зума */}
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
          <Tooltip title="Увеличить" placement="left">
            <IconButton
              onClick={handleZoomIn}
              sx={{
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Уменьшить" placement="left">
            <IconButton
              onClick={handleZoomOut}
              sx={{
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <RemoveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Сбросить вид" placement="left">
            <IconButton
              onClick={handleResetView}
              sx={{
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <PanIcon />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Группа 2: Инструменты рисования */}
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
          <Tooltip title="Точка" placement="left">
            <IconButton
              onClick={() => handleToolClick('point')}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: activeTool === 'point' ? '#e3f2fd' : 'transparent',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <LocationOnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Линия" placement="left">
            <IconButton
              onClick={() => handleToolClick('line')}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: activeTool === 'line' ? '#e3f2fd' : 'transparent',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <TimelineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Полигон" placement="left">
            <IconButton
              onClick={() => handleToolClick('polygon')}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: activeTool === 'polygon' ? '#e3f2fd' : 'transparent',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <StarIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Прямоугольник" placement="left">
            <IconButton
              onClick={() => handleToolClick('rectangle')}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: activeTool === 'rectangle' ? '#e3f2fd' : 'transparent',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <RectangleIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Круг" placement="left">
            <IconButton
              onClick={() => handleToolClick('circle')}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: activeTool === 'circle' ? '#e3f2fd' : 'transparent',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <CircleIcon />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Группа 3: Инструмент редактирования */}
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
          <Tooltip title="Выбрать/Редактировать" placement="left">
            <IconButton
              onClick={() => handleToolClick('select')}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: activeTool === 'select' ? '#e3f2fd' : 'transparent',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {activeTool === 'select' && (
            <Tooltip 
              title={multiVertexSelectMode ? "Отключить выбор нескольких вершин (выделение мышкой)" : "Включить выбор нескольких вершин (выделение мышкой)"} 
              placement="left"
            >
              <IconButton
                onClick={() => {
                  const newMode = !multiVertexSelectMode;
                  setMultiVertexSelectMode(newMode);
                  multiVertexSelectModeRef.current = newMode;
                }}
                sx={{
                  width: 40,
                  height: 40,
                  backgroundColor: multiVertexSelectMode ? '#e3f2fd' : 'transparent',
                  '&:hover': { backgroundColor: '#f5f5f5' },
                }}
              >
                {multiVertexSelectMode ? <SelectAllIcon /> : <MultiSelectIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Paper>

        {/* Группа 5: Сохранение */}
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
          <Tooltip title="Сохранить слой" placement="left">
            <span>
              <IconButton
                onClick={handleSave}
                disabled={drawnFeatures.length === 0}
                sx={{
                  width: 40,
                  height: 40,
                  color: drawnFeatures.length === 0 ? 'gray' : '#4caf50',
                  '&:hover': { backgroundColor: '#f5f5f5' },
                  '&:disabled': { color: 'gray' },
                }}
              >
                <SaveIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Paper>

        {/* Группа 4: Настройки */}
        {/* Кнопка открытия панели скрыта, так как панель всегда открыта */}
        {rightSidebarCollapsed && (
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
            <Tooltip title="Открыть панель" placement="left">
              <IconButton
                onClick={() => setRightSidebarCollapsed(false)}
                sx={{
                  width: 40,
                  height: 40,
                  '&:hover': { backgroundColor: '#f5f5f5' },
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Paper>
        )}

      </Box>

      {/* Правая боковая панель */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 300,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          transition: 'transform 1s',
          transform: rightSidebarCollapsed ? 'translateX(295px)' : 'translateX(0)',
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
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: 20,
                  color: 'gray',
                  mb: 2,
                  fontWeight: 'bold',
                }}
              >
                Правая панель
              </Typography>
              
              <Divider sx={{ mb: 1 }} />
            </Box>
            
            <Tabs 
              value={rightSidebarTab} 
              onChange={(e, newValue) => setRightSidebarTab(newValue)}
              sx={{ 
                borderBottom: 1, 
                borderColor: 'divider',
                px: 2,
                minHeight: 48,
              }}
              variant="fullWidth"
            >
              <Tab label="Объекты" />
              <Tab label="JSON" />
            </Tabs>
            
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Вкладка 1: Список объектов */}
              {rightSidebarTab === 0 && (
                <Box 
                  ref={featuresListRef}
                  onScroll={handleFeaturesListScroll}
                  sx={{ 
                    flex: 1, 
                    overflowY: 'scroll', // Принудительное отображение скроллбара
                    overflowX: 'hidden',
                    p: 2,
                    minHeight: 0,
                    // Стили для скроллбара
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e0 #f7fafc',
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#f7fafc',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: '#cbd5e0',
                      borderRadius: '4px',
                      '&:hover': {
                        backgroundColor: '#a0aec0',
                      },
                    },
                  }}
                >
                  {drawnFeatures.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center', mt: 2 }}
                    >
                      Нет объектов на карте
                    </Typography>
                  ) : (
                    <>
                      {hasMoreFeatures && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mb: 1, display: 'block', textAlign: 'center' }}
                        >
                          Показано {visibleFeatures.length} из {drawnFeatures.length} объектов
                        </Typography>
                      )}
                      <List dense>
                        {visibleFeatures.map((feature, index) => (
                        <ListItem
                          key={feature.id || index}
                          disablePadding
                          secondaryAction={
                            <ListItemSecondaryAction>
                              <IconButton
                                edge="end"
                                aria-label="Показать на карте"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFocusFeature(feature);
                                }}
                                sx={{
                                  color: 'primary.main',
                                  '&:hover': {
                                    backgroundColor: 'action.hover',
                                    color: 'primary.dark',
                                  },
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </ListItemSecondaryAction>
                          }
                          sx={{
                            mb: 1,
                          }}
                        >
                          <ListItemButton
                            onClick={() => {
                              // Очищаем объект от ссылок на карту перед установкой
                              const cleanedFeature = safeClone(feature) || feature;
                              setSelectedFeature(cleanedFeature);
                              setFeatureDialogOpen(true);
                              setDialogTab(0);
                              if (drawRef.current) {
                                // Если кнопка Edit активна, сразу переходим в режим редактирования
                                if (activeToolRef.current === 'select') {
                                  // Запоминаем featureId перед входом в direct_select
                                  editingFeatureIdRef.current = feature.id;
                                  selectedFeatureIdRef.current = feature.id;
                                  drawRef.current.changeMode('direct_select', { featureId: feature.id });
                                } else {
                                  drawRef.current.changeMode('simple_select', { featureIds: [feature.id] });
                                }
                              }
                            }}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              pr: 7, // Отступ справа для иконки
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                            }}
                          >
                            <ListItemText
                              primary={`Объект ${index + 1}`}
                              secondary={`Тип: ${feature.geometry?.type || 'Unknown'}`}
                            />
                          </ListItemButton>
                        </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                </Box>
              )}
              
              {/* Вкладка 2: JSON */}
              {rightSidebarTab === 1 && (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    p: 2,
                    overflow: 'auto',
                  }}
                >
                  {drawnFeatures.length > 1000 && (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      sx={{ mb: 1, display: 'block' }}
                    >
                      Внимание: Большой файл ({drawnFeatures.length} объектов). JSON может быть неполным для производительности.
                    </Typography>
                  )}
                  <TextField
                    multiline
                    fullWidth
                    value={jsonString}
                    InputProps={{
                      readOnly: true,
                      sx: {
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        '& textarea': {
                          overflow: 'auto !important',
                          resize: 'none',
                        },
                      },
                    }}
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      mb: 2,
                      '& .MuiInputBase-root': {
                        height: '100%',
                        alignItems: 'flex-start',
                        overflow: 'hidden',
                      },
                      '& .MuiInputBase-input': {
                        height: '100% !important',
                        overflow: 'auto !important',
                      },
                    }}
                  />
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setTableDialogOpen(true)}
                    sx={{ mt: 'auto' }}
                  >
                    Открыть таблицу
                  </Button>
                </Box>
              )}
              
            </Box>
          </Box>
          
        </Paper>
      </Box>

      {/* Диалог свойств объекта */}
      <Dialog 
        open={featureDialogOpen} 
        onClose={() => {
          // Откатываем только если пользователь НЕ нажимал Save
          if (!didSaveRef.current && drawRef.current && originalFeatureRef.current) {
            try {
              const allFeatures = drawRef.current.getAll();
              const currentFeature = allFeatures.features.find(f => f.id === originalFeatureRef.current.id);
              
              if (currentFeature) {
                // Восстанавливаем исходный объект полностью
                const restoredFeature = {
                  ...originalFeatureRef.current
                };
                
                // Удаляем служебные поля MapboxDraw из исходного объекта
                delete restoredFeature._mapboxFeatureId;
                delete restoredFeature._mapboxFeatureState;
                
                drawRef.current.delete(originalFeatureRef.current.id);
                drawRef.current.add(restoredFeature);
                
                // Обновляем список объектов
                const updatedFeatures = drawRef.current.getAll();
                updateDrawnFeaturesDebounced(updatedFeatures.features, true);
              }
            } catch (error) {
              console.warn('Error restoring original feature:', error);
            }
          }
          
          setFeatureDialogOpen(false);
          setSelectedFeature(null);
          setEditingProperties([]);
          originalFeatureRef.current = null;
          didSaveRef.current = false; // Сбрасываем флаг
          // Снимаем выделение с объекта
          if (drawRef.current) {
            drawRef.current.changeMode('simple_select', { featureIds: [] });
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Свойства объекта</DialogTitle>
        <DialogContent>
          <Tabs value={dialogTab} onChange={(e, newValue) => setDialogTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="Properties" />
            <Tab label="Info" />
          </Tabs>
          
          {dialogTab === 0 && (
            <Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '40%' }}>Key</TableCell>
                      <TableCell sx={{ width: '55%' }}>Value</TableCell>
                      <TableCell sx={{ width: '5%' }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editingProperties.map((prop, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ padding: '8px' }}>
              <TextField
                fullWidth
                size="small"
                            value={prop.key}
                            onChange={(e) => {
                              const newProps = [...editingProperties];
                              newProps[index].key = e.target.value;
                              setEditingProperties(newProps);
                            }}
                            placeholder="Key"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ padding: '8px' }}>
                          {(() => {
                            const isColorProperty = prop.key.trim().toLowerCase() === 'stroke' || prop.key.trim().toLowerCase() === 'fill';
                            const colorValue = prop.value.trim();
                            // Проверяем, является ли значение валидным hex цветом
                            const isValidColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorValue);
                            
                            if (isColorProperty) {
                              // Используем callback ref для хранения элемента
                              const inputKey = `color-input-${index}`;
                              
                              return (
                                <>
                                  <input
                                    ref={(el) => { 
                                      if (el) {
                                        colorInputRefsRef.current[inputKey] = el;
                                      } else {
                                        delete colorInputRefsRef.current[inputKey];
                                      }
                                    }}
                                    type="color"
                                    value={isValidColor ? colorValue : '#555555'}
                                    onChange={(e) => {
                                      const newProps = [...editingProperties];
                                      newProps[index].value = e.target.value.toUpperCase();
                                      setEditingProperties(newProps);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      opacity: 0,
                                      width: 0,
                                      height: 0,
                                      pointerEvents: 'none',
                                    }}
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    value={prop.value}
                                    onClick={() => {
                                      // Открываем цветовой пикер при клике на текстовое поле
                                      const colorInput = colorInputRefsRef.current[inputKey];
                                      if (colorInput) {
                                        colorInput.click();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const newProps = [...editingProperties];
                                      // Автоматически добавляем # если его нет
                                      let newValue = e.target.value.trim();
                                      if (newValue && !newValue.startsWith('#')) {
                                        newValue = '#' + newValue;
                                      }
                                      newProps[index].value = newValue;
                                      setEditingProperties(newProps);
                                    }}
                                    placeholder="#555555"
                                    variant="outlined"
                                    inputProps={{
                                      pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
                                      maxLength: 7,
                                    }}
                                    InputProps={{
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          <Box
                                            sx={{
                                              width: 16,
                                              height: 16,
                                              borderRadius: '50%',
                                              backgroundColor: isValidColor ? colorValue : '#555555',
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              flexShrink: 0,
                                            }}
                                          />
                                        </InputAdornment>
                                      ),
                                    }}
                                    sx={{
                                      cursor: 'pointer',
                                      '& .MuiOutlinedInput-root': {
                                        cursor: 'pointer',
                                      },
                                    }}
                                  />
                                </>
                              );
                            }
                            
                            return (
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                maxRows={4}
                                value={prop.value}
                                onChange={(e) => {
                                  const newProps = [...editingProperties];
                                  newProps[index].value = e.target.value;
                                  setEditingProperties(newProps);
                                }}
                                placeholder="Value (строка, число, или JSON объект)"
                                variant="outlined"
                                helperText={prop.value && (prop.value.startsWith('{') || prop.value.startsWith('[')) 
                                  ? 'JSON будет автоматически отформатирован при потере фокуса'
                                  : ''}
                                onBlur={(e) => {
                                  // Попытка автоматически распарсить и переформатировать JSON
                                  const inputValue = e.target.value.trim();
                                  if (inputValue && (inputValue.startsWith('{') || inputValue.startsWith('['))) {
                                    try {
                                      const parsed = JSON.parse(inputValue);
                                      const newProps = [...editingProperties];
                                      // Форматируем JSON с отступами для читаемости (используем безопасную сериализацию)
                                      newProps[index].value = safeStringify(parsed, 2);
                                      setEditingProperties(newProps);
                                    } catch (err) {
                                      // Если не удалось распарсить, оставляем как есть
                                      // Можно показать ошибку, но пока просто игнорируем
                                    }
                                  } else if (inputValue === '') {
                                    // Если значение пустое, оставляем пустым
                                    const newProps = [...editingProperties];
                                    newProps[index].value = '';
                                    setEditingProperties(newProps);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  // При нажатии Ctrl+Enter добавляем новую строку (вместо Shift+Enter для новой строки в тексте)
                                  if (e.key === 'Enter' && e.ctrlKey && index === editingProperties.length - 1) {
                                    e.preventDefault();
                                    setEditingProperties([...editingProperties, { key: '', value: '' }]);
                                  }
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell sx={{ padding: '8px' }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const newProps = editingProperties.filter((_, i) => i !== index);
                              setEditingProperties(newProps);
                              // Немедленно применяем изменения при удалении ключа
                              setTimeout(() => {
                                try {
                                  const allFields = convertEditingPropertiesToObject(newProps);
                                  updateFeaturePreview(allFields);
                                } catch (error) {
                                  console.warn('Error updating feature after delete:', error);
                                }
                              }, 50);
                            }}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingProperties([...editingProperties, { key: '', value: '' }]);
                  }}
                >
                  Добавить строку
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    // Определяем стандартные свойства стиля
                    const simpleStyleProps = [
                      { key: 'stroke', value: '#555555' },
                      { key: 'stroke-width', value: '2' },
                      { key: 'stroke-opacity', value: '1' },
                      { key: 'fill', value: '#555555' },
                      { key: 'fill-opacity', value: '0.5' }
                    ];
                    
                    // Получаем список существующих ключей (без учета регистра и пробелов)
                    const existingKeys = new Set(
                      editingProperties
                        .map(prop => prop.key.trim().toLowerCase())
                        .filter(key => key !== '')
                    );
                    
                    // Фильтруем только те свойства, которых еще нет
                    const missingProps = simpleStyleProps.filter(
                      prop => !existingKeys.has(prop.key.toLowerCase())
                    );
                    
                    // Добавляем только недостающие свойства
                    if (missingProps.length > 0) {
                      setEditingProperties([...editingProperties, ...missingProps]);
                    }
                    // Если все свойства уже есть, ничего не делаем (или можно показать сообщение)
                  }}
                  disabled={(() => {
                    // Отключаем кнопку, если все simplestyle свойства уже присутствуют
                    const simpleStyleKeys = ['stroke', 'stroke-width', 'stroke-opacity', 'fill', 'fill-opacity'];
                    const existingKeys = new Set(
                      editingProperties
                        .map(prop => prop.key.trim().toLowerCase())
                        .filter(key => key !== '')
                    );
                    return simpleStyleKeys.every(key => existingKeys.has(key.toLowerCase()));
                  })()}
                >
                  Добавить simplestyle свойства
                </Button>
              </Box>
            </Box>
          )}
          
          {dialogTab === 1 && selectedFeature && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                Основная информация
              </Typography>
              <Table size="small" sx={{ mb: 3 }}>
                <TableBody>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      ID
                    </TableCell>
                    <TableCell>{selectedFeature.id || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      Type
                    </TableCell>
                    <TableCell>{selectedFeature.type || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      Geometry Type
                    </TableCell>
                    <TableCell>{selectedFeature.geometry?.type || 'N/A'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              {selectedFeature.geometry.type === 'Polygon' && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Площадь
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      {(() => {
                        const areaM2 = calculatePolygonArea(selectedFeature);
                        const formatted = formatArea(areaM2);
                        return [
                          { label: 'Sq. Meters', value: formatted.sqMeters.toFixed(2) },
                          { label: 'Sq. Kilometers', value: formatted.sqKilometers.toFixed(2) },
                          { label: 'Sq. Feet', value: formatted.sqFeet.toFixed(2) },
                          { label: 'Acres', value: formatted.acres.toFixed(2) },
                          { label: 'Sq. Miles', value: formatted.sqMiles.toFixed(2) },
                        ];
                      })().map((row) => (
                        <TableRow key={row.label}>
                          <TableCell component="th" scope="row">
                            {row.label}
                          </TableCell>
                          <TableCell align="right">{row.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              // Восстанавливаем исходный объект при отмене
              if (drawRef.current && originalFeatureRef.current) {
                try {
                  const allFeatures = drawRef.current.getAll();
                  const currentFeature = allFeatures.features.find(f => f.id === originalFeatureRef.current.id);
                  
                  if (currentFeature) {
                    // Восстанавливаем исходный объект полностью
                    const restoredFeature = {
                      ...originalFeatureRef.current
                    };
                    
                    // Удаляем служебные поля MapboxDraw из исходного объекта
                    delete restoredFeature._mapboxFeatureId;
                    delete restoredFeature._mapboxFeatureState;
                    
                    drawRef.current.delete(originalFeatureRef.current.id);
                    drawRef.current.add(restoredFeature);
                    
                    // Обновляем список объектов
                    const updatedFeatures = drawRef.current.getAll();
                    updateDrawnFeaturesDebounced(updatedFeatures.features, true);
                  }
                } catch (error) {
                  console.warn('Error restoring original feature:', error);
                }
              }
              
              setFeatureDialogOpen(false);
              setSelectedFeature(null);
              setEditingProperties([]);
              originalFeatureRef.current = null;
              
              if (drawRef.current) {
                drawRef.current.changeMode('simple_select', { featureIds: [] });
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={() => {
              // Устанавливаем флаг, что было сохранение
              didSaveRef.current = true;
              
              if (drawRef.current && selectedFeature) {
                // Используем функцию преобразования для получения всех полей
                const allFields = convertEditingPropertiesToObject(editingProperties);
                
                // Все поля из editingProperties попадают в properties
                // (id и type исключены из editingProperties, поэтому их здесь нет)
                const propertiesFields = allFields;
                
                // Обновляем свойства объекта через MapboxDraw
                // Используем getAll() для безопасного получения объекта
                const allFeatures = drawRef.current.getAll();
                const currentFeatureId = selectedFeature.id;
                const featureToUpdate = allFeatures.features.find(f => f.id === currentFeatureId);
                
                if (featureToUpdate) {
                  // ID и type остаются неизменными (берем из исходного объекта)
                  const finalId = featureToUpdate.id || currentFeatureId;
                  const finalType = featureToUpdate.type || 'Feature';
                  
                  // Разделяем поля: simplestyle -> properties, остальные -> properties._rootFields
                  const simplestyleProperties = {};
                  const rootLevelFields = {};
                  
                  Object.keys(propertiesFields).forEach((key) => {
                    if (SIMPLESTYLE_PROPERTIES.includes(key.toLowerCase())) {
                      simplestyleProperties[key] = propertiesFields[key];
                    } else {
                      rootLevelFields[key] = propertiesFields[key];
                    }
                  });
                  
                  // Geometry остается неизменной (берем из текущего объекта)
                  const finalGeometry = featureToUpdate.geometry;
                  
                  // ВАЖНО: rootLevelFields кладём в properties._rootFields (Draw это сохранит)
                  // НЕ делаем ...rootLevelFields в корень — Draw их выкинет
                  const updatedFeature = {
                    id: finalId,
                    type: finalType,
                    geometry: finalGeometry,
                    properties: {
                      ...simplestyleProperties,
                      _rootFields: rootLevelFields
                    }
                  };
                  
                  // Обновляем объект (ID остается неизменным)
                  drawRef.current.delete(currentFeatureId);
                  drawRef.current.add(updatedFeature);
                  
                  // Обновляем список объектов
                  const finalFeatures = drawRef.current.getAll();
                  updateDrawnFeaturesDebounced(finalFeatures.features, true);
                  
                  // Снимаем выделение с объекта после сохранения
                  drawRef.current.changeMode('simple_select', { featureIds: [] });
                } else {
                  console.warn('Feature not found:', selectedFeature.id);
                }
              }
              
              setFeatureDialogOpen(false);
              setSelectedFeature(null);
              setEditingProperties([]);
              originalFeatureRef.current = null;
            }}
          >
            Save
          </Button>
          <Button
            color="error"
            onClick={() => {
              if (drawRef.current && selectedFeature) {
                drawRef.current.delete(selectedFeature.id);
                const features = drawRef.current.getAll();
                updateDrawnFeaturesDebounced(features.features, true);
              }
              setFeatureDialogOpen(false);
              setSelectedFeature(null);
            }}
            startIcon={<DeleteIcon />}
          >
            Delete feature
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог сохранения */}
      <Dialog 
        open={saveDialogOpen} 
        onClose={() => {
          if (!saving) {
            setSaveDialogOpen(false);
            setSaveError(null);
            setSaving(false);
          }
        }}
      >
        <DialogTitle>Сохранить слой как GeoJSON</DialogTitle>
        <DialogContent>
          <TextField
            label="Название слоя"
            fullWidth
            value={layerName}
            onChange={(e) => {
              setLayerName(e.target.value);
              setSaveError(null);
            }}
            sx={{ mt: 1 }}
            disabled={saving}
            autoFocus
            error={!!saveError}
            helperText={saveError || `Будет сохранено объектов: ${drawnFeatures.length}`}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setSaveDialogOpen(false);
              setSaveError(null);
              setSaving(false);
            }} 
            disabled={saving}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleFinishSave} 
            variant="contained" 
            disabled={!layerName.trim() || saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог выбора: Заменить слой или Сохранить копию */}
      <Dialog 
        open={replaceOrCopyDialogOpen} 
        onClose={() => {
          if (!saving) {
            setReplaceOrCopyDialogOpen(false);
          }
        }}
      >
        <DialogTitle>Сохранить изменения</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Вы редактируете существующий слой "{editingLayerName}". Что вы хотите сделать?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setReplaceOrCopyDialogOpen(false);
            }} 
            disabled={saving}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleSaveCopyClick} 
            variant="outlined"
            disabled={saving}
          >
            Сохранить копию
          </Button>
          <Button 
            onClick={handleReplaceLayer} 
            variant="contained" 
            disabled={saving}
          >
            Заменить слой
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог сохранения копии */}
      <Dialog 
        open={copyNameDialogOpen} 
        onClose={() => {
          if (!saving) {
            setCopyNameDialogOpen(false);
            setSaveError(null);
            setSaving(false);
          }
        }}
      >
        <DialogTitle>Сохранить копию слоя</DialogTitle>
        <DialogContent>
          <TextField
            label="Название слоя"
            fullWidth
            value={copyLayerName}
            onChange={(e) => {
              setCopyLayerName(e.target.value);
              setSaveError(null);
            }}
            sx={{ mt: 1 }}
            disabled={saving}
            autoFocus
            error={!!saveError}
            helperText={saveError || `Будет сохранено объектов: ${drawnFeatures.length}`}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setCopyNameDialogOpen(false);
              setSaveError(null);
              setSaving(false);
            }} 
            disabled={saving}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleSaveCopy} 
            variant="contained" 
            disabled={!copyLayerName.trim() || saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Диалог таблицы */}
      <Dialog 
        open={tableDialogOpen} 
        onClose={() => setTableDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle>Таблица объектов</DialogTitle>
        <DialogContent dividers>
          {drawnFeatures.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', mt: 2 }}
            >
              Нет данных для отображения
            </Typography>
          ) : (() => {
            // Оптимизация для больших файлов: ограничиваем количество отображаемых строк
            const MAX_TABLE_ROWS = 1000;
            const tableFeatures = drawnFeatures.length > MAX_TABLE_ROWS 
              ? drawnFeatures.slice(0, MAX_TABLE_ROWS)
              : drawnFeatures;
            const hasMoreTableRows = drawnFeatures.length > MAX_TABLE_ROWS;
            
            // Собираем все уникальные ключи из properties всех объектов (только для отображаемых)
            const allPropertyKeys = new Set();
            tableFeatures.forEach(feature => {
              if (feature.properties && typeof feature.properties === 'object') {
                Object.keys(feature.properties).forEach(key => {
                  allPropertyKeys.add(key);
                });
              }
            });
            
            // Базовые колонки
            const baseColumns = ['№', 'Тип', 'ID'];
            // Колонки из properties
            const propertyColumns = Array.from(allPropertyKeys).sort();
            // Все колонки
            const allColumns = [...baseColumns, ...propertyColumns];
            
            // Функция для форматирования значения ячейки
            const formatCellValue = (value) => {
              if (value === null || value === undefined) return '-';
              if (typeof value === 'object') {
                try {
                  const str = safeStringify(value);
                  // Ограничиваем длину для производительности
                  return str.length > 100 ? str.substring(0, 100) + '...' : str;
                } catch (e) {
                  return '[Object]';
                }
              }
              if (typeof value === 'boolean') {
                return value ? 'true' : 'false';
              }
              const str = String(value);
              return str.length > 100 ? str.substring(0, 100) + '...' : str;
            };
            
            // Функция для получения полного значения для tooltip
            const getFullValue = (value) => {
              if (value === null || value === undefined) return '-';
              if (typeof value === 'object') {
                try {
                  return safeStringify(value, 2);
                } catch (e) {
                  return '[Object]';
                }
              }
              return String(value);
            };
            
            return (
              <>
                {hasMoreTableRows && (
                  <Typography
                    variant="caption"
                    color="warning.main"
                    sx={{ mb: 1, display: 'block', textAlign: 'center' }}
                  >
                    Показано {tableFeatures.length} из {drawnFeatures.length} объектов для производительности
                  </Typography>
                )}
                <TableContainer sx={{ maxHeight: 'calc(80vh - 120px)' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {allColumns.map((column) => (
                          <TableCell key={column}>{column}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableFeatures.map((feature, index) => (
                      <TableRow
                        key={feature.id || index}
                        hover
                        onClick={() => {
                          setTableDialogOpen(false);
                          // Очищаем объект от ссылок на карту перед установкой
                          const cleanedFeature = safeClone(feature) || feature;
                          setSelectedFeature(cleanedFeature);
                          setFeatureDialogOpen(true);
                          setDialogTab(0);
                          if (drawRef.current) {
                            drawRef.current.changeMode('simple_select', { featureIds: [feature.id] });
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        {/* Базовые колонки */}
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{feature.geometry?.type || '-'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {feature.id || '-'}
                        </TableCell>
                        
                        {/* Колонки из properties */}
                        {propertyColumns.map((propKey) => {
                          const value = feature.properties?.[propKey];
                          const isJson = typeof value === 'object' && value !== null;
                          const cellValue = formatCellValue(value);
                          const fullValue = getFullValue(value);
                          const isLongValue = cellValue.length > 50;
                          return (
                            <TableCell 
                              key={propKey}
                              sx={{ 
                                fontFamily: isJson ? 'monospace' : 'inherit',
                                fontSize: isJson ? '0.75rem' : 'inherit',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={isLongValue || isJson ? fullValue : undefined}
                            >
                              {cellValue}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTableDialogOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
