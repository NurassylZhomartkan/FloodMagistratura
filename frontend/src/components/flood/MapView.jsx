// frontend/src/components/flood/MapView.jsx
// Компонент полноэкранной карты с Mapbox GL

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Divider as MuiDivider,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Checkbox,
  Select,
  InputLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Link,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TerrainIcon from '@mui/icons-material/Terrain';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import ParkIcon from '@mui/icons-material/Park';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import DeleteIcon from '@mui/icons-material/Delete';
import WavesIcon from '@mui/icons-material/Waves';
import StorageIcon from '@mui/icons-material/Storage';
import GridOnIcon from '@mui/icons-material/GridOn';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LayersIcon from '@mui/icons-material/Layers';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InputAdornment from '@mui/material/InputAdornment';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Map from '../map/Map';
import DEMFilters from './DEMFilters';
import { authenticatedFetch } from '../../utils/authUtils';
import { loadAndDisplayGeoTIFF } from '../../utils/geotiffUtils';

// Доступные наборы данных рельефа Copernicus GEE
const COPERNICUS_DATASETS = [
  { id: 'copernicus_30m', name: 'Copernicus DEM 30m', resolution: 30, description: 'Высокое разрешение (30 метров)', opentopographyDemType: 'COP30' },
  { id: 'copernicus_60m', name: 'Copernicus DEM 60m', resolution: 60, description: 'Среднее разрешение (60 метров)', opentopographyDemType: 'COP30' },
  { id: 'copernicus_90m', name: 'Copernicus DEM 90m', resolution: 90, description: 'Низкое разрешение (90 метров)', opentopographyDemType: 'COP90' },
  { id: 'copernicus_100m', name: 'Copernicus DEM 100m', resolution: 100, description: 'Низкое разрешение (100 метров)', opentopographyDemType: 'COP90' },
];


