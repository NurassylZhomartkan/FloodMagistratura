// frontend/src/components/map/Map.jsx
// Базовый компонент карты Mapbox для изоляции карт между страницами

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, Typography, CircularProgress } from '@mui/material';

// Перехват ошибок теперь выполняется в utils/suppressMapboxErrors.js
// который импортируется в main.jsx до всех компонентов

// Общие настройки карты - экспортируются для использования в других компонентах
export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoibml4Y3JhenkiLCJhIjoiY20xOWxwMzl2MWpnYjJwc2I4YWJkY2hmbiJ9.rLShNyvzp7h-UwQKt-Y6eg';

// Устанавливаем токен глобально для Mapbox
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Общие настройки карты по умолчанию
export const DEFAULT_MAP_SETTINGS = {
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [82.6, 48.5],
  zoom: 6,
  pitch: 0,
  bearing: 0,
  projection: 'mercator',
  collectResourceTiming: false, // Отключаем телеметрию Mapbox
};

/**
 * Базовый компонент карты Mapbox
 * 
 * @param {Object} props - Пропсы компонента
 * @param {string} props.mapId - Уникальный идентификатор карты (для изоляции)
 * @param {string} props.style - Стиль карты (по умолчанию 'mapbox://styles/mapbox/satellite-streets-v12')
 * @param {Array} props.center - Центр карты [lng, lat] (по умолчанию [82.6, 48.5])
 * @param {number} props.zoom - Уровень масштаба (по умолчанию 6)
 * @param {number} props.pitch - Наклон карты (по умолчанию 0)
 * @param {number} props.bearing - Поворот карты (по умолчанию 0)
 * @param {string} props.projection - Проекция карты (по умолчанию 'mercator')
 * @param {Function} props.onMapReady - Callback при готовности карты (map) => void
 * @param {Function} props.transformRequest - Функция для трансформации запросов
 * @param {Object} props.mapOptions - Дополнительные опции для карты
 * @param {boolean} props.showLoadingSpinner - Показывать ли спиннер загрузки (по умолчанию true)
 * @param {string} props.loadingText - Текст для спиннера загрузки (по умолчанию 'Загрузка карты...')
 * @param {boolean} props.isLoading - Дополнительное состояние загрузки (показывать спиннер даже если карта загружена)
 * @param {React.Ref} ref - Ref для доступа к API карты
 */
