// frontend/src/pages/TerrainMap.jsx
// Страница с картой, рельефом и 3D моделями (использует threebox)

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import {
  Box,
  Typography,
  Alert,
  Paper,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
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
import CircularProgress from '@mui/material/CircularProgress';

import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../utils/usePageTitle';
import MapComponent from '../components/map/Map';
import { MAPBOX_ACCESS_TOKEN } from '../components/map/Map';
import BaseModal from '../components/BaseModal';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltipPlugin,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, ChartTooltipPlugin, Legend);

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

export default function TerrainMap() {
  const { t } = useTranslation();

  const mapComponentRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [stationsData, setStationsData] = useState(null);
  const [categoryVisibility, setCategoryVisibility] = useState({
    1: true,
    2: true,
    3: true,
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Hydro history modal (category 2)
  const [hydroModalOpen, setHydroModalOpen] = useState(false);
  const [hydroModalStationId, setHydroModalStationId] = useState('');
  const [hydroModalStationName, setHydroModalStationName] = useState('');
  const [hydroModalLoading, setHydroModalLoading] = useState(false);
  const [hydroModalError, setHydroModalError] = useState(null);
  const [hydroModalHistory, setHydroModalHistory] = useState(null);
  const [hydroModalMetric, setHydroModalMetric] = useState('level');

  const markersRef = useRef([]);
  const popupsRef = useRef([]);

  // refs для актуальных данных внутри custom layer
  const stationsDataRef = useRef(null);
  const categoryVisibilityRef = useRef(categoryVisibility);

  useEffect(() => {
    stationsDataRef.current = stationsData;
  }, [stationsData]);

  useEffect(() => {
    categoryVisibilityRef.current = categoryVisibility;
  }, [categoryVisibility]);

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

  function formatDDMMYYYY(iso) {
    if (!iso) return '';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }

  const openHydroModal = useCallback((stationCode, stationName) => {
    const sid = String(stationCode || '').trim();
    if (!sid) return;
    setHydroModalStationId(sid);
    setHydroModalStationName(stationName || sid);
    setHydroModalError(null);
    setHydroModalHistory(null);
    setHydroModalMetric('level');
    setHydroModalOpen(true);
  }, []);

  useEffect(() => {
    if (!hydroModalOpen || !hydroModalStationId) return;

    const load = async () => {
      setHydroModalLoading(true);
      setHydroModalError(null);
      try {
        const token = localStorage.getItem('token');
        const todayIso = new Date().toISOString().slice(0, 10);
        const params = new URLSearchParams({
          station_id: hydroModalStationId,
          metric: hydroModalMetric,
          date_from: '2020-01-01',
          date_to: todayIso,
        });
        const res = await fetch(`/api/hydro-stations/history?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!j?.ok) throw new Error(j?.error || 'no_data');
        setHydroModalHistory(j);
      } catch (e) {
        setHydroModalError(e?.message || t('databasePage.error'));
      } finally {
        setHydroModalLoading(false);
      }
    };

    load();
  }, [hydroModalMetric, hydroModalOpen, hydroModalStationId, t]);

  const hydroModalLineData = useMemo(() => {
    const series =
      hydroModalMetric === 'discharge'
        ? hydroModalHistory?.discharges || []
        : hydroModalHistory?.levels || [];
    if (!series.length) return null;
    const byDate = new Map(series.map((r) => [r.date, r]));
    const labels = [...byDate.keys()].sort();
    if (hydroModalMetric === 'discharge') {
      return {
        labels,
        datasets: [
          {
            label: 'Расход воды, м3/с',
            data: labels.map((d) => byDate.get(d)?.discharge ?? null),
            borderColor: '#1E63CC',
            backgroundColor: 'rgba(30, 99, 204, 0.14)',
            pointRadius: 2,
            tension: 0.25,
          },
        ],
      };
    }
    return {
      labels,
      datasets: [
        {
          label: 'Факт. уровень, см',
          data: labels.map((d) => byDate.get(d)?.actual_level ?? null),
          borderColor: 'rgba(0, 119, 182, 0.95)',
          backgroundColor: 'rgba(0, 119, 182, 0.15)',
          pointRadius: 2,
          tension: 0.25,
        },
        {
          label: 'Опасный уровень, см',
          data: labels.map((d) => byDate.get(d)?.danger_level ?? null),
          borderColor: 'rgba(220, 38, 38, 0.95)',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          pointRadius: 0,
          borderDash: [6, 4],
          tension: 0,
        },
      ],
    };
  }, [hydroModalHistory, hydroModalMetric]);

  const hydroModalLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            title: (items) =>
              items?.[0]?.label ? formatDDMMYYYY(items[0].label) : '',
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(148,163,184,0.12)' },
          ticks: {
            maxTicksLimit: 8,
            callback: (_, idx) => {
              const lbl = hydroModalLineData?.labels?.[idx];
              return lbl ? formatDDMMYYYY(lbl) : '';
            },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: hydroModalMetric === 'discharge' ? 'Расход (м3/с)' : 'Уровень (см)',
          },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
      },
    }),
    [hydroModalLineData, hydroModalMetric]
  );

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

  }, [t, toggleSidebar]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      // маркеры/попапы
      markersRef.current.forEach((marker) => marker.remove());
      popupsRef.current.forEach((popup) => popup.remove());
      markersRef.current = [];
      popupsRef.current = [];

      const map = mapInstanceRef.current;
      if (map) {
        try { if (map.getLayer('hillshade')) map.removeLayer('hillshade'); } catch {}
        try { if (map.getLayer('sky')) map.removeLayer('sky'); } catch {}
        try { if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem'); } catch {}
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

          // Hydro post -> open modal with chart
          if (categoryId === 2) {
            openHydroModal(site.code, site.name);
          }
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
          transition: 'none',
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
                backgroundColor: 'rgba(0, 119, 182, 0.1)',
                color: 'primary.main',
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

                    return (
                      <ListItem key={stationKey} disablePadding>
                        <ListItemButton
                          onClick={() => {
                            flyToStation(station.longtitude, station.latitude);
                            if (station.categoryId === 2) {
                              openHydroModal(station.code, station.name);
                            }
                          }}
                          sx={{
                            borderRadius: 1,
                            mb: 0.5,
                            '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.08)' },
                          }}
                        >
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

      <BaseModal
        open={hydroModalOpen}
        onClose={() => setHydroModalOpen(false)}
        title={`Гидропост: ${hydroModalStationName}`}
        maxWidth="lg"
      >
        <Box sx={{ minHeight: 320 }}>
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={hydroModalMetric}
              exclusive
              size="small"
              onChange={(_, nextValue) => {
                if (nextValue) setHydroModalMetric(nextValue);
              }}
              aria-label="Выбор параметра гидропоста"
            >
              <ToggleButton value="level">Уровень воды</ToggleButton>
              <ToggleButton value="discharge">Расход воды</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {hydroModalLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
              <CircularProgress size={32} sx={{ color: '#0077B6' }} />
            </Box>
          )}
          {!hydroModalLoading && hydroModalError && (
            <Alert severity="error">{hydroModalError}</Alert>
          )}
          {!hydroModalLoading && !hydroModalError && hydroModalLineData && (
            <Box sx={{ height: 340 }}>
              <Line data={hydroModalLineData} options={hydroModalLineOptions} />
            </Box>
          )}
          {!hydroModalLoading && !hydroModalError && !hydroModalLineData && (
            <Typography variant="caption" color="text.secondary">
              Нет данных для выбранного гидропоста
            </Typography>
          )}
        </Box>
      </BaseModal>
    </Box>
  );
}