export default function MapView({ sharedProjectData = null, shareHash: propShareHash = null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Стиль для числовых полей ввода
  const numericInputStyle = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'transparent',
      borderRadius: '8px',
      '& fieldset': {
        borderColor: '#5f6368',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#80868b',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#8ab4f8',
        borderWidth: '1px',
      },
      '& input': {
        color: '#212121',
        padding: '8px 12px',
      },
    },
    '& .MuiInputLabel-root': {
      color: '#9e9e9e',
      '&.Mui-focused': {
        color: '#8ab4f8',
      },
    },
    '& .MuiInputAdornment-root': {
      '& .MuiTypography-root': {
        color: '#757575',
        fontSize: '14px',
      },
    },
  };
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState(null); // null = все закрыты, 'elevation', 'landCover', 'rainfall', 'infiltration', 'soilMoisture', 'channels', 'coast', 'reservoir', 'upscaling', 'viewer' или 'calibration' = открыт
  const [landCoverInputType, setLandCoverInputType] = useState('single');
  const [manningValue, setManningValue] = useState('0.06');
  const [manningFile, setManningFile] = useState(null);
  const [luClassesFile, setLuClassesFile] = useState(null);
  const [multiplier, setMultiplier] = useState('1.0');
  const [manningCoefficients, setManningCoefficients] = useState([{ class: 'Default class', coefficient: '0.06' }]);
  const [rainfallInputType, setRainfallInputType] = useState('single');
  const [rainfallIntensity, setRainfallIntensity] = useState('60.0');
  const [rainfallFile, setRainfallFile] = useState(null);
  const [rainfallMultiplier, setRainfallMultiplier] = useState('1.0');
  const [rainfallDuration, setRainfallDuration] = useState('3.0');
  const [rainShape, setRainShape] = useState('0.0');
  const [includeInfiltration, setIncludeInfiltration] = useState(false);
  const [infiltrationFile, setInfiltrationFile] = useState(null);
  const [infiltrationMultiplier, setInfiltrationMultiplier] = useState('1.0');
  const [includeSoilMoisture, setIncludeSoilMoisture] = useState(false);
  const [singleValue, setSingleValue] = useState(false);
  const [effectiveSoilMoisture, setEffectiveSoilMoisture] = useState('0.9');
  const [soilMoistureFile, setSoilMoistureFile] = useState(null);
  const [soilMoistureMultiplier, setSoilMoistureMultiplier] = useState('1.0');
  const [averageSoilDepth, setAverageSoilDepth] = useState('5.0');
  const [xinajangParameter, setXinajangParameter] = useState('0.25');
  const [averageDailyEvapotranspiration, setAverageDailyEvapotranspiration] = useState('0.0');
  const [channelsInputType, setChannelsInputType] = useState('none');
  const [channelManningsCoefficient, setChannelManningsCoefficient] = useState('0.03');
  const [widthMult, setWidthMult] = useState('3.16');
  const [widthExp, setWidthExp] = useState('0.32');
  const [depthMult, setDepthMult] = useState('4.1');
  const [depthExp, setDepthExp] = useState('0.21');
  const [minCrossSection, setMinCrossSection] = useState('0.5');
  const [channelWidthFile, setChannelWidthFile] = useState(null);
  const [channelDepthFile, setChannelDepthFile] = useState(null);
  const [channelMultiplier, setChannelMultiplier] = useState('1.0');
  const [includeBaseflow, setIncludeBaseflow] = useState(false);
  const [baseflow, setBaseflow] = useState('1.0');
  const [monodirectionalChannels, setMonodirectionalChannels] = useState(true);
  const [drainageArea, setDrainageArea] = useState('1');
  const [outputChannelShape, setOutputChannelShape] = useState(false);
  const [useEditedChannelRoutes, setUseEditedChannelRoutes] = useState(false);
  const [includeOceanBoundary, setIncludeOceanBoundary] = useState(false);
  const [oceanElevation, setOceanElevation] = useState('0.00');
  const [reservoirCapacityMultiplier, setReservoirCapacityMultiplier] = useState('1.0');
  const [reservoirThroughflowMultiplier, setReservoirThroughflowMultiplier] = useState('1.0');
  const [inputFromOtherArea, setInputFromOtherArea] = useState(false);
  const [otherAreaValue, setOtherAreaValue] = useState('1');
  const [inputFromFile, setInputFromFile] = useState(false);
  const [upscalingFile, setUpscalingFile] = useState(null);
  const [iteration, setIteration] = useState('250');
  const [drawDetail, setDrawDetail] = useState('High');
  const [maxWaterHeightView, setMaxWaterHeightView] = useState('10');
  const [floodExtentFile, setFloodExtentFile] = useState(null);
  const [floodExtentColor, setFloodExtentColor] = useState('#1976d2');
  const [osmBuildingsRoadsFile, setOsmBuildingsRoadsFile] = useState(null);
  const [importBuildingsFile, setImportBuildingsFile] = useState(null);
  const [importRoadsFile, setImportRoadsFile] = useState(null);
  const [calculateExposure, setCalculateExposure] = useState(true);
  const [fullDamageHeight, setFullDamageHeight] = useState('1');
  const [calibrationFile, setCalibrationFile] = useState(null);
  const [floodDepthThreshold, setFloodDepthThreshold] = useState('0.25');
  const [currentError, setCurrentError] = useState('unknown');
  const [mapStyle, setMapStyle] = useState('satellite-streets-v12');
  const [mapProjection, setMapProjection] = useState('mercator');
  const [layersMenuAnchor, setLayersMenuAnchor] = useState(null);
  const [userLayers, setUserLayers] = useState([]); // Список пользовательских слоев
  
  // Доступные стили карты
  const mapStyles = [
    { id: 'streets-v12', name: 'Streets', style: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'satellite-v9', name: 'Satellite', style: 'mapbox://styles/mapbox/satellite-v9' },
    { id: 'satellite-streets-v12', name: 'Satellite Streets', style: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { id: 'outdoors-v12', name: 'Outdoors', style: 'mapbox://styles/mapbox/outdoors-v12' },
    { id: 'light-v11', name: 'Light', style: 'mapbox://styles/mapbox/light-v11' },
    { id: 'dark-v11', name: 'Dark', style: 'mapbox://styles/mapbox/dark-v11' },
  ];
  const [aoiActive, setAoiActive] = useState(false);
  const [aoiBounds, setAoiBounds] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [terrainLayerId, setTerrainLayerId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [landCoverDialogOpen, setLandCoverDialogOpen] = useState(false);
  const [landCoverDownloading, setLandCoverDownloading] = useState(false);
  const [landCoverDownloadProgress, setLandCoverDownloadProgress] = useState(0);
  const [landCoverDownloadError, setLandCoverDownloadError] = useState(null);
  const filterHistoryRef = useRef([]); // История примененных фильтров (хранит информацию о примененных фильтрах)
  const [hasFilterHistory, setHasFilterHistory] = useState(false); // Состояние для отслеживания наличия истории
  const originalTerrainLayerRef = useRef(null); // Сохраняем информацию об исходном слое рельефа (tileUrl и bounds)
  const mapRef = useRef(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef(null);
  const rectangleRef = useRef(null);
  const addTerrainLayerRef = useRef(null);
  const fileInputRef = useRef(null);
  const geotiffLayerRef = useRef(null); // Ref для хранения информации о GeoTIFF слое
  const waterLevelLayerRef = useRef(null); // Ref для хранения информации о слое уровня воды (для симуляции)
  const accordionContainerRef = useRef(null); // Ref для контейнера с аккордеонами
  const terrainListenersRef = useRef({}); // Реестр слушателей событий для terrain слоев: { [sourceId]: { onError, onSourceData } }

  // Гарантируем, что uploadingFile и downloading сбрасываются при монтировании компонента
  useEffect(() => {
    // Сбрасываем uploadingFile и downloading при монтировании, чтобы кнопка была активна
    setUploadingFile(false);
    setDownloading(false);
  }, []);

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
          } else {
            setMapProjection('mercator');
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Проверяем расширение файла
      const fileExt = file.name.toLowerCase();

      const allowedExtensions = ['.tif', '.tiff', '.geotiff'];
      const isValidExtension = allowedExtensions.some(ext => fileExt.endsWith(ext));
      
      if (!isValidExtension) {
        setDownloadError(t('floodModeling.fileTypesOnly'));
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      
      // Отображаем файл напрямую на карте с помощью geotiff.js
      await handleDisplayGeoTIFF(file);
    }
  };

  // Функция для прямого отображения GeoTIFF файла на карте
  const handleDisplayGeoTIFF = async (file) => {
    if (!file) return;

    setUploadingFile(true);
    setDownloadError(null);

    try {
      const map = mapRef.current;
      if (!map || !map.loaded() || !map.isStyleLoaded()) {
        // Ждем загрузки карты
        await new Promise((resolve) => {
          if (map && map.loaded() && map.isStyleLoaded()) {
            resolve();
          } else {
            const checkReady = () => {
              if (map && map.loaded() && map.isStyleLoaded()) {
                map.off('load', checkReady);
                map.off('style.load', checkReady);
                resolve();
              }
            };
            if (map) {
              map.once('load', checkReady);
              map.once('style.load', checkReady);
            }
          }
        });
      }

      // Удаляем предыдущий GeoTIFF слой, если есть
      if (geotiffLayerRef.current) {
        const { layerId, sourceId } = geotiffLayerRef.current;
        try {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        } catch (error) {
          console.warn('Ошибка при удалении предыдущего GeoTIFF слоя:', error);
        }
        geotiffLayerRef.current = null;
      }

      // Загружаем и отображаем GeoTIFF
      const layerId = `geotiff-${Date.now()}`;
      const result = await loadAndDisplayGeoTIFF(map, file, layerId, {
        colorScale: 'terrain',
        opacity: 0.8
      });

      // Сохраняем информацию о слое, включая исходный файл для последующей загрузки на сервер при применении фильтров
      geotiffLayerRef.current = {
        layerId: result.layerId,
        sourceId: result.sourceId,
        bounds: result.bounds,
        fileName: file.name,
        file: file // Сохраняем файл для последующей загрузки на сервер
      };

      // Приближаем камеру к границам файла
      if (result.bounds) {
        setTimeout(() => {
          fitBoundsToFile(result.bounds);
        }, 500);
      }

      setUploadedFileName(file.name);
      setTerrainLayerId(layerId); // Используем terrainLayerId для отслеживания активного слоя
      
      // Очищаем выбранный файл
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      console.log('GeoTIFF файл успешно отображен на карте');
    } catch (error) {
      console.error('Ошибка при отображении GeoTIFF файла:', error);
      setDownloadError(error.message || t('floodModeling.displayError'));
    } finally {
      setUploadingFile(false);
    }
  };

  // Функция для создания нового проекта
  const createProject = async (authHeader) => {
    const createProjectRes = await fetch('/api/flood/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    });
    if (!createProjectRes.ok) {
      throw new Error('Не удалось создать проект');
    }
    const projectData = await createProjectRes.json();
    const newProjectId = projectData.projectId;
    localStorage.setItem('floodProjectId', String(newProjectId));
    return newProjectId;
  };

  // Функция для загрузки файла на сервер и добавления на карту
  const handleUploadFile = async (file) => {
    if (!file) return;

    setUploadingFile(true);
    setDownloadError(null);

    try {
      const token = localStorage.getItem('token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      // Получаем или создаем проект
      let projectId = localStorage.getItem('floodProjectId');
      let projectIdNum;
      
      // Проверяем, что projectId - это число
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        projectIdNum = await createProject(authHeader);
      } else {
        projectIdNum = parseInt(projectId, 10);
        if (isNaN(projectIdNum)) {
          projectIdNum = await createProject(authHeader);
        }
      }

      // Загружаем файл на бэкенд
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', 'terrain');
      // Не передаем bounds, чтобы файл использовался как есть

      const uploadRes = await fetch(`/api/flood/projects/${projectIdNum}/upload`, {
        method: 'POST',
        headers: authHeader,
        body: formData,
      });

      // Если проект не найден, создаем новый и повторяем загрузку
      if (uploadRes.status === 404) {
        console.log('Проект не найден, создаем новый...');
        projectIdNum = await createProject(authHeader);
        
        // Повторяем загрузку с новым projectId
        const retryUploadRes = await fetch(`/api/flood/projects/${projectIdNum}/upload`, {
          method: 'POST',
          headers: authHeader,
          body: formData,
        });

        if (!retryUploadRes.ok) {
          const errorText = await retryUploadRes.text().catch(() => 'Ошибка загрузки файла на сервер');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { detail: errorText };
          }
          console.error('Ошибка загрузки файла:', retryUploadRes.status, errorData);
          throw new Error(errorData.detail || errorData.message || `Ошибка при загрузке файла: ${retryUploadRes.status}`);
        }

        const uploadData = await retryUploadRes.json();
        const fileId = uploadData.fileId;
        const bounds = uploadData.bounds;

        console.log(`Файл успешно загружен на сервер, fileId: ${fileId}`, bounds);

        // Добавляем слой на карту с границами файла
        const tileUrl = `/api/flood/projects/${projectIdNum}/tiles/{z}/{x}/{y}.png?layer=terrain&fileId=${fileId}`;
        addTerrainLayer(tileUrl, bounds).catch((error) => {
          console.error('Ошибка при добавлении слоя рельефа:', error);
          setDownloadError('Ошибка при добавлении слоя рельефа на карту');
        });

        // Приближаем камеру к границам файла после добавления слоя
        if (bounds) {
          console.log('Запланировано приближение камеры к границам файла через 1000ms');
          // Увеличиваем задержку, чтобы слой успел полностью загрузиться
          setTimeout(() => {
            console.log('Выполняем приближение камеры к границам файла');
            fitBoundsToFile(bounds);
          }, 1000); // Задержка увеличена до 1 секунды
        }

        console.log('Слой рельефа успешно добавлен на карту');
      } else if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => 'Ошибка загрузки файла на сервер');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        console.error('Ошибка загрузки файла:', uploadRes.status, errorData);
        throw new Error(errorData.detail || errorData.message || `Ошибка при загрузке файла: ${uploadRes.status}`);
      } else {
        const uploadData = await uploadRes.json();
        const fileId = uploadData.fileId;
        const bounds = uploadData.bounds;

        console.log(`Файл успешно загружен на сервер, fileId: ${fileId}`, bounds);

        // Добавляем слой на карту с границами файла
        const tileUrl = `/api/flood/projects/${projectIdNum}/tiles/{z}/{x}/{y}.png?layer=terrain&fileId=${fileId}`;
        addTerrainLayer(tileUrl, bounds).catch((error) => {
          console.error('Ошибка при добавлении слоя рельефа:', error);
          setDownloadError('Ошибка при добавлении слоя рельефа на карту');
        });

        // Приближаем камеру к границам файла после добавления слоя
        if (bounds) {
          console.log('Запланировано приближение камеры к границам файла через 1000ms');
          // Увеличиваем задержку, чтобы слой успел полностью загрузиться
          setTimeout(() => {
            console.log('Выполняем приближение камеры к границам файла');
            fitBoundsToFile(bounds);
          }, 1000); // Задержка увеличена до 1 секунды
        }

        console.log('Слой рельефа успешно добавлен на карту');
      }
      
      // Сохраняем имя файла перед очисткой
      setUploadedFileName(file.name);
      
      // Очищаем выбранный файл и сбрасываем input после успешной загрузки
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      setDownloadError(error.message || t('floodModeling.uploadError'));
      // Не очищаем selectedFile при ошибке, чтобы пользователь мог попробовать снова
    } finally {
      // Гарантируем, что uploadingFile всегда сбрасывается
      console.log('Сбрасываем uploadingFile в false');
      setUploadingFile(false);
    }
  };

  // Обработчик готовности карты
  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Функция для автоматического приближения камеры к границам файла
  const fitBoundsToFile = useCallback((bounds, attempt = 0) => {
    console.log('fitBoundsToFile вызвана с bounds:', bounds, 'попытка:', attempt);
    
    // Защита от бесконечных ретраев: максимум 20 попыток (~4 секунды)
    if (attempt > 20) {
      console.warn('Превышен лимит попыток для fitBoundsToFile');
      return;
    }
    
    const map = mapRef.current;
    if (!map) {
      console.warn('Карта не доступна для приближения камеры');
      // Попробуем еще раз через небольшую задержку
      setTimeout(() => fitBoundsToFile(bounds, attempt + 1), 200);
      return;
    }

    if (!bounds) {
      console.warn('Границы не указаны для приближения камеры');
      return;
    }

    // Проверяем, что границы валидны
    if (
      bounds.west === undefined ||
      bounds.south === undefined ||
      bounds.east === undefined ||
      bounds.north === undefined
    ) {
      console.warn('Неверные границы файла для приближения камеры:', bounds);
      return;
    }

    // Проверяем валидность координат
    if (
      isNaN(bounds.west) || isNaN(bounds.south) ||
      isNaN(bounds.east) || isNaN(bounds.north) ||
      bounds.west >= bounds.east ||
      bounds.south >= bounds.north
    ) {
      console.warn('Некорректные координаты границ:', bounds);
      return;
    }

    // Функция для выполнения fitBounds
    const performFitBounds = () => {
      try {
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        
        console.log('Приближение камеры к границам файла:', {
          bounds: {
            west: bounds.west,
            south: bounds.south,
            east: bounds.east,
            north: bounds.north
          },
          currentCenter: [currentCenter.lng, currentCenter.lat],
          currentZoom: currentZoom
        });

        // Приближаем камеру к границам файла с небольшим отступом (padding)
        map.fitBounds(
          [
            [bounds.west, bounds.south], // Юго-запад
            [bounds.east, bounds.north]  // Северо-восток
          ],
          {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            duration: 1500, // Плавная анимация в течение 1.5 секунд
            maxZoom: 14, // Максимальный уровень приближения
            linear: false, // Используем easing функцию для плавности
          }
        );

        // Логируем новую позицию после завершения анимации
        setTimeout(() => {
          const newCenter = map.getCenter();
          const newZoom = map.getZoom();
          console.log('Камера перемещена:', {
            newCenter: [newCenter.lng, newCenter.lat],
            newZoom: newZoom
          });
        }, 1600);
      } catch (error) {
        console.error('Ошибка при приближении камеры к файлу:', error);
      }
    };

    // Проверяем готовность карты
    const isMapReady = () => {
      // Проверяем, что карта загружена и стиль загружен
      // Если карта уже загружена, map.loaded() может вернуть true
      // Но лучше проверить наличие метода getCenter, который доступен только после загрузки
      try {
        map.getCenter();
        return map.isStyleLoaded();
      } catch (e) {
        return false;
      }
    };

    // Если карта еще не готова, ждем события
    if (!isMapReady()) {
      console.log('Карта еще не готова, ждем события...');
      
      // Подписываемся на событие idle, которое происходит когда карта полностью загружена и готова
      const handleReady = () => {
        console.log('Карта готова, выполняем fitBounds');
        performFitBounds();
      };
      
      // Пробуем оба события
      if (!map.loaded()) {
        map.once('load', handleReady);
      }
      if (!map.isStyleLoaded()) {
        map.once('styledata', handleReady);
      }
      
      // Также подписываемся на idle, так как это происходит когда все готово
      map.once('idle', () => {
        console.log('Карта в состоянии idle, выполняем fitBounds');
        performFitBounds();
      });
      
      return;
    }

    // Если все готово, выполняем сразу
    console.log('Карта готова, выполняем fitBounds сразу');
    performFitBounds();
  }, []);

  // Функция для очистки прямоугольника
  const clearRectangle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Удаляем источник и слои, если они существуют
    if (map.getSource('aoi-rectangle')) {
      if (map.getLayer('aoi-rectangle-fill')) {
        map.removeLayer('aoi-rectangle-fill');
      }
      if (map.getLayer('aoi-rectangle-line')) {
        map.removeLayer('aoi-rectangle-line');
      }
      map.removeSource('aoi-rectangle');
    }
    rectangleRef.current = null;
    setAoiBounds(null);
  }, []);

  // Функция для обновления прямоугольника на карте
  const updateRectangle = useCallback((start, end) => {
    const map = mapRef.current;
    if (!map || !map.loaded() || !map.isStyleLoaded()) return;

    const bounds = [
      Math.min(start.lng, end.lng),
      Math.min(start.lat, end.lat),
      Math.max(start.lng, end.lng),
      Math.max(start.lat, end.lat)
    ];

    const rectangle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds[0], bounds[1]], // SW
          [bounds[2], bounds[1]], // SE
          [bounds[2], bounds[3]], // NE
          [bounds[0], bounds[3]], // NW
          [bounds[0], bounds[1]]  // SW (замыкание)
        ]]
      }
    };

    // Обновляем или создаем источник
    const source = map.getSource('aoi-rectangle');
    if (source) {
      source.setData(rectangle);
    } else {
      map.addSource('aoi-rectangle', {
        type: 'geojson',
        data: rectangle
      });

      // Добавляем слой заливки
      map.addLayer({
        id: 'aoi-rectangle-fill',
        type: 'fill',
        source: 'aoi-rectangle',
        paint: {
          'fill-color': '#1976d2',
          'fill-opacity': 0.2
        }
      });

      // Добавляем слой границы
      map.addLayer({
        id: 'aoi-rectangle-line',
        type: 'line',
        source: 'aoi-rectangle',
        paint: {
          'line-color': '#1976d2',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });
    }

    rectangleRef.current = rectangle;
    setAoiBounds({
      west: bounds[0],
      south: bounds[1],
      east: bounds[2],
      north: bounds[3]
    });
  }, []);

  // Активация/деактивация инструмента AOI
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    // Ждем загрузки карты
    if (!map.loaded() || !map.isStyleLoaded()) {
      const handleMapLoad = () => {
        // Перезапускаем эффект после загрузки
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

    if (aoiActive) {
      // Устанавливаем курсор для рисования
      map.getCanvas().style.cursor = 'crosshair';
      
      // Сохраняем состояние взаимодействий для последующего восстановления
      const originalBoxZoom = map.boxZoom.isEnabled();
      const originalDragPan = map.dragPan.isEnabled();
      const originalDragRotate = map.dragRotate.isEnabled();
      const originalDoubleClickZoom = map.doubleClickZoom.isEnabled();
      
      // Отключаем только те взаимодействия, которые мешают рисованию
      // Не отключаем scrollZoom, чтобы можно было приближать/отдалять карту
      map.boxZoom.disable();
      map.dragRotate.disable();
      map.doubleClickZoom.disable();

      const handleMouseDown = (e) => {
        if (e.originalEvent.button !== 0) return; // Только левая кнопка мыши
        
        // Отключаем dragPan только при начале рисования
        map.dragPan.disable();
        
        isDrawingRef.current = true;
        startPointRef.current = e.lngLat;
        clearRectangle();
      };

      const handleMouseMove = (e) => {
        // Обновляем прямоугольник, если идет рисование
        if (isDrawingRef.current && startPointRef.current) {
          updateRectangle(startPointRef.current, e.lngLat);
        }
      };

      const handleMouseUp = () => {
        if (!isDrawingRef.current) {
          // Если не было рисования, восстанавливаем dragPan
          map.dragPan.enable();
          return;
        }
        
        isDrawingRef.current = false;
        
        // Восстанавливаем dragPan после завершения рисования
        map.dragPan.enable();
        
        // Прямоугольник уже нарисован, оставляем его
        // Открываем диалог, если есть выделенная область
        setTimeout(() => {
          if (rectangleRef.current) {
            setDialogOpen(true);
          }
        }, 50);
      };

      const handleMouseLeave = () => {
        // Если мышь покинула карту во время рисования, завершаем рисование
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          // Восстанавливаем dragPan
          map.dragPan.enable();
        }
      };
      
      // Обработчик для предотвращения панорамирования при рисовании
      const handleDragStart = (e) => {
        if (isDrawingRef.current) {
          // Блокируем начало панорамирования, если идет рисование
          e.preventDefault();
        }
      };

      // Регистрируем обработчики событий
      map.on('mousedown', handleMouseDown);
      map.on('mousemove', handleMouseMove);
      map.on('mouseup', handleMouseUp);
      map.on('mouseleave', handleMouseLeave);
      map.on('dragstart', handleDragStart);

      return () => {
        map.off('mousedown', handleMouseDown);
        map.off('mousemove', handleMouseMove);
        map.off('mouseup', handleMouseUp);
        map.off('mouseleave', handleMouseLeave);
        map.off('dragstart', handleDragStart);
        map.getCanvas().style.cursor = '';
        
        // Восстанавливаем взаимодействия карты
        if (mapRef.current && mapRef.current === map) {
          if (originalBoxZoom) map.boxZoom.enable();
          if (originalDragPan) map.dragPan.enable();
          if (originalDragRotate) map.dragRotate.enable();
          if (originalDoubleClickZoom) map.doubleClickZoom.enable();
        }
        
        // Сбрасываем состояние рисования
        isDrawingRef.current = false;
        startPointRef.current = null;
      };
    } else {
      // Возвращаем обычный курсор
      map.getCanvas().style.cursor = '';
      clearRectangle();
    }
  }, [aoiActive, clearRectangle, updateRectangle]);

  // Функция для удаления всех слоев рельефа
  const removeTerrainLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      // Снимаем все слушатели событий перед удалением источников
      const listeners = terrainListenersRef.current;
      Object.entries(listeners).forEach(([sourceId, handlers]) => {
        try {
          map.off('error', handlers.onError);
          map.off('sourcedata', handlers.onSourceData);
        } catch (error) {
          console.warn(`Ошибка при снятии слушателей для ${sourceId}:`, error);
        }
        delete listeners[sourceId];
      });

      // Удаляем GeoTIFF слой, если есть
      if (geotiffLayerRef.current) {
        const { layerId, sourceId } = geotiffLayerRef.current;
        try {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
            console.log(`Удален GeoTIFF слой: ${layerId}`);
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
            console.log(`Удален GeoTIFF источник: ${sourceId}`);
          }
        } catch (error) {
          console.warn('Ошибка при удалении GeoTIFF слоя:', error);
        }
        geotiffLayerRef.current = null;
      }

      // Удаляем все слои рельефа, независимо от state
      const style = map.getStyle();
      if (style && style.layers) {
        const terrainLayers = style.layers.filter(layer => 
          layer.id && layer.id.startsWith('terrain-')
        );
        
        terrainLayers.forEach(layer => {
          try {
            if (map.getLayer(layer.id)) {
              map.removeLayer(layer.id);
              console.log(`Удален слой рельефа: ${layer.id}`);
            }
          } catch (error) {
            console.warn(`Ошибка при удалении слоя ${layer.id}:`, error);
          }
        });
      }
      
      // Удаляем все источники рельефа
      if (style && style.sources) {
        const terrainSources = Object.keys(style.sources).filter(sourceId => 
          sourceId.startsWith('terrain-source-')
        );
        
        terrainSources.forEach(sourceId => {
          try {
            if (map.getSource(sourceId)) {
              map.removeSource(sourceId);
              console.log(`Удален источник рельефа: ${sourceId}`);
            }
          } catch (error) {
            console.warn(`Ошибка при удалении источника ${sourceId}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error removing terrain layers:', error);
    }
    
    setTerrainLayerId(null);
    setUploadedFileName(null); // Очищаем имя файла при удалении слоя
    // Очищаем историю фильтров при удалении слоя рельефа
    filterHistoryRef.current = [];
    setHasFilterHistory(false);
    // Очищаем информацию об исходном слое при удалении слоя
    originalTerrainLayerRef.current = null;
  }, []);

  // Функция для добавления слоя рельефа на карту
  // Возвращает промис, который резолвится после успешного добавления слоя
  const addTerrainLayer = useCallback((tileUrl, bounds = null, isOriginal = true) => {
    return new Promise((resolve, reject) => {
      const map = mapRef.current;
      if (!map || !map.loaded() || !map.isStyleLoaded()) {
        // Если карта еще не загружена, ждем загрузки
        if (map) {
          const waitForLoad = () => {
            if (map.loaded() && map.isStyleLoaded()) {
              addTerrainLayer(tileUrl, bounds, isOriginal).then(resolve).catch(reject);
            } else {
              map.once('load', waitForLoad);
              map.once('style.load', waitForLoad);
            }
          };
          waitForLoad();
        } else {
          reject(new Error('Карта не доступна'));
        }
        return;
      }

    // Сохраняем информацию об исходном слое при первом добавлении
    if (isOriginal && !originalTerrainLayerRef.current) {
      originalTerrainLayerRef.current = { tileUrl, bounds };
      // Очищаем историю фильтров при добавлении нового исходного слоя
      filterHistoryRef.current = [];
      setHasFilterHistory(false);
    }

    // Удаляем все старые слои рельефа перед добавлением нового
    try {
      const style = map.getStyle();
      if (style && style.layers) {
        const terrainLayers = style.layers.filter(layer => 
          layer.id && layer.id.startsWith('terrain-')
        );
        
        terrainLayers.forEach(layer => {
          try {
            if (map.getLayer(layer.id)) {
              map.removeLayer(layer.id);
              console.log(`Удален старый слой рельефа: ${layer.id}`);
            }
          } catch (error) {
            console.warn(`Ошибка при удалении старого слоя ${layer.id}:`, error);
          }
        });
      }
      
      // Удаляем все старые источники рельефа
      if (style && style.sources) {
        const terrainSources = Object.keys(style.sources).filter(sourceId => 
          sourceId.startsWith('terrain-source-')
        );
        
        terrainSources.forEach(sourceId => {
          try {
            if (map.getSource(sourceId)) {
              map.removeSource(sourceId);
              console.log(`Удален старый источник рельефа: ${sourceId}`);
            }
          } catch (error) {
            console.warn(`Ошибка при удалении старого источника ${sourceId}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при удалении старых слоев рельефа:', error);
    }

    const timestamp = Date.now();
    const newLayerId = `terrain-${timestamp}`;
    const sourceId = `terrain-source-${timestamp}`;

    try {
      // Конфигурация источника тайлов с оптимизацией для быстрой загрузки
      const sourceConfig = {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        // Устанавливаем широкий диапазон уровней зума, чтобы DEM не изменялся при масштабировании
        minzoom: 0,
        maxzoom: 24,
        // Оптимизация для быстрой загрузки: обновление тайлов только когда карта не двигается
        updateWhenIdle: false, // Загружаем тайлы сразу, не ждем idle
        // Предзагрузка тайлов для текущего viewport
        updateWhenMoving: true, // Обновляем тайлы при движении карты
      };

      // Не используем bounds в конфигурации источника, чтобы тайлы загружались независимо от позиции карты.
      // Сервер сам вернет прозрачные тайлы для областей вне границ файла.
      // Это гарантирует, что тайлы будут загружаться даже если пользователь находится вне области файла.
      if (bounds && bounds.west !== undefined && bounds.south !== undefined && 
          bounds.east !== undefined && bounds.north !== undefined) {
        console.log('Границы файла (для информации):', {
          west: bounds.west,
          south: bounds.south,
          east: bounds.east,
          north: bounds.north
        });
        // Не применяем bounds к источнику - позволяем загружать тайлы для всей карты
        // Сервер сам вернет пустые тайлы для областей вне границ файла
      } else {
        console.warn('Границы не указаны для слоя рельефа');
      }


      // Добавляем источник тайлов
      map.addSource(sourceId, sourceConfig);
      
      // Обработка ошибок загрузки тайлов
      const onError = (e) => {
        if (e.sourceId === sourceId) {
          console.error('Error loading terrain tiles:', e);
        }
      };
      
      // Отслеживание загрузки тайлов (только для отладки, не логируем каждую ошибку)
      let failedTilesCount = 0;
      let loadedTilesCount = 0;
      
      const handleSourceData = (e) => {
        if (e.sourceId === sourceId) {
          if (e.isSourceLoaded) {
            console.log(`Источник тайлов ${sourceId} успешно загружен`);
          } else if (e.tile) {
            if (e.tile.state === 'loaded') {
              loadedTilesCount++;
              const z = e.tile.tileID?.canonical?.z;
              const x = e.tile.tileID?.canonical?.x;
              const y = e.tile.tileID?.canonical?.y;
              
              // Для растровых тайлов состояние 'loaded' означает успешную загрузку
              // Прозрачность определяется содержимым PNG, а не наличием свойства data
              if (loadedTilesCount <= 10) {
                console.log(`✅ Тайл успешно загружен: z=${z}, x=${x}, y=${y}`);
              }
            } else if (e.tile.state === 'errored') {
              failedTilesCount++;
              const z = e.tile.tileID?.canonical?.z;
              const x = e.tile.tileID?.canonical?.x;
              const y = e.tile.tileID?.canonical?.y;
              
              // Логируем только первые несколько ошибок, чтобы не засорять консоль
              if (failedTilesCount <= 5) {
                console.warn(`❌ Ошибка загрузки тайла: z=${z}, x=${x}, y=${y}`);
              }
            }
          }
        }
      };
      
      // Регистрируем слушатели
      map.on('error', onError);
      map.on('sourcedata', handleSourceData);
      
      // Сохраняем слушатели в реестре для последующего удаления
      terrainListenersRef.current[sourceId] = { onError, onSourceData: handleSourceData };

      // Добавляем слой рельефа с явным указанием, что он должен быть поверх всех слоев
      // Устанавливаем minzoom и maxzoom для слоя, чтобы DEM не изменялся при масштабировании
      try {
        map.addLayer({
          id: newLayerId,
          type: 'raster',
          source: sourceId,
          layout: {
            visibility: 'visible',
          },
          paint: {
            'raster-opacity': 1.0, // Полная непрозрачность для максимальной видимости слоя рельефа
            // Используем линейное ресемплирование для плавного отображения без видимых краев тайлов
            'raster-resampling': 'linear', // Линейная интерполяция для устранения видимых краев тайлов
            'raster-brightness-min': 0, // Минимальная яркость (от -1 до 1)
            'raster-brightness-max': 0.1, // Максимальная яркость (от -1 до 1) - небольшое увеличение яркости
            'raster-contrast': 0.5, // Контрастность (от -1 до 1)
            'raster-saturation': 0.2, // Насыщенность (от -1 до 1)
            // Плавное появление тайлов для избежания пикселизации
            'raster-fade-duration': 0, // Отключаем fade для мгновенного отображения
          },
          // Устанавливаем широкий диапазон уровней зума, чтобы слой всегда был виден
          minzoom: 0,
          maxzoom: 24,
        });
        
        console.log(`✅ Слой рельефа добавлен: ${newLayerId}, источник: ${sourceId}`);
        console.log(`URL тайлов: ${tileUrl}`);
        
        // Проверяем сразу после добавления
        const layerExistsImmediately = map.getLayer(newLayerId);
        const sourceExistsImmediately = map.getSource(sourceId);
        console.log(`Проверка сразу после addLayer: слой=${!!layerExistsImmediately}, источник=${!!sourceExistsImmediately}`);
      } catch (addLayerError) {
        console.error('Ошибка при вызове map.addLayer:', addLayerError);
        reject(addLayerError);
        return;
      }
      
      // Функция для позиционирования слоя рельефа перед первым symbol-слоем (подписями)
      // Это стандартный паттерн для оверлеев: DEM должен быть под подписями, но поверх базового растра
      const positionTerrainLayer = () => {
        try {
          const style = map.getStyle();
          if (!style?.layers) {
            console.warn('Style layers not available');
            return;
          }

          const allLayers = style.layers;
          const currentIndex = allLayers.findIndex(l => l.id === newLayerId);
          
          if (currentIndex === -1) {
            console.warn('Terrain layer not found in layers list');
            return;
          }
          
          // Ищем первый symbol-слой (подписи/лейблы)
          // Это стандартный паттерн: ставим DEM перед первым symbol, чтобы подписи оставались читаемыми
          const firstSymbol = allLayers.find(l => l.type === 'symbol');
          
          if (firstSymbol) {
            // moveLayer(layerId, beforeId) перемещает слой ПЕРЕД beforeId
            // Таким образом, terrain окажется ниже подписей, но поверх базовых слоев
            try {
              map.moveLayer(newLayerId, firstSymbol.id);
              console.log(`Слой ${newLayerId} перемещен перед первым symbol-слоем ${firstSymbol.id}`);
            } catch (e) {
              console.warn(`Не удалось переместить слой перед ${firstSymbol.id}:`, e);
            }
          } else {
            // Если symbol-слоев нет, перемещаем в самый верх
            try {
              map.moveLayer(newLayerId);
              console.log(`Слой ${newLayerId} перемещен в самый верх (symbol-слоев не найдено)`);
            } catch (e) {
              console.warn(`Не удалось переместить слой в верх:`, e);
            }
          }
          
          // Убеждаемся, что слой виден
          if (map.getLayer(newLayerId)) {
            map.setLayoutProperty(newLayerId, 'visibility', 'visible');
            const visibility = map.getLayoutProperty(newLayerId, 'visibility');
            const opacity = map.getPaintProperty(newLayerId, 'raster-opacity');
            console.log(`Слой ${newLayerId} - видимость: ${visibility}, прозрачность: ${opacity}`);
          }
        } catch (error) {
          console.error('Error positioning terrain layer:', error);
        }
      };
      
      // Позиционируем слой сразу и также после события 'idle' (когда карта полностью загружена)
      positionTerrainLayer();
      
      // Используем несколько попыток позиционирования, так как слои могут добавляться асинхронно
      const positionTerrainLayerMultiple = () => {
        positionTerrainLayer();
        // Повторяем несколько раз с задержкой для гарантии
        setTimeout(() => positionTerrainLayer(), 100);
        setTimeout(() => positionTerrainLayer(), 500);
        setTimeout(() => positionTerrainLayer(), 1000);
      };
      
      map.once('idle', () => {
        console.log('Карта в состоянии idle, позиционируем слой рельефа');
        positionTerrainLayerMultiple();
      });
      
      // Также позиционируем после загрузки всех тайлов
      map.once('data', (e) => {
        if (e.sourceId === sourceId && e.isSourceLoaded) {
          console.log('Данные источника загружены, позиционируем слой');
          positionTerrainLayer();
        }
      });
      
      // Дополнительно позиционируем после стиля данных
      map.once('styledata', () => {
        console.log('Стиль карты загружен, позиционируем слой рельефа');
        setTimeout(() => positionTerrainLayer(), 100);
      });

      setTerrainLayerId(newLayerId);
      
      // Проверяем, что слой действительно добавлен и виден
      // Используем промис для ожидания успешного добавления
      let isResolved = false;
      let checkInterval = null;
      let timeoutId = null;
      
      const resolveOnce = (result) => {
        if (!isResolved) {
          isResolved = true;
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setAoiActive(false);
          clearRectangle();
          console.log(`✅ Промис резолвится для слоя ${newLayerId}`);
          resolve(result);
        }
      };
      
      const checkLayerAdded = () => {
        if (isResolved) return true;
        
        try {
          const layerExists = map.getLayer(newLayerId);
          const sourceExists = map.getSource(sourceId);
          
          if (layerExists && sourceExists) {
            console.log(`✅ Слой ${newLayerId} успешно добавлен на карту (проверка пройдена)`);
            resolveOnce({ layerId: newLayerId, sourceId });
            return true;
          } else {
            console.log(`⏳ Ожидание слоя ${newLayerId}: слой=${!!layerExists}, источник=${!!sourceExists}`);
            return false;
          }
        } catch (error) {
          console.warn(`Ошибка при проверке слоя ${newLayerId}:`, error);
          return false;
        }
      };
      
      // Проверяем сразу после добавления (с небольшой задержкой для Mapbox)
      setTimeout(() => {
        if (!isResolved && checkLayerAdded()) {
          return; // Слой найден, промис резолвится
        }
      }, 50);
      
      // Если слой еще не добавлен, начинаем периодическую проверку
      let attempts = 0;
      const maxAttempts = 50; // 5 секунд максимум
      
      checkInterval = setInterval(() => {
        if (isResolved) {
          clearInterval(checkInterval);
          checkInterval = null;
          return;
        }
        
        attempts++;
        
        if (checkLayerAdded()) {
          // Слой найден, промис резолвится в checkLayerAdded
          clearInterval(checkInterval);
          checkInterval = null;
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.warn(`⏳ Превышено максимальное количество попыток проверки слоя ${newLayerId}`);
          clearInterval(checkInterval);
          checkInterval = null;
          
          // Проверяем еще раз перед отклонением
          if (!checkLayerAdded()) {
            const error = new Error('Не удалось добавить слой рельефа на карту в течение 5 секунд');
            console.error('❌ Ошибка добавления слоя:', error);
            setDownloadError('Ошибка при добавлении слоя рельефа на карту');
            reject(error);
          }
        }
      }, 100);
      
      // Также проверяем после события styledata (когда стиль обновлен)
      map.once('styledata', () => {
        if (!isResolved) {
          console.log(`Событие styledata получено, проверяем слой ${newLayerId}`);
          checkLayerAdded();
        }
      });
      
      // Также проверяем после события idle
      map.once('idle', () => {
        if (!isResolved) {
          console.log(`Событие idle получено, проверяем слой ${newLayerId}`);
          checkLayerAdded();
        }
      });
      
      // Таймаут на случай, если слой не добавится
      timeoutId = setTimeout(() => {
        if (isResolved) return;
        
        const layerExists = map.getLayer(newLayerId);
        const sourceExists = map.getSource(sourceId);
        if (!layerExists || !sourceExists) {
          const error = new Error('Не удалось добавить слой рельефа на карту (таймаут 5 секунд)');
          console.error('❌ Ошибка добавления слоя (таймаут):', error);
          console.error(`  - Слой существует: ${!!layerExists}`);
          console.error(`  - Источник существует: ${!!sourceExists}`);
          setDownloadError('Ошибка при добавлении слоя рельефа на карту');
          reject(error);
        }
      }, 5000);
      
      // Дополнительная проверка для логирования
      setTimeout(() => {
        const layerExists = map.getLayer(newLayerId);
        const sourceExists = map.getSource(sourceId);
        const allLayers = map.getStyle().layers;
        const layerIndex = allLayers.findIndex(l => l.id === newLayerId);
        const isLastLayer = layerIndex === allLayers.length - 1;
        
        console.log(`Проверка слоя после добавления:`);
        console.log(`  - Слой существует: ${!!layerExists}`);
        console.log(`  - Источник существует: ${!!sourceExists}`);
        console.log(`  - Позиция: ${layerIndex} из ${allLayers.length}`);
        console.log(`  - Последний слой: ${isLastLayer}`);
        
        if (layerExists) {
          const visibility = map.getLayoutProperty(newLayerId, 'visibility');
          const opacity = map.getPaintProperty(newLayerId, 'raster-opacity');
          const brightnessMin = map.getPaintProperty(newLayerId, 'raster-brightness-min');
          const brightnessMax = map.getPaintProperty(newLayerId, 'raster-brightness-max');
          const contrast = map.getPaintProperty(newLayerId, 'raster-contrast');
          console.log(`  - Видимость: ${visibility}`);
          console.log(`  - Прозрачность: ${opacity}`);
          console.log(`  - Яркость (min/max): ${brightnessMin}/${brightnessMax}`);
          console.log(`  - Контрастность: ${contrast}`);
          
          // Если слой не последний, пытаемся переместить его еще раз
          if (!isLastLayer) {
            console.log(`  - ⚠️ Слой не в конце списка, пытаемся переместить...`);
            map.moveLayer(newLayerId);
          }
        } else {
          console.error(`  - ❌ Слой ${newLayerId} не найден на карте после добавления!`);
        }
        
        if (!sourceExists) {
          console.error(`  - ❌ Источник ${sourceId} не найден на карте после добавления!`);
        }
      }, 1000);
    } catch (error) {
      console.error('Error adding terrain layer:', error);
      setDownloadError('Ошибка при добавлении слоя рельефа на карту');
      reject(error);
    }
    });
  }, [clearRectangle]);

  // Обработчик клика на кнопку "Auto Download Elevation" / "Удалить слой рельефа"
  const handleAutoDownloadElevation = useCallback(() => {
    // Если есть активный слой рельефа, удаляем его
    if (terrainLayerId) {
      removeTerrainLayer();
    } else {
      // Иначе активируем/деактивируем режим AOI
      const newState = !aoiActive;
      setAoiActive(newState);
    }
  }, [terrainLayerId, aoiActive, removeTerrainLayer]);

  // Обработчик применения фильтра
  // Возвращает промис, который резолвится после успешного применения фильтра
  const handleApplyFilter = useCallback(async (filterType, params) => {
    if (!terrainLayerId) {
      const error = new Error('Нет активного слоя рельефа для применения фильтра');
      console.warn(error.message);
      throw error;
    }

    // Сохраняем информацию о примененном фильтре
    const filterAction = {
      type: filterType,
      params: params,
      timestamp: Date.now(),
    };

    try {
      const map = mapRef.current;
      if (!map) {
        const error = new Error('Карта не доступна');
        console.error(error.message);
        throw error;
      }

      // Проверяем, является ли текущий слой GeoTIFF слоем
      const isGeoTIFFLayer = geotiffLayerRef.current || (terrainLayerId && terrainLayerId.startsWith('geotiff-'));
      
      // Получаем токен для авторизации (нужен для всех операций)
      const token = localStorage.getItem('token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      
      let originalTileUrl, bounds, projectId, fileId;

      if (isGeoTIFFLayer) {
        // Если это GeoTIFF слой, загружаем файл на сервер
        const geotiffInfo = geotiffLayerRef.current;
        if (!geotiffInfo || !geotiffInfo.file) {
          const error = new Error('Исходный файл GeoTIFF не найден');
          console.error(error.message);
          throw error;
        }

        bounds = geotiffInfo.bounds;
        if (!bounds) {
          const error = new Error('Границы GeoTIFF файла не найдены');
          console.error(error.message);
          throw error;
        }

        // Получаем fileName из geotiffInfo (нужен для всех случаев)
        const fileName = geotiffInfo.fileName || (geotiffInfo.file instanceof File ? geotiffInfo.file.name : 'geotiff.tif');
        
        // Проверяем, есть ли уже сохраненные projectId/fileId (кэш для избежания повторных загрузок)
        let projectIdNum, fileIdNum, uploadData = null;
        const cachedProjectId = geotiffInfo.serverProjectId;
        const cachedFileId = geotiffInfo.serverFileId;

        if (cachedProjectId && cachedFileId) {
          // Используем кэшированные значения
          console.log('Используем кэшированные projectId/fileId для применения фильтра:', cachedProjectId, cachedFileId);
          projectIdNum = parseInt(cachedProjectId, 10);
          fileId = String(cachedFileId);
          projectId = String(projectIdNum);
        } else {
          // Первое применение фильтра - загружаем файл на сервер
          console.log('Обнаружен GeoTIFF слой, загружаем файл на сервер для применения фильтра...');

          // Получаем или создаем проект
          projectIdNum = localStorage.getItem('floodProjectId');
          
          if (!projectIdNum || isNaN(parseInt(projectIdNum, 10))) {
            projectIdNum = await createProject(authHeader);
          } else {
            projectIdNum = parseInt(projectIdNum, 10);
            if (isNaN(projectIdNum)) {
              projectIdNum = await createProject(authHeader);
            }
          }

          // Создаем File из Blob для загрузки на сервер
          const fileToUpload = geotiffInfo.file instanceof File 
            ? geotiffInfo.file 
            : new File([geotiffInfo.file], fileName, { type: 'image/tiff' });

          // Загружаем файл на сервер
          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('kind', 'terrain');

          let uploadRes = await fetch(`/api/flood/projects/${projectIdNum}/upload`, {
            method: 'POST',
            headers: authHeader,
            body: formData,
          });

          // Если проект не найден, создаем новый и повторяем загрузку
          if (uploadRes.status === 404) {
            console.log('Проект не найден, создаем новый...');
            projectIdNum = await createProject(authHeader);
            
            // Повторяем загрузку с новым projectId
            uploadRes = await fetch(`/api/flood/projects/${projectIdNum}/upload`, {
              method: 'POST',
              headers: authHeader,
              body: formData,
            });
          }

          if (!uploadRes.ok) {
            const errorText = await uploadRes.text().catch(() => 'Ошибка загрузки файла на сервер');
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { detail: errorText };
            }
            throw new Error(errorData.detail || errorData.message || `Ошибка при загрузке файла: ${uploadRes.status}`);
          }

          uploadData = await uploadRes.json();
          fileIdNum = uploadData.fileId;
          fileId = String(fileIdNum);
          projectId = String(projectIdNum);
          
          // Сохраняем projectId/fileId в кэш для последующих применений фильтров
          geotiffInfo.serverProjectId = projectId;
          geotiffInfo.serverFileId = fileId;
        }

        // Используем bounds из загруженного файла или из geotiffInfo
        if (uploadData && uploadData.bounds) {
          bounds = uploadData.bounds;
        }

        // Формируем исходный tileUrl
        originalTileUrl = `/api/flood/projects/${projectId}/tiles/{z}/{x}/{y}.png?layer=terrain&fileId=${fileId}`;

        // Сохраняем информацию об исходном GeoTIFF слое для последующих применений фильтров и undo
        // Сохраняем исходный файл и информацию о нем перед очисткой geotiffLayerRef
        if (!originalTerrainLayerRef.current) {
          originalTerrainLayerRef.current = { 
            type: 'geotiff', // Маркер, что исходный слой был GeoTIFF
            file: geotiffInfo.file, // Сохраняем исходный файл
            fileName: geotiffInfo.fileName,
            bounds: bounds,
          };
        }

        // Применяем фильтр к файлу на сервере
        console.log('Применение фильтра к файлу на сервере...');
        const filterParamsJson = JSON.stringify(params);
        
        const applyFilterRes = await fetch(`/api/flood/projects/${projectIdNum}/files/${fileId}/apply-filter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...authHeader,
          },
          body: new URLSearchParams({
            filter_type: filterType,
            filter_params: filterParamsJson,
          }),
        });

        if (!applyFilterRes.ok) {
          const errorText = await applyFilterRes.text().catch(() => 'Ошибка применения фильтра к файлу');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { detail: errorText };
          }
          throw new Error(errorData.detail || errorData.message || `Ошибка при применении фильтра: ${applyFilterRes.status}`);
        }

        const filterResult = await applyFilterRes.json();
        console.log('✅ Фильтр успешно применен к файлу, обновленные границы:', filterResult.bounds);

        // Обновляем границы, если они изменились
        if (filterResult.bounds) {
          bounds = filterResult.bounds;
        }

        // Скачиваем обработанный файл обратно
        console.log('Скачивание обработанного GeoTIFF файла...');
        const downloadRes = await fetch(`/api/flood/projects/${projectIdNum}/files/${fileId}/download`, {
          method: 'GET',
          headers: authHeader,
        });

        if (!downloadRes.ok) {
          const errorText = await downloadRes.text().catch(() => 'Ошибка скачивания файла');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { detail: errorText };
          }
          throw new Error(errorData.detail || errorData.message || `Ошибка при скачивании файла: ${downloadRes.status}`);
        }

        const filteredFileBlob = await downloadRes.blob();
        console.log('✅ Обработанный GeoTIFF файл успешно скачан, размер:', filteredFileBlob.size, 'байт');

        // Удаляем старый GeoTIFF слой с карты
        const { layerId: geotiffLayerId, sourceId: geotiffSourceId } = geotiffInfo;
        try {
          if (map.getLayer(geotiffLayerId)) {
            map.removeLayer(geotiffLayerId);
            console.log(`Удален GeoTIFF слой: ${geotiffLayerId}`);
          }
          if (map.getSource(geotiffSourceId)) {
            map.removeSource(geotiffSourceId);
            console.log(`Удален GeoTIFF источник: ${geotiffSourceId}`);
          }
        } catch (error) {
          console.warn('Ошибка при удалении GeoTIFF слоя:', error);
        }

        // Отображаем обработанный GeoTIFF файл напрямую на карте
        const newLayerId = `geotiff-${Date.now()}`;
        const result = await loadAndDisplayGeoTIFF(map, filteredFileBlob, newLayerId, {
          colorScale: 'terrain',
          opacity: 0.8
        });

        // Сохраняем информацию о новом GeoTIFF слое
        // Сохраняем также projectId/fileId для последующих применений фильтров
        geotiffLayerRef.current = {
          layerId: result.layerId,
          sourceId: result.sourceId,
          bounds: result.bounds || bounds,
          fileName: geotiffInfo.fileName || fileName,
          file: filteredFileBlob, // Сохраняем обработанный файл
          serverProjectId: projectId, // Кэшируем для последующих применений фильтров
          serverFileId: fileId // Кэшируем для последующих применений фильтров
        };

        // Обновляем имя загруженного файла
        setUploadedFileName(fileName);
        setTerrainLayerId(newLayerId);

        // Приближаем камеру к границам файла
        if (result.bounds) {
          setTimeout(() => {
            fitBoundsToFile(result.bounds);
          }, 500);
        }

        console.log('✅ Обработанный GeoTIFF файл успешно отображен на карте');
        
        // Сохраняем действие в историю после успешного применения
        filterHistoryRef.current.push(filterAction);
        setHasFilterHistory(true);
        
        // Ждем, пока карта обновится после добавления нового GeoTIFF слоя
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (map.isStyleLoaded()) {
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 200);
            map.once('styledata', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }

        // Выходим из функции, так как для GeoTIFF мы уже обработали все
        return;
      } else {
        // Получаем информацию об исходном слое (для тайловых слоев)
        const originalLayer = originalTerrainLayerRef.current;
        if (!originalLayer) {
          const error = new Error('Информация об исходном слое не найдена');
          console.warn(error.message);
          throw error;
        }

        ({ tileUrl: originalTileUrl, bounds } = originalLayer);
        
        // Извлекаем fileId и projectId из исходного URL
        const urlMatch = originalTileUrl.match(/\/projects\/(\d+)\/tiles.*[?&]fileId=([^&\s]+)/);
        if (!urlMatch) {
          const error = new Error(`Не удалось извлечь projectId и fileId из URL: ${originalTileUrl}`);
          console.error(error.message);
          throw error;
        }

        projectId = urlMatch[1];
        fileId = urlMatch[2];
      }
      
      console.log('Исходный URL:', originalTileUrl);
      console.log('Bounds:', bounds);
      console.log('Извлеченные параметры:', { projectId, fileId });

      // Применяем фильтр к файлу в БД ПЕРЕД добавлением слоя
      // После применения фильтра к файлу, тайлы будут генерироваться из обновленного файла без параметров фильтра
      let filterAppliedToFile = false;
      if ((filterType === 'DTM_FILTER' || filterType === 'HYDRO_CORRECTION') && fileId && projectId) {
        try {
          console.log('Применение фильтра к файлу в БД...');
          const filterParamsJson = JSON.stringify(params);
          
          const applyFilterRes = await fetch(`/api/flood/projects/${projectId}/files/${fileId}/apply-filter`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              ...authHeader,
            },
            body: new URLSearchParams({
              filter_type: filterType,
              filter_params: filterParamsJson,
            }),
          });

          if (!applyFilterRes.ok) {
            const errorText = await applyFilterRes.text().catch(() => 'Ошибка применения фильтра к файлу');
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { detail: errorText };
            }
            console.warn('Ошибка при применении фильтра к файлу в БД:', errorData.detail || errorData.message);
            // Продолжаем с применением фильтра к тайлам, если не удалось применить к файлу
          } else {
            const filterResult = await applyFilterRes.json();
            console.log('✅ Фильтр успешно применен к файлу в БД, обновленные границы:', filterResult.bounds);
            
            // Обновляем границы, если они изменились
            if (filterResult.bounds) {
              bounds = filterResult.bounds;
            }
            
            // Фильтр успешно применен к файлу
            filterAppliedToFile = true;
          }
        } catch (error) {
          console.warn('Ошибка при применении фильтра к файлу в БД:', error);
          // Продолжаем с применением фильтра к тайлам, если не удалось применить к файлу
        }
      }

      // Формируем URL тайлов
      // Если фильтр был применен к файлу, используем URL без параметров фильтра
      // Иначе используем URL с параметрами фильтра для применения на лету
      let newTileUrl = `/api/flood/projects/${projectId}/tiles/{z}/{x}/{y}.png?layer=terrain&fileId=${fileId}`;
      
      // Добавляем параметры фильтра только если фильтр НЕ был применен к файлу
      if (filterType === 'DTM_FILTER' && !filterAppliedToFile) {
        const sensitivityMultiplier = params.sensitivityMultiplier || 1.0;
        const numberOfIterations = params.numberOfIterations || 200;
        newTileUrl += `&dtmSensitivity=${sensitivityMultiplier}&dtmIterations=${numberOfIterations}`;
      }
      // TODO: Добавить поддержку других типов фильтров

      console.log('Применение фильтра:', filterType, params);
      console.log('Новый URL тайлов:', newTileUrl);

      // Проверяем, что bounds существуют
      if (!bounds) {
        const error = new Error('Bounds не найдены, невозможно обновить слой');
        console.error(error.message);
        throw error;
      }

      // Удаляем текущий тайловый слой (только если это не GeoTIFF слой, для которого мы уже удалили слой выше)
      if (!isGeoTIFFLayer) {
        try {
          const style = map.getStyle();
          if (style && style.layers) {
            const terrainLayers = style.layers.filter(layer => 
              layer.id && layer.id.startsWith('terrain-')
            );
            
            terrainLayers.forEach(layer => {
              try {
                if (map.getLayer(layer.id)) {
                  map.removeLayer(layer.id);
                  console.log(`Удален слой: ${layer.id}`);
                }
              } catch (error) {
                console.warn(`Ошибка при удалении слоя ${layer.id}:`, error);
              }
            });
          }
          
          if (style && style.sources) {
            const terrainSources = Object.keys(style.sources).filter(sourceId => 
              sourceId.startsWith('terrain-source-')
            );
            
            terrainSources.forEach(sourceId => {
              try {
                if (map.getSource(sourceId)) {
                  map.removeSource(sourceId);
                  console.log(`Удален источник: ${sourceId}`);
                }
              } catch (error) {
                console.warn(`Ошибка при удалении источника ${sourceId}:`, error);
              }
            });
          }
        } catch (error) {
          console.error('Ошибка при удалении слоев рельефа:', error);
        }
      }

      // Сбрасываем terrainLayerId перед добавлением нового слоя (только если это не GeoTIFF слой, где мы уже сбросили)
      if (!isGeoTIFFLayer) {
        setTerrainLayerId(null);
      }

      // Добавляем новый слой с фильтром и ждем успешного добавления
      // Используем задержку, чтобы дать время удалить старый слой и обновить карту (только для тайловых слоев)
      if (!isGeoTIFFLayer) {
        console.log('Ожидание перед добавлением нового слоя с фильтром...');
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        // Ждем, пока карта обновится после удаления слоев
        if (map.isStyleLoaded()) {
          // Ждем события styledata, чтобы убедиться, что стиль обновлен
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 200);
            map.once('styledata', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }
      }
      
      console.log('Добавление нового слоя с фильтром...');
      await addTerrainLayer(newTileUrl, bounds, false); // false - не перезаписываем originalTerrainLayerRef
      
      // Обновляем originalTerrainLayerRef с новым URL и границами после применения фильтра
      // Но сохраняем информацию о типе и файле, если они есть (для GeoTIFF)
      if (originalTerrainLayerRef.current) {
        originalTerrainLayerRef.current.tileUrl = newTileUrl;
        originalTerrainLayerRef.current.bounds = bounds;
        // Сохраняем type и file, если они были (для GeoTIFF слоев)
        // Они уже должны быть сохранены при первом применении фильтра
      }
      
      // Сохраняем действие в историю после успешного применения
      filterHistoryRef.current.push(filterAction);
      setHasFilterHistory(true);

      console.log('✅ Фильтр успешно применен и слой добавлен на карту');
    } catch (error) {
      console.error('❌ Ошибка при применении фильтра:', error);
      throw error; // Пробрасываем ошибку дальше
    }
  }, [terrainLayerId, addTerrainLayer, fitBoundsToFile]);

  // Функция для сброса всех примененных фильтров
  const handleUndo = useCallback(() => {
    const history = filterHistoryRef.current;
    if (history.length === 0) {
      console.log('Нет фильтров для отмены');
      return;
    }

    // Сохраняем информацию об исходном слое перед удалением
    const originalLayer = originalTerrainLayerRef.current;
    if (!originalLayer) {
      console.warn('Информация об исходном слое не найдена');
      return;
    }

    // Проверяем, был ли исходный слой GeoTIFF
    const isOriginalGeoTIFF = originalLayer.type === 'geotiff' && originalLayer.file;
    
    // Очищаем всю историю фильтров
    filterHistoryRef.current = [];
    setHasFilterHistory(false);
    
    console.log('Сброшены все примененные фильтры');
    
    // Удаляем текущий слой (но сохраняем originalTerrainLayerRef для перезагрузки)
    const map = mapRef.current;
    if (map) {
      try {
        // Удаляем GeoTIFF слой, если есть
        if (geotiffLayerRef.current) {
          const { layerId, sourceId } = geotiffLayerRef.current;
          try {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId);
            }
            if (map.getSource(sourceId)) {
              map.removeSource(sourceId);
            }
          } catch (error) {
            console.warn('Ошибка при удалении GeoTIFF слоя:', error);
          }
          geotiffLayerRef.current = null;
        }

        const style = map.getStyle();
        if (style && style.layers) {
          // Удаляем тайловые слои рельефа
          const terrainLayers = style.layers.filter(layer => 
            layer.id && layer.id.startsWith('terrain-')
          );
          
          terrainLayers.forEach(layer => {
            try {
              if (map.getLayer(layer.id)) {
                map.removeLayer(layer.id);
              }
            } catch (error) {
              console.warn(`Ошибка при удалении слоя ${layer.id}:`, error);
            }
          });
        }
        
        if (style && style.sources) {
          const terrainSources = Object.keys(style.sources).filter(sourceId => 
            sourceId.startsWith('terrain-source-')
          );
          
          terrainSources.forEach(sourceId => {
            try {
              if (map.getSource(sourceId)) {
                map.removeSource(sourceId);
              }
            } catch (error) {
              console.warn(`Ошибка при удалении источника ${sourceId}:`, error);
            }
          });
        }
      } catch (error) {
        console.error('Ошибка при удалении слоев рельефа:', error);
      }
    }
    
    setTerrainLayerId(null);
    
    // Восстанавливаем исходный слой без фильтров
    // Используем setTimeout, чтобы дать время удалить старый слой
    setTimeout(async () => {
      const currentMap = mapRef.current;
      if (!currentMap) {
        console.warn('Карта не доступна для восстановления слоя');
        return;
      }

      if (isOriginalGeoTIFF) {
        // Если исходный слой был GeoTIFF, восстанавливаем его напрямую
        try {
          const { file, fileName, bounds } = originalLayer;

          // Загружаем и отображаем GeoTIFF (geotiffLayerRef уже очищен выше)
          const layerId = `geotiff-${Date.now()}`;
          const result = await loadAndDisplayGeoTIFF(currentMap, file, layerId, {
            colorScale: 'terrain',
            opacity: 0.8
          });

          // Сохраняем информацию о слое
          geotiffLayerRef.current = {
            layerId: result.layerId,
            sourceId: result.sourceId,
            bounds: result.bounds,
            fileName: fileName,
            file: file
          };

          // Приближаем камеру к границам файла
          if (result.bounds) {
            setTimeout(() => {
              fitBoundsToFile(result.bounds);
            }, 500);
          }

          setUploadedFileName(fileName);
          setTerrainLayerId(layerId);
          
          console.log('Исходный GeoTIFF файл успешно восстановлен');
        } catch (error) {
          console.error('Ошибка при восстановлении исходного GeoTIFF файла:', error);
        }
      } else {
        // Если исходный слой был тайловым, восстанавливаем его через addTerrainLayer
        const { tileUrl, bounds } = originalLayer;
        addTerrainLayer(tileUrl, bounds, false).catch((error) => {
          console.error('Ошибка при восстановлении исходного слоя:', error);
        }); // false - не перезаписываем originalTerrainLayerRef
      }
    }, 100);
  }, [addTerrainLayer, fitBoundsToFile]);

  // Обработчик закрытия диалога
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedDataset(null);
    setDownloadError(null);
  };

  // Обработчик закрытия диалога Land Cover
  const handleLandCoverDialogClose = () => {
    if (!landCoverDownloading) {
      setLandCoverDialogOpen(false);
      setLandCoverDownloadError(null);
      setLandCoverDownloadProgress(0);
    }
  };

  // Обработчик загрузки данных WorldCover
  const handleDownloadWorldCover = async () => {
    // Получаем координаты из слоя рельефа, если он существует
    // Приоритет: geotiffLayerRef > originalTerrainLayerRef > aoiBounds
    let terrainBounds = null;
    
    if (geotiffLayerRef.current?.bounds) {
      // Используем координаты из GeoTIFF слоя (загруженного вручную или через OpenTopography)
      terrainBounds = geotiffLayerRef.current.bounds;
      console.log('Используем координаты из GeoTIFF слоя рельефа:', terrainBounds);
    } else if (originalTerrainLayerRef.current?.bounds) {
      // Используем координаты из исходного тайлового слоя рельефа
      terrainBounds = originalTerrainLayerRef.current.bounds;
      console.log('Используем координаты из исходного тайлового слоя рельефа:', terrainBounds);
    } else if (aoiBounds) {
      // Используем координаты из выделенной области
      terrainBounds = aoiBounds;
      console.log('Используем координаты из выделенной области:', terrainBounds);
    }

    if (!terrainBounds) {
      setLandCoverDownloadError(t('floodModeling.loadTerrainOrSelectArea'));
      return;
    }

    setLandCoverDownloading(true);
    setLandCoverDownloadError(null);
    setLandCoverDownloadProgress(0);

    try {
      // Валидация координат
      if (terrainBounds.west >= terrainBounds.east || terrainBounds.south >= terrainBounds.north) {
        setLandCoverDownloadError(t('floodModeling.invalidCoordinates'));
        setLandCoverDownloading(false);
        return;
      }

      const formatCoord = (coord) => {
        return parseFloat(coord.toFixed(10));
      };

      const token = localStorage.getItem('token');
      if (!token) {
        setLandCoverDownloadError(t('floodModeling.authorizationRequired'));
        setLandCoverDownloading(false);
        return;
      }

      // Проверяем валидность токена
      try {
        const checkResponse = await fetch('/auth/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!checkResponse.ok) {
          setLandCoverDownloadError(t('floodModeling.sessionExpired'));
          setLandCoverDownloading(false);
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('rememberMe');
          navigate('/login');
          return;
        }
      } catch (checkError) {
        console.error('Ошибка при проверке токена:', checkError);
        setLandCoverDownloadError(t('floodModeling.authCheckError'));
        setLandCoverDownloading(false);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rememberMe');
        navigate('/login');
        return;
      }

      // Формируем параметры запроса
      const backendParams = new URLSearchParams({
        south: formatCoord(terrainBounds.south).toString(),
        north: formatCoord(terrainBounds.north).toString(),
        west: formatCoord(terrainBounds.west).toString(),
        east: formatCoord(terrainBounds.east).toString(),
        outputFormat: 'GTiff',
      });

      const backendUrl = `/api/flood/worldcover/download?${backendParams.toString()}`;

      console.log('Запрос к WorldCover API через бэкенд:', {
        west: formatCoord(terrainBounds.west),
        south: formatCoord(terrainBounds.south),
        east: formatCoord(terrainBounds.east),
        north: formatCoord(terrainBounds.north),
      });

      setLandCoverDownloadProgress(30);

      // Отправляем запрос
      const response = await authenticatedFetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, navigate, false);

      setLandCoverDownloadProgress(60);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Ошибка запроса к WorldCover API: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        console.error('Ошибка запроса к WorldCover API:', errorMessage);
        setLandCoverDownloadError(errorMessage);
        setLandCoverDownloading(false);
        return;
      }

      setLandCoverDownloadProgress(80);

      // Получаем бинарный ответ (GeoTIFF)
      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('Получен пустой файл от WorldCover API');
      }

      console.log(`Получен файл от WorldCover API, размер: ${blob.size} байт`);

      setLandCoverDownloadProgress(90);

      // Создаем URL для скачивания файла
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worldcover_${formatCoord(terrainBounds.west)}_${formatCoord(terrainBounds.south)}_${formatCoord(terrainBounds.east)}_${formatCoord(terrainBounds.north)}.tif`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setLandCoverDownloadProgress(100);
      setLandCoverDownloading(false);

      // Закрываем диалог через небольшую задержку
      setTimeout(() => {
        setLandCoverDialogOpen(false);
        setLandCoverDownloadProgress(0);
      }, 1000);

    } catch (error) {
      console.error('Ошибка при загрузке данных WorldCover:', error);
      setLandCoverDownloadError(error.message || 'Ошибка при загрузке данных WorldCover');
      setLandCoverDownloading(false);
    }
  };

  // Обработчик выбора набора данных
  const handleDatasetSelect = (dataset) => {
    setSelectedDataset(dataset);
    setDownloadError(null);
  };

  // Обработчик загрузки рельефа
  const handleDownloadTerrain = async () => {
    if (!selectedDataset || !aoiBounds) {
      setDownloadError('Выберите набор данных и область');
      return;
    }

    setDownloading(true);
    setDownloadError(null);

    try {
      // Валидация координат
      if (aoiBounds.west >= aoiBounds.east || aoiBounds.south >= aoiBounds.north) {
        setDownloadError(t('floodModeling.invalidCoordinates'));
        setDownloading(false);
        return;
      }

      // Отправляем запрос к OpenTopography API через бэкенд
      const opentopographyDemType = selectedDataset.opentopographyDemType || 'COP30';
      
      // Используем высокую точность для координат (до 10 знаков после запятой)
      const formatCoord = (coord) => {
        // Ограничиваем точность до 10 знаков после запятой для избежания проблем с точностью
        return parseFloat(coord.toFixed(10));
      };
      
      const token = localStorage.getItem('token');
      if (!token) {
        setDownloadError(t('floodModeling.authorizationRequired'));
        setDownloading(false);
        return;
      }
      
      // Проверяем валидность токена перед запросом
      console.log('Проверка валидности токена перед запросом...');
      try {
        const checkResponse = await fetch('/auth/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!checkResponse.ok) {
          const errorText = await checkResponse.text();
          console.error('Токен невалидный или истек:', {
            status: checkResponse.status,
            statusText: checkResponse.statusText,
            error: errorText
          });
          setDownloadError('Сессия истекла. Пожалуйста, войдите в систему снова.');
          setDownloading(false);
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('rememberMe');
          navigate('/login');
          return;
        }
        
        const userData = await checkResponse.json();
        console.log('Токен валидный, пользователь:', userData.username);
      } catch (checkError) {
        console.error('Ошибка при проверке токена:', checkError);
        setDownloadError('Ошибка при проверке авторизации. Пожалуйста, войдите в систему снова.');
        setDownloading(false);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rememberMe');
        navigate('/login');
        return;
      }
      
      // Отправляем запрос к бэкенду для проксирования запроса к OpenTopography API
      try {
        // Формируем параметры запроса к нашему бэкенд-эндпоинту
        const backendParams = new URLSearchParams({
          demtype: opentopographyDemType,
          south: formatCoord(aoiBounds.south).toString(),
          north: formatCoord(aoiBounds.north).toString(),
          west: formatCoord(aoiBounds.west).toString(),
          east: formatCoord(aoiBounds.east).toString(),
          outputFormat: 'GTiff',
        });

        const backendUrl = `/api/flood/opentopography/globaldem?${backendParams.toString()}`;
        
        console.log('Запрос к OpenTopography API через бэкенд:', {
          west: formatCoord(aoiBounds.west),
          south: formatCoord(aoiBounds.south),
          east: formatCoord(aoiBounds.east),
          north: formatCoord(aoiBounds.north),
          demtype: opentopographyDemType
        });

        // Используем authenticatedFetch с autoRedirect = false, чтобы обработать ошибку в компоненте
        let opentopographyResponse;
        try {
          // Проверяем токен еще раз непосредственно перед запросом
          const currentToken = localStorage.getItem('token');
          if (!currentToken || currentToken !== token) {
            console.error('Токен изменился или был удален между проверкой и запросом');
            setDownloadError('Сессия истекла. Пожалуйста, войдите в систему снова.');
            setDownloading(false);
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('rememberMe');
            navigate('/login');
            return;
          }
          
          console.log('Отправка запроса к OpenTopography API через бэкенд, токен:', currentToken ? currentToken.substring(0, 20) + '...' : 'отсутствует');
          opentopographyResponse = await authenticatedFetch(backendUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }, navigate, false); // autoRedirect = false, чтобы обработать ошибку здесь
        } catch (error) {
          // Если это ошибка авторизации, обрабатываем её
          if (error.message === 'Unauthorized') {
            console.error('Ошибка авторизации при запросе к OpenTopography API');
            setDownloadError('Сессия истекла. Пожалуйста, войдите в систему снова.');
            setDownloading(false);
            // Очищаем токен и перенаправляем на логин
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('rememberMe');
            navigate('/login');
            return;
          }
          throw error;
        }
        
        if (!opentopographyResponse.ok) {
          const errorText = await opentopographyResponse.text();
          let errorMessage = `Ошибка запроса к OpenTopography API: ${opentopographyResponse.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          console.error('Ошибка запроса к OpenTopography API:', errorMessage);
          
          // Если ошибка авторизации
          if (opentopographyResponse.status === 401) {
            setDownloadError('Сессия истекла. Пожалуйста, войдите в систему снова.');
            setDownloading(false);
            navigate('/login');
            return;
          }
          
          throw new Error(errorMessage);
        }
        
        // Бинарный ответ (GeoTIFF) - отображаем напрямую с помощью geotiff.js
        const blob = await opentopographyResponse.blob();
        
        // Проверяем, что это действительно файл (размер больше 0)
        if (blob.size === 0) {
          throw new Error('Получен пустой файл от OpenTopography API');
        }
        
        console.log(`Получен файл от OpenTopography API через бэкенд, размер: ${blob.size} байт`);
        
        // Ждем готовности карты
        const map = mapRef.current;
        if (!map || !map.loaded() || !map.isStyleLoaded()) {
          await new Promise((resolve) => {
            if (map && map.loaded() && map.isStyleLoaded()) {
              resolve();
            } else {
              const checkReady = () => {
                if (map && map.loaded() && map.isStyleLoaded()) {
                  map.off('load', checkReady);
                  map.off('style.load', checkReady);
                  resolve();
                }
              };
              if (map) {
                map.once('load', checkReady);
                map.once('style.load', checkReady);
              }
            }
          });
        }

        // Удаляем предыдущий GeoTIFF слой, если есть
        if (geotiffLayerRef.current) {
          const { layerId, sourceId } = geotiffLayerRef.current;
          try {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId);
            }
            if (map.getSource(sourceId)) {
              map.removeSource(sourceId);
            }
          } catch (error) {
            console.warn('Ошибка при удалении предыдущего GeoTIFF слоя:', error);
          }
          geotiffLayerRef.current = null;
        }

        // Отображаем GeoTIFF файл напрямую на карте
        const layerId = `geotiff-opentopography-${Date.now()}`;
        const result = await loadAndDisplayGeoTIFF(map, blob, layerId, {
          colorScale: 'terrain',
          opacity: 0.8
        });

        // Сохраняем информацию о слое, включая исходный blob для последующей загрузки на сервер при применении фильтров
        geotiffLayerRef.current = {
          layerId: result.layerId,
          sourceId: result.sourceId,
          bounds: result.bounds,
          fileName: `OpenTopography_${selectedDataset.name}.tif`,
          file: blob // Сохраняем blob для последующей загрузки на сервер
        };

        // Используем границы из результата или из aoiBounds
        const displayBounds = result.bounds || aoiBounds;

        // Приближаем камеру к границам файла
        if (displayBounds) {
          setTimeout(() => {
            fitBoundsToFile(displayBounds);
          }, 500);
        }

        setUploadedFileName(`OpenTopography: ${selectedDataset.name}`);
        setTerrainLayerId(layerId);
        
        // Закрываем диалог и сбрасываем выбранный набор данных
        setDialogOpen(false);
        setSelectedDataset(null);
        setAoiActive(false);
        clearRectangle();
        
        console.log('GeoTIFF файл от OpenTopography успешно отображен на карте');
        
      } catch (opentopographyError) {
        console.error('Ошибка при загрузке данных из OpenTopography API:', opentopographyError);
        setDownloadError(opentopographyError.message || 'Ошибка при загрузке рельефа из OpenTopography API');
        // Не закрываем диалог, чтобы пользователь мог попробовать снова
      }
    } catch (error) {
      console.error('Error downloading terrain:', error);
      setDownloadError(error.message || 'Ошибка при загрузке рельефа');
    } finally {
      // Гарантируем, что downloading всегда сбрасывается
      console.log('Сбрасываем downloading в false');
      setDownloading(false);
    }
  };

  // Функция для вычисления приблизительной площади выделенной области
  const calculateArea = (bounds) => {
    if (!bounds) return 0;
    // Приблизительный расчет площади в квадратных километрах
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const avgLat = (bounds.north + bounds.south) / 2;
    const latMeters = latDiff * 111320; // метры на градус широты
    const lngMeters = lngDiff * 111320 * Math.cos(avgLat * Math.PI / 180);
    const areaKm2 = (latMeters * lngMeters) / 1000000;
    return areaKm2;
  };

  // Функция для получения списка пользовательских слоев
  const getUserLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded() || !map.isStyleLoaded()) {
      return [];
    }

    try {
      const style = map.getStyle();
      if (!style || !style.layers) {
        return [];
      }

      const layers = [];
      
      // Получаем все слои, которые начинаются с terrain- или geotiff-
      style.layers.forEach(layer => {
        if (layer.id && (layer.id.startsWith('terrain-') || layer.id.startsWith('geotiff-'))) {
          const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
          
          // Получаем имя файла из refs или используем uploadedFileName
          let layerName = layer.id;
          if (layer.id.startsWith('geotiff-') && geotiffLayerRef.current && geotiffLayerRef.current.layerId === layer.id) {
            layerName = geotiffLayerRef.current.fileName || layer.id;
          } else if (layer.id.startsWith('terrain-')) {
            // Для terrain слоев используем uploadedFileName, если слой активный, иначе генерируем имя
            if (terrainLayerId === layer.id && uploadedFileName) {
              layerName = uploadedFileName;
            } else {
              layerName = `Terrain Layer`;
            }
          }

          layers.push({
            id: layer.id,
            name: layerName,
            visible: visibility === 'visible',
            type: layer.type || 'raster'
          });
        }
      });

      return layers;
    } catch (error) {
      console.error('Ошибка при получении списка слоев:', error);
      return [];
    }
  }, [terrainLayerId, uploadedFileName]);

  // Обновление списка слоев при изменении карты
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateLayers = () => {
      const layers = getUserLayers();
      setUserLayers(layers);
    };

    // Обновляем список слоев при загрузке карты и изменении стиля
    const handleStyleLoad = () => {
      setTimeout(updateLayers, 100);
    };

    if (map.loaded() && map.isStyleLoaded()) {
      updateLayers();
    }

    map.on('style.load', handleStyleLoad);
    map.on('data', updateLayers);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('data', updateLayers);
    };
  }, [getUserLayers, terrainLayerId, uploadedFileName]);

  // Обработчики для меню управления слоями
  const handleLayersMenuOpen = (event) => {
    // Обновляем список слоев перед открытием меню
    const layers = getUserLayers();
    setUserLayers(layers);
    setLayersMenuAnchor(event.currentTarget);
  };

  const handleLayersMenuClose = () => {
    setLayersMenuAnchor(null);
  };

  // Функция для переключения видимости слоя
  const toggleLayerVisibility = useCallback((layerId) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const layer = map.getLayer(layerId);
      if (!layer) {
        console.warn(`Слой ${layerId} не найден`);
        return;
      }

      const currentVisibility = map.getLayoutProperty(layerId, 'visibility') || 'visible';
      const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
      
      map.setLayoutProperty(layerId, 'visibility', newVisibility);
      
      // Обновляем список слоев
      const layers = getUserLayers();
      setUserLayers(layers);
    } catch (error) {
      console.error('Ошибка при переключении видимости слоя:', error);
    }
  }, [getUserLayers]);

  // Функции управления картой для toolbar
  const handleZoomIn = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomOut();
  }, []);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter([82.6, 48.5]);
    map.setZoom(6);
    map.setPitch(0);
    map.setBearing(0);
  }, []);

  // Обработчик для кнопки Simulate - создает слой с областями низкого уровня воды
  // Ref для хранения handleSimulate, чтобы использовать в useEffect без зависимостей
  const handleSimulateRef = useRef(null);
  
  const handleSimulate = useCallback(async (overrideParams = null) => {
    const map = mapRef.current;
    if (!map || !map.loaded() || !map.isStyleLoaded()) {
      console.error('Карта не готова для симуляции');
      return;
    }

    // Проверяем наличие загруженного файла рельефа
    const hasGeoTIFF = geotiffLayerRef.current && geotiffLayerRef.current.file;
    const hasTerrain = originalTerrainLayerRef.current;

    if (!hasGeoTIFF && !hasTerrain) {
      setDownloadError(t('floodModeling.loadTerrainFileFirst'));
      return;
    }

    try {
      // Получаем параметры симуляции из состояния или из переданных параметров
      const intensity = overrideParams?.rainfallIntensity !== undefined 
        ? parseFloat(overrideParams.rainfallIntensity) 
        : parseFloat(rainfallIntensity) || 60.0;
      const duration = overrideParams?.rainfallDuration !== undefined 
        ? parseFloat(overrideParams.rainfallDuration) 
        : parseFloat(rainfallDuration) || 3.0;
      const multiplier = overrideParams?.rainfallMultiplier !== undefined 
        ? parseFloat(overrideParams.rainfallMultiplier) 
        : parseFloat(rainfallMultiplier) || 1.0;
      const shape = overrideParams?.rainShape !== undefined 
        ? parseFloat(overrideParams.rainShape) 
        : parseFloat(rainShape) || 0.0;

      console.log('Запуск симуляции с параметрами:', {
        rainfallIntensity: intensity,
        rainfallDuration: duration,
        rainfallMultiplier: multiplier,
        rainShape: shape
      });

      // Удаляем предыдущий слой уровня воды, если он существует (для повторного запуска симуляции)
      if (waterLevelLayerRef.current) {
        const { layerId, sourceId } = waterLevelLayerRef.current;
        try {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        } catch (error) {
          console.warn('Ошибка при удалении предыдущего слоя уровня воды:', error);
        }
        waterLevelLayerRef.current = null;
      }

      // Если есть GeoTIFF файл, используем его для создания слоя уровня воды
      if (hasGeoTIFF) {
        const terrainFile = geotiffLayerRef.current.file;
        const terrainBounds = geotiffLayerRef.current.bounds;

        // Вычисляем пороговое значение: rainfallIntensity (mm/h) * 24 = дневное количество осадков (mm)
        // Преобразуем мм в метры для сравнения с высотой рельефа (рельеф обычно в метрах)
        const dailyRainfallMm = intensity * 24;
        const dailyRainfallMeters = dailyRainfallMm / 1000; // Преобразуем мм в метры
        
        console.log(`Порог затопления: ${dailyRainfallMm} mm (${intensity} mm/h * 24) = ${dailyRainfallMeters} m`);
        console.log(`Порог применяется относительно минимальной точки рельефа (не от уровня моря)`);

        // Создаем новый слой на основе файла рельефа с текущими параметрами симуляции
        // Закрашиваем только области, где относительная высота от минимальной точки рельефа меньше порога
        // Например, если минимальная высота = 100 м, а порог = 2.4 м, то закрашиваются области с высотой < 102.4 м
        const layerId = `water-level-${Date.now()}`;
        const result = await loadAndDisplayGeoTIFF(map, terrainFile, layerId, {
          floodThreshold: dailyRainfallMeters, // Порог в метрах относительно минимальной точки рельефа
          floodColor: [0, 100, 255, 200], // Синий цвет для затопленных областей [R, G, B, A]
          opacity: 0.6 // Полупрозрачный слой поверх рельефа
        });

        // Сохраняем информацию о слое с параметрами симуляции
        waterLevelLayerRef.current = {
          layerId: result.layerId,
          sourceId: result.sourceId,
          bounds: result.bounds,
          fileName: `Water Level - ${geotiffLayerRef.current.fileName || 'terrain'}`,
          parameters: {
            rainfallIntensity: intensity,
            rainfallDuration: duration,
            rainfallMultiplier: multiplier,
            rainShape: shape
          }
        };

        console.log('Слой уровня воды успешно создан с параметрами:', waterLevelLayerRef.current.parameters);
      } else if (hasTerrain) {
        // Если есть тайловый слой рельефа, создаем слой на основе его данных
        // Для тайловых слоев нужно использовать другой подход
        console.log('Создание слоя уровня воды для тайлового рельефа пока не реализовано');
        setDownloadError('Создание слоя уровня воды для тайлового рельефа пока не поддерживается. Загрузите GeoTIFF файл.');
      }
    } catch (error) {
      console.error('Ошибка при создании слоя уровня воды:', error);
      setDownloadError(error.message || 'Ошибка при создании слоя уровня воды');
    }
  }, [rainfallIntensity, rainfallDuration, rainfallMultiplier, rainShape]);
  
  // Сохраняем handleSimulate в ref
  useEffect(() => {
    handleSimulateRef.current = handleSimulate;
  }, [handleSimulate]);

  // Состояния для шаринга
  const [openShare, setOpenShare] = useState(false);
  const [shareHash, setShareHash] = useState(null);
  const [loadingShareLink, setLoadingShareLink] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Обработчик для кнопки Share
  const handleShareClick = async () => {
    setOpenShare(true);
    setCopySuccess(false);
    setLoadingShareLink(false);
    
    // Проверяем, есть ли уже share_hash
    const projectId = localStorage.getItem('floodProjectId');
    if (!projectId) {
      alert(t('floodModeling.createProjectFirst'));
      setOpenShare(false);
      return;
    }
    
    // Пытаемся получить существующий share_hash или создать новый
    await handleCreateLink(false);
  };

  // Создание ссылки для шаринга
  const handleCreateLink = async (regenerate = false) => {
    const projectId = localStorage.getItem('floodProjectId');
    if (!projectId) {
      alert(t('floodModeling.createProjectFirst'));
      return;
    }
    
    setLoadingShareLink(true);
    try {
      const token = localStorage.getItem('token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Получаем текущее состояние карты
      const map = mapRef.current;
      let mapState = null;
      if (map && map.loaded() && map.isStyleLoaded()) {
        const center = map.getCenter();
        mapState = {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing()
        };
      }
      
      // Собираем данные о симуляции для сохранения
      const simulationData = {
        rainfallIntensity: rainfallIntensity,
        rainfallDuration: rainfallDuration,
        rainfallMultiplier: rainfallMultiplier,
        rainShape: rainShape,
        rainfallInputType: rainfallInputType,
        hasGeoTIFF: geotiffLayerRef.current !== null,
        hasWaterLevel: waterLevelLayerRef.current !== null,
        geotiffInfo: geotiffLayerRef.current ? {
          fileName: geotiffLayerRef.current.fileName,
          bounds: geotiffLayerRef.current.bounds
        } : null,
        waterLevelInfo: waterLevelLayerRef.current ? {
          fileName: waterLevelLayerRef.current.fileName,
          parameters: waterLevelLayerRef.current.parameters
        } : null,
        mapState: mapState // Сохраняем состояние карты
      };
      
      const url = regenerate 
        ? `/api/flood/projects/${projectId}/share?regenerate=true`
        : `/api/flood/projects/${projectId}/share`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          simulation_data: JSON.stringify(simulationData)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShareHash(data.share_hash);
      } else if (res.status === 404) {
        // Проект не найден (возможно, сервер был перезапущен)
        // Создаем новый проект
        console.log('Проект не найден, создаем новый...');
        const newProjectId = await createProject(authHeader);
        // Пытаемся создать share hash для нового проекта
        const retryUrl = regenerate 
          ? `/api/flood/projects/${newProjectId}/share?regenerate=true`
          : `/api/flood/projects/${newProjectId}/share`;
        const retryRes = await fetch(retryUrl, {
          method: 'POST',
          headers: authHeader
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          setShareHash(data.share_hash);
          alert(t('floodModeling.projectRecreated'));
        } else {
          const errorData = await retryRes.json().catch(() => ({ detail: 'Неизвестная ошибка' }));
          alert(errorData.detail || t('floodModeling.failedToCreateLink'));
        }
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'Неизвестная ошибка' }));
        console.error('Failed to generate share hash:', res.status, errorData);
        alert(errorData.detail || t('floodModeling.failedToCreateLinkGeneral'));
      }
    } catch (err) {
      console.error('Error generating share hash:', err);
      alert(t('floodModeling.connectionError'));
    } finally {
      setLoadingShareLink(false);
    }
  };

  // Копирование ссылки
  const handleCopyLink = () => {
    if (!shareHash) return;
    const shareUrl = `${window.location.origin}/app/flood/shared/${shareHash}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Закрытие модального окна шаринга
  const handleCloseShare = () => {
    setOpenShare(false);
    setShareHash(null);
    setCopySuccess(false);
  };

  // Ref для отслеживания загрузки shared данных (чтобы избежать повторных загрузок)
  const sharedDataLoadedRef = useRef(false);
  const sharedHashRef = useRef(null);

  // Автоматическая загрузка данных из shared проекта
  useEffect(() => {
    if (!sharedProjectData || !propShareHash) return;
    
    // Проверяем, не загружали ли мы уже данные для этого shareHash
    if (sharedDataLoadedRef.current && sharedHashRef.current === propShareHash) {
      console.log('Данные для этого shareHash уже загружены, пропускаем повторную загрузку');
      return;
    }
    
    // Помечаем, что начинаем загрузку
    sharedDataLoadedRef.current = true;
    sharedHashRef.current = propShareHash;
    
    const loadSharedData = async () => {
      try {
        let { simulation_data, files } = sharedProjectData;
        
        // Парсим simulation_data если это строка JSON
        if (typeof simulation_data === 'string') {
          try {
            simulation_data = JSON.parse(simulation_data);
            console.log('Распарсен simulation_data из строки:', simulation_data);
          } catch (parseErr) {
            console.warn('Не удалось распарсить simulation_data:', parseErr);
            simulation_data = null;
          }
        }
        
        console.log('Данные shared проекта:', { 
          hasSimulationData: !!simulation_data, 
          hasWaterLevel: simulation_data?.hasWaterLevel,
          filesCount: files?.length || 0,
          simulationData: simulation_data 
        });
        
        // Применяем параметры симуляции
        if (simulation_data) {
          if (simulation_data.rainfallIntensity) setRainfallIntensity(simulation_data.rainfallIntensity);
          if (simulation_data.rainfallDuration) setRainfallDuration(simulation_data.rainfallDuration);
          if (simulation_data.rainfallMultiplier) setRainfallMultiplier(simulation_data.rainfallMultiplier);
          if (simulation_data.rainShape) setRainShape(simulation_data.rainShape);
          if (simulation_data.rainfallInputType) setRainfallInputType(simulation_data.rainfallInputType);
        }
        
        // Восстанавливаем состояние карты
        const restoreMapState = () => {
          const map = mapRef.current;
          if (!map || !map.loaded() || !map.isStyleLoaded()) return false;
          
          if (simulation_data && simulation_data.mapState) {
            const { center, zoom, pitch, bearing } = simulation_data.mapState;
            if (center && Array.isArray(center) && center.length === 2 && zoom !== undefined && !isNaN(zoom)) {
              map.flyTo({
                center: center,
                zoom: zoom,
                pitch: pitch !== undefined && !isNaN(pitch) ? pitch : 0,
                bearing: bearing !== undefined && !isNaN(bearing) ? bearing : 0,
                duration: 1000
              });
              return true;
            }
          }
          return false;
        };
        
        // Ждем готовности карты
        const waitForMapReady = () => {
          return new Promise((resolve) => {
            const checkMapReady = setInterval(() => {
              const map = mapRef.current;
              if (map && map.loaded() && map.isStyleLoaded()) {
                clearInterval(checkMapReady);
                resolve();
              }
            }, 100);
          });
        };
        
        // Загружаем файлы
        if (files && files.length > 0) {
          await waitForMapReady();
          await loadFiles();
        } else {
          // Если нет файлов, просто восстанавливаем состояние карты
          await waitForMapReady();
          restoreMapState();
        }
        
        async function loadFiles() {
          // Загружаем все файлы последовательно
          for (const fileInfo of files) {
            try {
              console.log(`Загрузка файла из shared проекта: ${fileInfo.original_filename || fileInfo.file_id}`);
              
              // Скачиваем файл
              const fileRes = await fetch(`/api/flood/shared/${propShareHash}/files/${fileInfo.file_id}/download`);
              if (!fileRes.ok) {
                console.error(`Не удалось загрузить файл ${fileInfo.file_id}:`, fileRes.status);
                continue;
              }
              
              const blob = await fileRes.blob();
              const file = new File([blob], fileInfo.original_filename || 'terrain.tif', { type: 'image/tiff' });
              
              // Загружаем файл на карту и ждем завершения
              console.log('Отображение файла на карте...');
              await handleDisplayGeoTIFF(file);
              
              // Небольшая задержка для завершения рендеринга
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              console.log('Файл успешно загружен и отображен');
            } catch (err) {
              console.error(`Ошибка при загрузке файла ${fileInfo.file_id}:`, err);
            }
          }
          
          // После загрузки всех файлов восстанавливаем состояние карты
          restoreMapState();
          
          // Если есть данные о симуляции, запускаем её после загрузки всех файлов
          if (simulation_data && simulation_data.hasWaterLevel) {
            console.log('Подготовка к запуску симуляции для восстановления слоя уровня воды...', {
              hasWaterLevel: simulation_data.hasWaterLevel,
              hasHandleSimulate: !!handleSimulate,
              params: {
                rainfallIntensity: simulation_data.rainfallIntensity,
                rainfallDuration: simulation_data.rainfallDuration,
                rainfallMultiplier: simulation_data.rainfallMultiplier,
                rainShape: simulation_data.rainShape
              }
            });
            
            // Функция для запуска симуляции с повторными попытками
            const runSimulation = async (attempt = 1, maxAttempts = 5) => {
              // Проверяем, что файл действительно загружен
              if (!geotiffLayerRef.current || !geotiffLayerRef.current.file) {
                if (attempt < maxAttempts) {
                  console.log(`Попытка ${attempt}: Геотiff файл еще не загружен, ждем...`);
                  setTimeout(() => runSimulation(attempt + 1, maxAttempts), 1000);
                } else {
                  console.warn('Геотiff файл не найден после всех попыток, симуляция не может быть запущена');
                }
                return;
              }
              
              console.log(`Попытка ${attempt}: Геотiff файл найден, запускаем симуляцию...`);
              
              try {
                // Передаем параметры напрямую из simulation_data, чтобы не зависеть от state
                const simParams = {
                  rainfallIntensity: simulation_data.rainfallIntensity,
                  rainfallDuration: simulation_data.rainfallDuration,
                  rainfallMultiplier: simulation_data.rainfallMultiplier,
                  rainShape: simulation_data.rainShape
                };
                
                console.log('Параметры симуляции:', simParams);
                
                // Используем ref вместо прямого вызова handleSimulate
                const simulateFn = handleSimulateRef.current;
                if (!simulateFn) {
                  console.error('handleSimulate не определен в ref');
                  return;
                }
                
                await simulateFn(simParams);
                console.log('✅ Симуляция успешно запущена и завершена');
              } catch (simErr) {
                console.error('❌ Ошибка при запуске симуляции:', simErr);
                if (attempt < maxAttempts) {
                  console.log(`Повторная попытка через 1 секунду...`);
                  setTimeout(() => runSimulation(attempt + 1, maxAttempts), 1000);
                }
              }
            };
            
            // Запускаем симуляцию с небольшой задержкой и повторными попытками
            setTimeout(() => {
              runSimulation();
            }, 2000);
          } else {
            console.log('Симуляция не требуется или данные отсутствуют', {
              hasSimulationData: !!simulation_data,
              hasWaterLevel: simulation_data?.hasWaterLevel,
              handleSimulate: !!handleSimulate
            });
          }
        }
      } catch (err) {
        console.error('Ошибка при загрузке shared данных:', err);
      }
    };
    
    loadSharedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedProjectData, propShareHash]);
  
  // Сброс флага загрузки при изменении shareHash
  useEffect(() => {
    if (propShareHash !== sharedHashRef.current) {
      sharedDataLoadedRef.current = false;
      sharedHashRef.current = null;
    }
  }, [propShareHash]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        mapId="flood-modeling-map"
        style={mapStyles.find(s => s.id === mapStyle)?.style || 'mapbox://styles/mapbox/satellite-streets-v12'}
        center={[82.6, 48.5]}
        zoom={6}
        pitch={0}
        bearing={0}
        projection={mapProjection}
        onMapReady={handleMapReady}
        disableAutoUpdate={true}
        mapOptions={{
          // Оптимизация для быстрой загрузки тайлов
          maxTileCacheSize: 50, // Увеличиваем кэш тайлов Mapbox
          refreshExpiredTiles: false, // Не обновляем истекшие тайлы для скорости
          fadeDuration: 0, // Отключаем fade для мгновенного отображения
        }}
      />
      
      {/* Панель инструментов карты */}
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >

        {/* Кнопки управления картой - скрыты в shared режиме */}
        {!propShareHash && (
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
              <ZoomInIcon />
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
              <ZoomOutIcon />
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
              <MyLocationIcon />
            </IconButton>
          </Tooltip>
        </Paper>
        )}
      </Box>
      
      {/* Выпадающие меню - скрыты в shared режиме */}
      {!propShareHash && (
      <Box
        ref={accordionContainerRef}
        sx={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          width: 280,
          maxHeight: 'calc(100vh - 240px)',
          overflowY: 'auto',
          overflowX: 'visible',
          boxSizing: 'border-box',
          paddingBottom: 2,
          marginBottom: 2,
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }}
        className="no-scrollbar"
      >
        {/* Аккордеон Elevation */}
        <Paper elevation={1} sx={{ margin: 0, borderRadius: 0, overflow: 'visible', '&:not(:last-child)': { marginBottom: 0 } }}>
          <Accordion
            data-accordion-id="elevation"
            expanded={expandedAccordion === 'elevation'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'elevation' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
              overflow: 'visible',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <TerrainIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.elevation')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, overflow: 'visible' }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, boxSizing: 'border-box', width: '100%' }}>
                {/* Секция выбора файла */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    p: 1.5,
                    backgroundColor: '#F5F5F5',
                    borderRadius: 1,
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                >
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    disabled={uploadingFile || terrainLayerId !== null}
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      minWidth: 0,
                      width: '100%',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                      '&.Mui-disabled': {
                        borderColor: '#E0E0E0',
                        color: '#9E9E9E',
                        backgroundColor: '#F5F5F5',
                      },
                      '& .MuiButton-label': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        textAlign: 'left',
                      },
                    }}
                  >
                    {uploadingFile 
                      ? t('common.loading')
                      : (uploadedFileName && terrainLayerId !== null && !selectedFile 
                          ? uploadedFileName 
                          : t('common.select'))}
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept=".tif,.tiff,.geotiff"
                      onChange={handleFileChange}
                      disabled={uploadingFile || terrainLayerId !== null}
                    />
                  </Button>
                  {uploadingFile && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mt: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" sx={{ color: '#424242', fontSize: '0.75rem' }}>
                        {t('common.loading')}
                      </Typography>
                    </Box>
                  )}
                  {selectedFile && !uploadingFile && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#424242',
                        flex: 1,
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mt: 1,
                      }}
                    >
                      {selectedFile.name}
                    </Typography>
                  )}
                  {downloadError && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {downloadError}
                    </Alert>
                  )}
                </Box>

                <Divider />

                {/* Кнопки действий */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, boxSizing: 'border-box', width: '100%' }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleAutoDownloadElevation}
                    sx={{
                      textTransform: 'none',
                      backgroundColor: terrainLayerId 
                        ? '#d32f2f' 
                        : (aoiActive ? '#4F46E5' : '#6366F1'),
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: terrainLayerId 
                        ? '0 4px 14px 0 rgba(211, 47, 47, 0.39)'
                        : '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                      fontWeight: 600,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      '&:hover': {
                        backgroundColor: terrainLayerId 
                          ? '#c62828' 
                          : (aoiActive ? '#4338CA' : '#4F46E5'),
                        boxShadow: terrainLayerId 
                          ? '0 6px 20px 0 rgba(211, 47, 47, 0.5)'
                          : '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
                      },
                    }}
                  >
                    {terrainLayerId 
                      ? t('floodModeling.elevation.removeTerrainLayer') 
                      : (aoiActive ? t('floodModeling.elevation.cancelSelection') : t('floodModeling.elevation.autoDownload'))}
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={!terrainLayerId}
                    onClick={() => setFiltersDialogOpen(true)}
                    sx={{
                      textTransform: 'none',
                      backgroundColor: terrainLayerId ? '#6366F1' : '#9e9e9e',
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: terrainLayerId ? '0 4px 14px 0 rgba(99, 102, 241, 0.39)' : 'none',
                      fontWeight: 600,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      '&:hover': {
                        backgroundColor: terrainLayerId ? '#4F46E5' : '#9e9e9e',
                        boxShadow: terrainLayerId ? '0 6px 20px 0 rgba(99, 102, 241, 0.5)' : 'none',
                      },
                      '&:disabled': {
                        backgroundColor: '#9e9e9e',
                        color: '#FFFFFF',
                      },
                    }}
                  >
                    {t('floodModeling.elevation.filters')}
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Land Cover */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="landCover"
            expanded={expandedAccordion === 'landCover'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'landCover' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <ParkIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.landCover')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Выбор типа ввода для Land Cover */}
                <FormControl component="fieldset">
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Select input for land cover:
                  </Typography>
                  <RadioGroup
                    value={landCoverInputType}
                    onChange={(e) => setLandCoverInputType(e.target.value)}
                  >
                    <FormControlLabel 
                      value="single" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.landCover.singleManning')} 
                    />
                    <FormControlLabel 
                      value="map" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.landCover.manningMap')} 
                    />
                    <FormControlLabel 
                      value="lu" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.landCover.landUseMap')} 
                    />
                  </RadioGroup>
                </FormControl>

                {/* Manning Value (для Single Mannings Coefficient) */}
                {landCoverInputType === 'single' && (
                  <Box>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      label={t('floodModeling.landCover.manningValue')}
                      value={manningValue}
                      onChange={(e) => setManningValue(e.target.value)}
                      inputProps={{ step: '0.01', min: '0' }}
                      sx={numericInputStyle}
                    />
                  </Box>
                )}

                {/* Input Manning values (для Manning Coefficient Map) */}
                {landCoverInputType === 'map' && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t('floodModeling.landCover.inputManningValues')}
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      fullWidth
                      sx={{
                        textTransform: 'none',
                        borderColor: '#E5E7EB',
                        color: '#424242',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '12px',
                        '&:hover': {
                          borderColor: '#6366F1',
                          backgroundColor: '#FFFFFF',
                        },
                      }}
                    >
                      {manningFile ? manningFile.name : t('common.select')}
                      <input
                        type="file"
                        hidden
                        accept=".tif,.tiff,.geotiff"
                        onChange={(e) => setManningFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                    {!manningFile && (
                      <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                        {t('common.fileNotSelected')}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Input LU classes (для Land Use Class Map) */}
                {landCoverInputType === 'lu' && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t('floodModeling.inputLuClasses')}
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      fullWidth
                      sx={{
                        textTransform: 'none',
                        borderColor: '#E5E7EB',
                        color: '#424242',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '12px',
                        '&:hover': {
                          borderColor: '#6366F1',
                          backgroundColor: '#FFFFFF',
                        },
                      }}
                    >
                      {luClassesFile ? luClassesFile.name : 'Выберите файл'}
                      <input
                        type="file"
                        hidden
                        accept=".tif,.tiff,.geotiff"
                        onChange={(e) => setLuClassesFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                    {!luClassesFile && (
                      <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                        {t('common.fileNotSelected')}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label="Multiplier"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={numericInputStyle}
                  />
                </Box>

                {/* Auto Download Button */}
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    // Проверяем наличие слоя рельефа или выделенной области
                    const hasTerrainLayer = geotiffLayerRef.current?.bounds || originalTerrainLayerRef.current?.bounds;
                    const hasAoiBounds = aoiBounds;
                    
                    if (!hasTerrainLayer && !hasAoiBounds) {
                      // Показываем ошибку в Alert, если нет ни слоя рельефа, ни выделенной области
                      setLandCoverDownloadError(t('floodModeling.landCover.loadTerrainFirst'));
                      setLandCoverDialogOpen(true);
                      return;
                    }
                    setLandCoverDialogOpen(true);
                    setLandCoverDownloadError(null);
                    setLandCoverDownloadProgress(0);
                  }}
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  {t('floodModeling.landCover.autoDownload')}
                </Button>

                {/* Таблица классов и коэффициентов Manning */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Manning Coefficient</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {manningCoefficients.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.class}</TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={row.coefficient}
                              onChange={(e) => {
                                const newCoefficients = [...manningCoefficients];
                                newCoefficients[index].coefficient = e.target.value;
                                setManningCoefficients(newCoefficients);
                              }}
                              inputProps={{ step: '0.01', min: '0', style: { width: '80px' } }}
                              sx={numericInputStyle}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Rainfall */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="rainfall"
            expanded={expandedAccordion === 'rainfall'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'rainfall' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <CloudQueueIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.rainfall')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Выбор типа ввода для Rainfall */}
                <FormControl component="fieldset">
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Select input for rainfall:
                  </Typography>
                  <RadioGroup
                    value={rainfallInputType}
                    onChange={(e) => setRainfallInputType(e.target.value)}
                  >
                    <FormControlLabel 
                      value="single" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.rainfall.singleIntensity')} 
                    />
                    <FormControlLabel 
                      value="map" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.rainfall.intensityMap')} 
                    />
                  </RadioGroup>
                </FormControl>

                {/* Rainfall Intensity (для Single Rainfall Intensity) */}
                {rainfallInputType === 'single' && (
                  <Box>
                    <TextField
                      type="number"
                      size="small"
                      label={t('floodModeling.rainfall.intensity')}
                      value={rainfallIntensity}
                      onChange={(e) => setRainfallIntensity(e.target.value)}
                      inputProps={{ step: '0.1', min: '0' }}
                      sx={{ width: '200px', ...numericInputStyle }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                              mm
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                )}

                {/* Rainfall Intensity map (для Rainfall Intensity map) */}
                {rainfallInputType === 'map' && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t('floodModeling.rainfall.inputIntensityMap')}
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      fullWidth
                      sx={{
                        textTransform: 'none',
                        borderColor: '#E5E7EB',
                        color: '#424242',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '12px',
                        '&:hover': {
                          borderColor: '#6366F1',
                          backgroundColor: '#FFFFFF',
                        },
                      }}
                    >
                      {rainfallFile ? rainfallFile.name : 'Выберите файл'}
                      <input
                        type="file"
                        hidden
                        accept=".tif,.tiff,.geotiff"
                        onChange={(e) => setRainfallFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                    {!rainfallFile && (
                      <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                        {t('common.fileNotSelected')}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Rainfall Multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={t('floodModeling.rainfall.multiplier')}
                    value={rainfallMultiplier}
                    onChange={(e) => setRainfallMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={numericInputStyle}
                  />
                </Box>

                {/* Rainfall Duration */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={t('floodModeling.rainfall.duration')}
                    value={rainfallDuration}
                    onChange={(e) => setRainfallDuration(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={numericInputStyle}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                            ч
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Rain Shape */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label="Rain Shape"
                    value={rainShape}
                    onChange={(e) => setRainShape(e.target.value)}
                    inputProps={{ step: '0.1', min: '0', max: '1' }}
                    sx={{ width: '200px', ...numericInputStyle, mb: 0.5 }}
                  />
                  <Typography variant="caption" sx={{ color: '#757575', display: 'block', mt: 0.5 }}>
                    (0=flat, 1=peaks)
                  </Typography>
                </Box>

                {/* Download Forecast Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  {t('floodModeling.rainfall.downloadForecast')}
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Infiltration */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="infiltration"
            expanded={expandedAccordion === 'infiltration'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'infiltration' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <SettingsIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.infiltration')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Include Infiltration Checkbox */}
                <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeInfiltration}
                          onChange={(e) => setIncludeInfiltration(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                  label={t('floodModeling.infiltration.include')}
                />

                {/* File Input */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('floodModeling.infiltration.inputFile')}
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {infiltrationFile ? infiltrationFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".tif,.tiff,.geotiff"
                      onChange={(e) => setInfiltrationFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!infiltrationFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                </Box>

                {/* Infiltration Multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.infiltration.multiplier')}
                    value={infiltrationMultiplier}
                    onChange={(e) => setInfiltrationMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                  />
                </Box>

                {/* Auto Download Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  {t('floodModeling.infiltration.autoDownload')}
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Soil Moisture */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="soilMoisture"
            expanded={expandedAccordion === 'soilMoisture'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'soilMoisture' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <WaterDropIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.soilMoisture')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Checkboxes */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeSoilMoisture}
                          onChange={(e) => setIncludeSoilMoisture(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label="Include Soil Moisture"
                  />
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={singleValue}
                          onChange={(e) => setSingleValue(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label={t('floodModeling.soilMoisture.singleValue')}
                  />
                </Box>

                {/* Effective Soil Moisture */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label="Effective Soil Moisture"
                    value={effectiveSoilMoisture}
                    onChange={(e) => setEffectiveSoilMoisture(e.target.value)}
                    inputProps={{ step: '0.1', min: '0', max: '1' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                  />
                </Box>

                {/* View Soil Moisture trends Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  View Soil Moisture trends
                  <Typography component="span" sx={{ fontSize: '0.7rem', color: '#FF9800', ml: 0.5 }}>
                    pro
                  </Typography>
                </Button>

                {/* File Input */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('floodModeling.soilMoisture.inputFile')}
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {soilMoistureFile ? soilMoistureFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".tif,.tiff,.geotiff"
                      onChange={(e) => setSoilMoistureFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!soilMoistureFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                </Box>

                {/* Soil Moisture Multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.soilMoisture.multiplier')}
                    value={soilMoistureMultiplier}
                    onChange={(e) => setSoilMoistureMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                  />
                </Box>

                {/* Average Soil Depth */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.soilMoisture.averageSoilDepth')}
                    value={averageSoilDepth}
                    onChange={(e) => setAverageSoilDepth(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                            м
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Xinajang Parameter */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.soilMoisture.xinajangParameter')}
                    value={xinajangParameter}
                    onChange={(e) => setXinajangParameter(e.target.value)}
                    inputProps={{ step: '0.01', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                  />
                </Box>

                {/* Average Daily Evapotranspiration */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.soilMoisture.averageDailyEvapotranspiration')}
                    value={averageDailyEvapotranspiration}
                    onChange={(e) => setAverageDailyEvapotranspiration(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                            мм/день
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Channels */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="channels"
            expanded={expandedAccordion === 'channels'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'channels' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <DeleteIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.channels')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Выбор типа ввода для Channels */}
                <FormControl component="fieldset">
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    {t('floodModeling.channels.selectInput')}
                  </Typography>
                  <RadioGroup
                    value={channelsInputType}
                    onChange={(e) => setChannelsInputType(e.target.value)}
                  >
                    <FormControlLabel 
                      value="none" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.channels.none')} 
                    />
                    <FormControlLabel 
                      value="automatic" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.channels.automatic')} 
                    />
                    <FormControlLabel 
                      value="map" 
                      control={<Radio size="small" sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }} />} 
                      label={t('floodModeling.channels.map')} 
                    />
                  </RadioGroup>
                </FormControl>

                {/* Channel Mannings Coefficient */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={t('floodModeling.channels.manningsCoefficient')}
                    value={channelManningsCoefficient}
                    onChange={(e) => setChannelManningsCoefficient(e.target.value)}
                    inputProps={{ step: '0.01', min: '0' }}
                    sx={numericInputStyle}
                  />
                </Box>

                {/* Exponential relationships for channel dimensions */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Exponential relationships for channel dimensions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      label="Width mult"
                      value={widthMult}
                      onChange={(e) => setWidthMult(e.target.value)}
                      inputProps={{ step: '0.01' }}
                      sx={{ width: '200px', ...numericInputStyle }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Width exp"
                      value={widthExp}
                      onChange={(e) => setWidthExp(e.target.value)}
                      inputProps={{ step: '0.01' }}
                      sx={{ width: '200px', ...numericInputStyle }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Depth mult"
                      value={depthMult}
                      onChange={(e) => setDepthMult(e.target.value)}
                      inputProps={{ step: '0.1' }}
                      sx={{ width: '200px', ...numericInputStyle }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Depth exp"
                      value={depthExp}
                      onChange={(e) => setDepthExp(e.target.value)}
                      inputProps={{ step: '0.01' }}
                      sx={{ width: '200px', ...numericInputStyle }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Min. Cross section"
                      value={minCrossSection}
                      onChange={(e) => setMinCrossSection(e.target.value)}
                      inputProps={{ step: '0.1', min: '0' }}
                      sx={{ width: '200px', ...numericInputStyle }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                              м²
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      backgroundColor: '#6366F1',
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: '#4F46E5',
                        boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
                      },
                    }}
                  >
                    Default channel relation
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      backgroundColor: '#6366F1',
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: '#4F46E5',
                        boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
                      },
                    }}
                  >
                    Auto-calibrate channels
                  </Button>
                </Box>

                {/* Channel Width File */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Channel Width (meters):
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {channelWidthFile ? channelWidthFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".tif,.tiff,.geotiff"
                      onChange={(e) => setChannelWidthFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!channelWidthFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                </Box>

                {/* Channel Depth File */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Channel Depth (meters):
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {channelDepthFile ? channelDepthFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".tif,.tiff,.geotiff"
                      onChange={(e) => setChannelDepthFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!channelDepthFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                </Box>

                {/* Multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label="Multiplier"
                    value={channelMultiplier}
                    onChange={(e) => setChannelMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                  />
                </Box>

                {/* Baseflow condition */}
                <Box>
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeBaseflow}
                          onChange={(e) => setIncludeBaseflow(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label="Include baseflow condition"
                  />
                  {includeBaseflow && (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        type="number"
                        size="small"
                        label="Baseflow"
                        value={baseflow}
                        onChange={(e) => setBaseflow(e.target.value)}
                        inputProps={{ step: '0.1', min: '0' }}
                        sx={{ width: '200px', ...numericInputStyle }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                                м³/с
                              </Typography>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Monodirectional channels */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, color: '#757575', fontSize: '0.75rem' }}>
                    {t('floodModeling.channels.monodirectionalDescription')}
                  </Typography>
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={monodirectionalChannels}
                          onChange={(e) => setMonodirectionalChannels(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label={t('floodModeling.channels.monodirectional')}
                  />
                  {monodirectionalChannels && (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        type="number"
                        size="small"
                        label="Drainage area (km2)"
                        value={drainageArea}
                        onChange={(e) => setDrainageArea(e.target.value)}
                        inputProps={{ step: '0.1', min: '0' }}
                        sx={{ width: '200px', ...numericInputStyle }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                                км²
                              </Typography>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Output options */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={outputChannelShape}
                          onChange={(e) => setOutputChannelShape(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label="Output channel shape (Overwrites!)"
                  />
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={useEditedChannelRoutes}
                          onChange={(e) => setUseEditedChannelRoutes(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label="Use edited channel routes"
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Coast */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="coast"
            expanded={expandedAccordion === 'coast'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'coast' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <WavesIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.coast')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Include ocean boundary condition Checkbox */}
                <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeOceanBoundary}
                          onChange={(e) => setIncludeOceanBoundary(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                  label={t('floodModeling.coast.includeOcean')}
                />

                {/* Ocean elevation */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={t('floodModeling.coast.oceanElevation')}
                    value={oceanElevation}
                    onChange={(e) => setOceanElevation(e.target.value)}
                    inputProps={{ step: '0.01' }}
                    sx={numericInputStyle}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                            м
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Download Design Event Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  <Box component="span">Download Design Event</Box>
                  <Typography component="span" sx={{ fontSize: '0.7rem', color: '#FFC107', mt: 0.5 }}>
                    pro
                  </Typography>
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Reservoir */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="reservoir"
            expanded={expandedAccordion === 'reservoir'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'reservoir' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <StorageIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.reservoir')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Reservoir capacity multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={t('floodModeling.reservoir.capacityMultiplier')}
                    value={reservoirCapacityMultiplier}
                    onChange={(e) => setReservoirCapacityMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={numericInputStyle}
                  />
                </Box>

                {/* Reservoir throughflow multiplier */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={t('floodModeling.reservoir.throughflowMultiplier')}
                    value={reservoirThroughflowMultiplier}
                    onChange={(e) => setReservoirThroughflowMultiplier(e.target.value)}
                    inputProps={{ step: '0.1', min: '0' }}
                    sx={numericInputStyle}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Upscaling */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="upscaling"
            expanded={expandedAccordion === 'upscaling'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'upscaling' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <GridOnIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.upscaling')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Explanatory Text */}
                <Typography variant="body2" sx={{ color: '#424242', fontSize: '0.875rem' }}>
                  {t('floodModeling.upscaling.activateWarning')}
                </Typography>

                {/* Input from other area */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={inputFromOtherArea}
                          onChange={(e) => setInputFromOtherArea(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label={t('floodModeling.upscaling.inputFromOtherArea')}
                  />
                  {inputFromOtherArea && (
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={otherAreaValue}
                        onChange={(e) => setOtherAreaValue(e.target.value)}
                        displayEmpty
                      >
                        <MenuItem value="1">1</MenuItem>
                        <MenuItem value="2">2</MenuItem>
                        <MenuItem value="3">3</MenuItem>
                        <MenuItem value="4">4</MenuItem>
                        <MenuItem value="5">5</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                </Box>

                {/* Input from file */}
                <FormControlLabel
                      control={
                        <Checkbox
                          checked={inputFromFile}
                          onChange={(e) => setInputFromFile(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                  label={t('floodModeling.upscaling.inputFromFile')}
                />

                {/* File Input */}
                {inputFromFile && (
                  <Box>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      fullWidth
                      sx={{
                        textTransform: 'none',
                        borderColor: '#E5E7EB',
                        color: '#424242',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '12px',
                        '&:hover': {
                          borderColor: '#6366F1',
                          backgroundColor: '#FFFFFF',
                        },
                      }}
                    >
                      {upscalingFile ? upscalingFile.name : t('common.select')}
                      <input
                        type="file"
                        hidden
                        accept=".tif,.tiff,.geotiff"
                        onChange={(e) => setUpscalingFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                    {!upscalingFile && (
                      <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                        {t('common.fileNotSelected')}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Iteration */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label="Iteration"
                    value={iteration}
                    onChange={(e) => setIteration(e.target.value)}
                    inputProps={{ step: '1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Viewer */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0 }}>
          <Accordion
            data-accordion-id="viewer"
            expanded={expandedAccordion === 'viewer'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'viewer' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <VisibilityIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.viewer')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Open3D Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  {t('floodModeling.viewer.open3d')}
                </Button>

                {/* DrawDetail */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('floodModeling.viewer.drawDetail')}
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={drawDetail}
                      onChange={(e) => setDrawDetail(e.target.value)}
                    >
                      <MenuItem value="Low">Low</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Max water height view */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.viewer.maxWaterHeight')}
                    value={maxWaterHeightView}
                    onChange={(e) => setMaxWaterHeightView(e.target.value)}
                    inputProps={{ step: '1', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                            м
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Information Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      backgroundColor: '#6366F1',
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: '#4F46E5',
                        boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
                      },
                    }}
                  >
                    {t('floodModeling.viewer.floodHistogram')}
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      backgroundColor: '#6366F1',
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: '#4F46E5',
                        boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
                      },
                    }}
                  >
                    {t('floodModeling.viewer.floodLuInfo')}
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      backgroundColor: '#6366F1',
                      color: '#FFFFFF',
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: '#4F46E5',
                        boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
                      },
                    }}
                  >
                    {t('floodModeling.viewer.hydrologyInfo')}
                  </Button>
                </Box>

                {/* Overlay Flood Extent */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('floodModeling.viewer.overlayFloodExtent')}
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {floodExtentFile ? floodExtentFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".json"
                      onChange={(e) => setFloodExtentFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!floodExtentFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="body2">
                      {t('floodModeling.viewer.floodExtentColor')}
                    </Typography>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: floodExtentColor,
                        border: '1px solid #BDBDBD',
                        borderRadius: 1,
                        cursor: 'pointer',
                      }}
                    />
                  </Box>
                </Box>

                {/* Download OSM Buildings/Roads */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  {t('floodModeling.viewer.osmBuildings')}
                </Button>

                {/* Import buildings */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('floodModeling.viewer.importBuildings')}
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {importBuildingsFile ? importBuildingsFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".json,.geojson"
                      onChange={(e) => setImportBuildingsFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!importBuildingsFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                </Box>

                {/* Import roads */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('floodModeling.viewer.importRoads')}
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {importRoadsFile ? importRoadsFile.name : 'Выберите файл'}
                    <input
                      type="file"
                      hidden
                      accept=".json,.geojson"
                      onChange={(e) => setImportRoadsFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!importRoadsFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      Файл не выбран
                    </Typography>
                  )}
                </Box>

                {/* Calculate Exposure */}
                <Box>
                  <FormControlLabel
                      control={
                        <Checkbox
                          checked={calculateExposure}
                          onChange={(e) => setCalculateExposure(e.target.checked)}
                          size="small"
                          sx={{ color: '#6366F1', '&.Mui-checked': { color: '#6366F1' } }}
                        />
                      }
                    label="Calculate Exposure"
                  />
                  {calculateExposure && (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        type="number"
                        size="small"
                        label={t('floodModeling.viewer.fullDamageHeight') + ' (м)'}
                        value={fullDamageHeight}
                        onChange={(e) => setFullDamageHeight(e.target.value)}
                        inputProps={{ step: '0.1', min: '0' }}
                        sx={{ width: '200px', ...numericInputStyle }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                                м
                              </Typography>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Clear Buildings/Roads Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  Clear Buildings/Roads
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Аккордеон Calibration */}
        <Paper elevation={1} sx={{ margin: 0, marginTop: 0, borderRadius: 0, overflow: 'hidden' }}>
          <Accordion
            data-accordion-id="calibration"
            expanded={expandedAccordion === 'calibration'}
            onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'calibration' : null)}
            sx={{
              boxShadow: 'none',
              margin: 0,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#F3F4F6',
                px: 2,
                py: 1,
                transition: 'background-color 0.2s ease',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                '&:not(.Mui-expanded)': {
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
                '&:hover': {
                  backgroundColor: '#E5E7EB',
                },
                '&.Mui-expanded': {
                  backgroundColor: '#E5E7EB',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
                '& .MuiAccordionSummary-content': {
                  margin: 0,
                  alignItems: 'center',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <GpsFixedIcon sx={{ color: '#6366F1', fontSize: 24 }} />
                <Typography sx={{ 
                  fontWeight: 500, 
                  color: '#424242',
                  noWrap: true,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                }}>
                  {t('floodModeling.accordions.calibration')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component="div"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Здесь можно добавить обработчик для информационной иконки
                  }}
                  sx={{ 
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18, color: '#757575' }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Descriptive Text */}
                <Typography variant="body2" sx={{ color: '#424242', fontSize: '0.875rem' }}>
                  {t('floodModeling.calibration.description')}
                </Typography>

                {/* File Input */}
                <Box>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      borderColor: '#BDBDBD',
                      color: '#424242',
                      backgroundColor: '#FFFFFF',
                      '&:hover': {
                        borderColor: '#9E9E9E',
                        backgroundColor: '#FAFAFA',
                      },
                    }}
                  >
                    {calibrationFile ? calibrationFile.name : t('common.select')}
                    <input
                      type="file"
                      hidden
                      accept=".tif,.tiff,.geotiff"
                      onChange={(e) => setCalibrationFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {!calibrationFile && (
                    <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
                      {t('common.fileNotSelected')}
                    </Typography>
                  )}
                </Box>

                {/* Flood depth threshold */}
                <Box>
                  <TextField
                    type="number"
                    size="small"
                    label={t('floodModeling.calibration.floodDepthThreshold')}
                    value={floodDepthThreshold}
                    onChange={(e) => setFloodDepthThreshold(e.target.value)}
                    inputProps={{ step: '0.01', min: '0' }}
                    sx={{ width: '200px', ...numericInputStyle }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="body2" sx={{ color: '#bdc1c6', fontSize: '14px' }}>
                            м
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Calculate Error Button */}
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#1976d2',
                    color: '#FFFFFF',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                  }}
                >
                  {t('floodModeling.calibration.calculateError')}
                </Button>

                {/* Status Message */}
                <Typography variant="body2" sx={{ color: '#424242' }}>
                  {t('floodModeling.calibration.currentError')} {currentError}
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Box>
      )}

      {/* Кнопки Simulate и Share - скрыты в shared режиме */}
      {!propShareHash && (
      <Box
        sx={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 1000,
          width: 250,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          fullWidth
          onClick={handleSimulate}
          sx={{
            textTransform: 'none',
            backgroundColor: '#6366F1',
            color: '#FFFFFF',
            py: 2,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: '12px',
            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
            '&:hover': {
              backgroundColor: '#4F46E5',
              boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
            },
          }}
        >
          {t('floodModeling.simulate.button')}
        </Button>
        <Button
          variant="outlined"
          fullWidth
          onClick={handleShareClick}
          startIcon={<ShareIcon />}
          sx={{
            textTransform: 'none',
            borderColor: '#6366F1',
            color: '#6366F1',
            backgroundColor: '#FFFFFF',
            py: 1.5,
            fontSize: '0.9rem',
            fontWeight: 500,
            borderRadius: '12px',
            '&:hover': {
              borderColor: '#4F46E5',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
            },
          }}
        >
          {t('floodModeling.share')}
        </Button>
      </Box>
      )}

      {/* Модальное окно для шаринга */}
      <Dialog open={openShare} onClose={handleCloseShare} maxWidth="sm" fullWidth>
        <DialogTitle>{t('floodModeling.shareTitle')}</DialogTitle>
        <DialogContent>
          {!shareHash ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                {t('floodModeling.shareDescription')}
              </Typography>
              <Button
                variant="contained"
                onClick={() => handleCreateLink(false)}
                disabled={loadingShareLink}
                sx={{ minWidth: '200px' }}
              >
                {loadingShareLink ? t('floodModeling.creating') : t('floodModeling.createLink')}
              </Button>
            </div>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('floodModeling.shareLink')}:
              </Typography>
              <TextField
                fullWidth
                value={`${window.location.origin}/app/flood/shared/${shareHash}`}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleCopyLink} edge="end">
                        <ContentCopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              {copySuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t('floodModeling.linkCopied')}
                </Alert>
              )}
              <Button
                variant="outlined"
                onClick={() => handleCreateLink(true)}
                disabled={loadingShareLink}
                fullWidth
                sx={{ mb: 2 }}
              >
                {loadingShareLink ? t('floodModeling.creating') : t('floodModeling.createNewLink')}
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShare}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог после завершения выделения */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('floodModeling.selectTerrainDataset')}
        </DialogTitle>
        <DialogContent>
          {aoiBounds && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('floodModeling.selectedAreaCoordinates')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>{t('floodModeling.west')}:</strong> {aoiBounds.west.toFixed(6)}°
                </Typography>
                <Typography variant="body2">
                  <strong>{t('floodModeling.south')}:</strong> {aoiBounds.south.toFixed(6)}°
                </Typography>
                <Typography variant="body2">
                  <strong>{t('floodModeling.east')}:</strong> {aoiBounds.east.toFixed(6)}°
                </Typography>
                <Typography variant="body2">
                  <strong>{t('floodModeling.north')}:</strong> {aoiBounds.north.toFixed(6)}°
                </Typography>
              </Box>
              <Divider />
              <Typography variant="body2">
                <strong>{t('floodModeling.approximateArea')}:</strong> {calculateArea(aoiBounds).toFixed(2)} {t('dashboard.km2').trim()}
              </Typography>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
                {t('floodModeling.selectCopernicusDataset')}
              </Typography>
              <List sx={{ 
                maxHeight: 300, 
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  display: 'none',
                },
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE and Edge
              }} className="no-scrollbar">
                {COPERNICUS_DATASETS.map((dataset) => (
                  <ListItem key={dataset.id} disablePadding>
                    <ListItemButton
                      selected={selectedDataset?.id === dataset.id}
                      onClick={() => handleDatasetSelect(dataset)}
                    >
                      <ListItemText
                        primary={dataset.name}
                        secondary={dataset.description}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              {downloadError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {downloadError}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={downloading}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleDownloadTerrain}
            variant="contained"
            disabled={!selectedDataset || downloading}
            startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
          >
            {downloading ? t('common.downloading') : t('common.download')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Компонент фильтров DEM */}
      <DEMFilters
        open={filtersDialogOpen}
        onClose={() => setFiltersDialogOpen(false)}
        onApplyFilter={handleApplyFilter}
        hasFilterHistory={hasFilterHistory}
        onUndo={handleUndo}
      />

      {/* Диалог загрузки данных WorldCover */}
      <Dialog
        open={landCoverDialogOpen}
        onClose={handleLandCoverDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            padding: '8px',
          }
        }}
      >
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {/* Кнопка Close вверху */}
          <Button
            onClick={handleLandCoverDialogClose}
            disabled={landCoverDownloading}
            variant="contained"
            sx={{
              textTransform: 'none',
              backgroundColor: '#42a5f5',
              color: '#FFFFFF',
              borderRadius: '8px',
              px: 3,
              py: 1,
              background: 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              },
              '&:disabled': {
                backgroundColor: '#bdbdbd',
                background: '#bdbdbd',
              },
            }}
          >
            {t('common.close')}
          </Button>

          {/* Основной текст */}
          <Typography variant="body1" sx={{ textAlign: 'center', color: '#000000' }}>
            {t('floodModeling.worldCoverDescription')}
          </Typography>

          {/* Кнопка Download */}
          <Button
            onClick={handleDownloadWorldCover}
            disabled={landCoverDownloading || (!geotiffLayerRef.current?.bounds && !originalTerrainLayerRef.current?.bounds && !aoiBounds)}
            variant="contained"
            sx={{
              textTransform: 'none',
              backgroundColor: '#42a5f5',
              color: '#FFFFFF',
              borderRadius: '8px',
              px: 3,
              py: 1,
              background: 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              },
              '&:disabled': {
                backgroundColor: '#bdbdbd',
                background: '#bdbdbd',
              },
            }}
            startIcon={landCoverDownloading ? <CircularProgress size={16} sx={{ color: '#FFFFFF' }} /> : <DownloadIcon />}
          >
            {landCoverDownloading ? t('common.downloading') : t('common.download')}
          </Button>

          {/* Прогресс-бар */}
          {landCoverDownloading && (
            <Box sx={{ width: '100%', mt: 1 }}>
              <LinearProgress 
                variant="determinate" 
                value={landCoverDownloadProgress} 
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          )}

          {/* Ошибка */}
          {landCoverDownloadError && (
            <Alert severity="error" sx={{ width: '100%', mt: 1 }}>
              {landCoverDownloadError}
            </Alert>
          )}

          {/* Ссылка Sources and Licences */}
          <Link
            href="https://worldcover.org/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: '#6366F1',
              textDecoration: 'underline',
              cursor: 'pointer',
              mt: 1,
              '&:hover': {
                color: '#4F46E5',
              },
            }}
          >
            Sources and Licences
          </Link>
        </DialogContent>
      </Dialog>

      {/* Старые диалоги фильтров удалены - теперь используется компонент DEMFilters */}
    </Box>
  );
}