const Map = forwardRef(({
  mapId = 'default-map',
  style = DEFAULT_MAP_SETTINGS.style,
  center = DEFAULT_MAP_SETTINGS.center,
  zoom = DEFAULT_MAP_SETTINGS.zoom,
  pitch = DEFAULT_MAP_SETTINGS.pitch,
  bearing = DEFAULT_MAP_SETTINGS.bearing,
  projection = DEFAULT_MAP_SETTINGS.projection,
  onMapReady,
  transformRequest,
  mapOptions = {},
  disableAutoUpdate = false, // Отключает автоматическое обновление позиции после ручного перемещения
  syncView = undefined, // НОВОЕ: принудительно включить/выключить синхронизацию view (по умолчанию зависит от disableAutoUpdate)
  showLoadingSpinner = true, // Показывать ли спиннер загрузки
  loadingText = 'Загрузка карты...', // Текст для спиннера
  isLoading = false, // Дополнительное состояние загрузки
  ...props
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapIdRef = useRef(mapId);
  const onMapReadyRef = useRef(onMapReady);
  const transformRequestRef = useRef(transformRequest);
  const projectionRef = useRef(projection);
  const userInteractedRef = useRef(false); // Флаг для отслеживания взаимодействия пользователя

  // Фикс: когда disableAutoUpdate=true — view считается "uncontrolled"
  // (иначе любые ре-рендеры страницы могут сбрасывать zoom/center после fitBounds)
  const shouldSyncView = (syncView !== undefined) ? syncView : !disableAutoUpdate;

  // Обновляем refs при изменении
  useEffect(() => {
    mapIdRef.current = mapId;
    onMapReadyRef.current = onMapReady;
    transformRequestRef.current = transformRequest;
    projectionRef.current = projection;
    // Сбрасываем флаг взаимодействия при смене карты
    userInteractedRef.current = false;
  }, [mapId, onMapReady, transformRequest, projection]);

  // Предоставляем API через ref
  useImperativeHandle(ref, () => ({
    getMap: () => mapInstanceRef.current,
    isLoaded: () => mapLoaded && mapInstanceRef.current?.loaded(),
    resize: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.resize();
      }
    },
    remove: () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    }
  }), [mapLoaded]);

  // Инициализация карты (только один раз)
  useEffect(() => {
    if (!mapContainerRef.current) {
      return () => {}; // Возвращаем пустую cleanup функцию
    }

    // Проверяем, что контейнер имеет размеры
    const checkContainerReady = () => {
      if (!mapContainerRef.current) return false;
      const rect = mapContainerRef.current.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    // Если карта уже существует для того же mapId, не пересоздаём её
    if (mapInstanceRef.current) {
      const existingMap = mapInstanceRef.current;
      if (existingMap._mapId === mapIdRef.current) {
        // Карта уже инициализирована для этого mapId - просто возвращаем cleanup
        return () => {
          // Cleanup будет выполнен только при размонтировании или смене mapId
          if (mapInstanceRef.current && mapInstanceRef.current._mapId === mapIdRef.current) {
            // Отключаем resizeObserver
            try {
              if (mapInstanceRef.current._resizeObserver) {
                mapInstanceRef.current._resizeObserver.disconnect();
              }
            } catch (e) {
              console.warn('Error disconnecting resizeObserver:', e);
            }

            // Удаляем карту
            try {
              mapInstanceRef.current.remove();
            } catch (e) {
              console.warn('Error removing map:', e);
            }
            
            mapInstanceRef.current = null;
            setMapLoaded(false);
          }
        };
      } else {
        // Карта существует для другого mapId - удаляем её
        try {
          existingMap.remove();
        } catch (e) {
          console.warn('Error removing old map:', e);
        }
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    }

    // Проверяем готовность контейнера
    if (!checkContainerReady()) {
      console.warn('Map: Container not ready (zero dimensions), retrying...');
      const retryInterval = setInterval(() => {
        if (checkContainerReady()) {
          clearInterval(retryInterval);
          // Перезапускаем эффект
          setTimeout(() => {
            if (mapContainerRef.current && !mapInstanceRef.current) {
              // Эффект перезапустится автоматически
            }
          }, 100);
        }
      }, 200);
      
      return () => clearInterval(retryInterval);
    }

    // Создаем новую карту
    let map;
    try {
      const defaultTransformRequest = (url) => {
        // Подавляем запросы к events.mapbox.com (блокируются расширениями браузера)
        if (url && url.includes('events.mapbox.com')) {
          // Возвращаем null для полной отмены запроса
          return null;
        }
        
        // Добавляем авторизацию для запросов к нашему API
        if (url && url.includes('/api/')) {
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
      };

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style,
        center,
        zoom,
        pitch,
        bearing,
        projection: projection || DEFAULT_MAP_SETTINGS.projection,
        transformRequest: transformRequestRef.current || defaultTransformRequest,
        collectResourceTiming: DEFAULT_MAP_SETTINGS.collectResourceTiming,
        // Настройки кэширования для тайлов
        maxTileCacheSize: mapOptions.maxTileCacheSize || 50, // Кэш для тайлов Mapbox
        refreshExpiredTiles: mapOptions.refreshExpiredTiles !== undefined ? mapOptions.refreshExpiredTiles : false,
        fadeDuration: mapOptions.fadeDuration !== undefined ? mapOptions.fadeDuration : 0,
        ...mapOptions
      });

      // Сохраняем mapId в объекте карты для идентификации
      map._mapId = mapIdRef.current;

      // Реальное пользовательское взаимодействие помечаем через originalEvent
      // (программные движения fitBounds/jumpTo обычно без originalEvent)
      const markUserInteraction = (e) => {
        if (e?.originalEvent) userInteractedRef.current = true;
      };
      map.on('dragstart', markUserInteraction);
      map.on('zoomstart', markUserInteraction);
      map.on('rotatestart', markUserInteraction);
      map.on('pitchstart', markUserInteraction);

      // Обработчик загрузки карты
      let mapLoadHandled = false;
      map.on('load', () => {
        if (mapLoadHandled) {
          return;
        }
        mapLoadHandled = true;
        setMapLoaded(true);
        mapInstanceRef.current = map;

        // Применяем проекцию после load (без пересоздания карты)
        if (projectionRef.current) {
          try {
            map.setProjection(projectionRef.current);
          } catch (e) {
            console.warn('Error setting projection on load:', e);
          }
        }

        if (onMapReadyRef.current) {
          onMapReadyRef.current(map);
        }
      });

      // Обработка ошибок - подавляем ошибки от events.mapbox.com (блокируются расширениями браузера)
      map.on('error', (e) => {
        // Подавляем ошибки от events.mapbox.com (ERR_BLOCKED_BY_CLIENT)
        if (e.error) {
          const errorMessage = e.error.message || e.error.toString() || '';
          if (errorMessage.includes('ERR_BLOCKED_BY_CLIENT') || 
              errorMessage.includes('events.mapbox.com') ||
              errorMessage.includes('Failed to fetch') ||
              errorMessage.includes('errorCb') ||
              errorMessage.includes('Could not establish connection') ||
              errorMessage.includes('Receiving end does not exist') ||
              errorMessage.includes('chrome-extension://') ||
              errorMessage.includes('Extension context invalidated') ||
              errorMessage.includes('message port closed')) {
            return; // Игнорируем эти ошибки
          }
        }
        // Подавляем ошибки, связанные с errorCb
        if (e.error && typeof e.error === 'object' && !e.error.message) {
          return; // Игнорируем ошибки без сообщения
        }
        // Подавляем ошибки типа "this.errorCb is not a function"
        if (e.error && (e.error.stack || '').includes('errorCb')) {
          return;
        }
        // Логируем только безопасные поля, не весь объект e
        const msg = e?.error?.message || e?.message || 'Mapbox error';
        const status = e?.error?.status || e?.status;
        const url = e?.error?.url || e?.url;
        console.error(`Map: Error in map ${mapIdRef.current}:`, { msg, status, url });
      });


      // Обновление размера при изменении контейнера
      const resizeObserver = new ResizeObserver(() => {
        if (map && map.isStyleLoaded()) {
          try {
            map.resize();
          } catch (e) {
            console.warn('Error resizing map:', e);
          }
        }
      });

      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
        map._resizeObserver = resizeObserver;
      }

      mapInstanceRef.current = map;

    } catch (error) {
      console.error(`Map: Error creating map for ${mapIdRef.current}:`, error);
      // Возвращаем пустую cleanup функцию даже при ошибке
      return () => {};
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current && mapInstanceRef.current._mapId === mapIdRef.current) {
        // Отключаем resizeObserver
        try {
          if (mapInstanceRef.current._resizeObserver) {
            mapInstanceRef.current._resizeObserver.disconnect();
          }
        } catch (e) {
          console.warn('Error disconnecting resizeObserver:', e);
        }

        // Удаляем карту
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    };
    // ВАЖНО: projection убрали из deps, чтобы не пересоздавать карту при смене проекции
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, style]);

  // Функция для применения проекции к карте
  const applyProjection = useCallback((newProjection) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    
    const map = mapInstanceRef.current;
    if (!map.loaded() || map._mapId !== mapIdRef.current) return;

    if (newProjection) {
      try {
        const currentProj = map.getProjection();
        // getProjection() возвращает объект или строку в зависимости от версии
        let currentProjName;
        if (typeof currentProj === 'string') {
          currentProjName = currentProj;
        } else if (currentProj && typeof currentProj === 'object' && currentProj.name) {
          currentProjName = currentProj.name;
        } else {
          currentProjName = 'mercator'; // значение по умолчанию
        }
        
        if (currentProjName !== newProjection) {
          console.log('Updating map projection from', currentProjName, 'to', newProjection);
          map.setProjection(newProjection);
          projectionRef.current = newProjection;
        }
      } catch (e) {
        console.warn('Error updating map projection:', e);
      }
    }
  }, [mapLoaded]);

  // Обновление проекции отдельно, так как она не должна зависеть от disableAutoUpdate
  useEffect(() => {
    applyProjection(projection);
  }, [mapLoaded, mapId, projection, applyProjection]);

  // Слушатель mapSettingsUpdated оставляем как есть (он не трогает zoom/center)
  useEffect(() => {
    const handleMapSettingsUpdate = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/auth/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          if (userData.default_map_projection && mapInstanceRef.current?.loaded()) {
            try {
              const map = mapInstanceRef.current;
              const currentProj = map.getProjection();
              const currentName =
                typeof currentProj === 'string' ? currentProj :
                (currentProj && typeof currentProj === 'object' && currentProj.name) ? currentProj.name :
                'mercator';

              if (currentName !== userData.default_map_projection) {
                map.setProjection(userData.default_map_projection);
                projectionRef.current = userData.default_map_projection;
              }
            } catch (e) {
              console.error('Error setting projection directly:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user map settings in Map component:', error);
      }
    };

    window.addEventListener('mapSettingsUpdated', handleMapSettingsUpdate);
    return () => window.removeEventListener('mapSettingsUpdated', handleMapSettingsUpdate);
  }, []);

  // КРИТИЧЕСКИЙ ФИКС:
  // Если shouldSyncView=false (обычно при disableAutoUpdate=true), НЕ синхронизируем center/zoom/pitch/bearing с props
  // чтобы ре-рендеры страницы (меню/диалоги) не сбрасывали вид после fitBounds.
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const map = mapInstanceRef.current;
    if (!map.loaded() || map._mapId !== mapIdRef.current) return;

    // полностью отключаем синхронизацию view с props
    if (!shouldSyncView) return;

    // если включен disableAutoUpdate и пользователь уже реально взаимодействовал — не трогаем view
    if (disableAutoUpdate && userInteractedRef.current) return;

    try {
      const centerTolerance = 0.0001;
      const currentCenter = map.getCenter();
      const centerChanged =
        Math.abs(currentCenter.lng - center[0]) > centerTolerance ||
        Math.abs(currentCenter.lat - center[1]) > centerTolerance;

      if (centerChanged) map.setCenter(center);

      const zoomTolerance = 0.01;
      const currentZoom = map.getZoom();
      if (Math.abs(currentZoom - zoom) > zoomTolerance) map.setZoom(zoom);

      const pitchTolerance = 0.1;
      const currentPitch = map.getPitch();
      if (Math.abs(currentPitch - pitch) > pitchTolerance) map.setPitch(pitch);

      const bearingTolerance = 0.1;
      const currentBearing = map.getBearing();
      if (Math.abs(currentBearing - bearing) > bearingTolerance) map.setBearing(bearing);
    } catch (e) {
      console.warn('Error updating map parameters:', e);
    }
  }, [mapLoaded, mapId, center, zoom, pitch, bearing, disableAutoUpdate, shouldSyncView]);

  return (
    <div
      ref={mapContainerRef}
      data-map-id={mapId}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        ...props.style
      }}
      {...props}
    />
  );
});

Map.displayName = 'Map';

export default Map;

