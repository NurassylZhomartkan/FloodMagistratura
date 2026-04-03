import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Typography, CircularProgress, Alert, GlobalStyles, LinearProgress,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import WbSunnyIcon      from '@mui/icons-material/WbSunny';
import CloudIcon        from '@mui/icons-material/Cloud';
import AirIcon          from '@mui/icons-material/Air';
import WaterDropIcon    from '@mui/icons-material/WaterDrop';
import AcUnitIcon       from '@mui/icons-material/AcUnit';
import LocationOnIcon   from '@mui/icons-material/LocationOn';
import CompressIcon     from '@mui/icons-material/Compress';
import ThermostatIcon   from '@mui/icons-material/Thermostat';
import OpacityIcon      from '@mui/icons-material/Opacity';
import { useTranslation } from 'react-i18next';
import { usePageTitle }   from '../utils/usePageTitle';
import PageContainer      from '../components/layout/PageContainer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Filler,
  Legend,
);

/* ─── Gradient plugin for Chart.js ─────────────────────── */
const gradientPlugin = {
  id: 'gradFill',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    chart.data.datasets.forEach((ds) => {
      if (!ds._useGrad) return;
      const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      g.addColorStop(0, ds._gradTop    ?? 'rgba(0,119,182,0.35)');
      g.addColorStop(1, ds._gradBottom ?? 'rgba(0,119,182,0.0)');
      ds.backgroundColor = g;
    });
  },
};
if (!ChartJS.registry.plugins.get('gradFill')) ChartJS.register(gradientPlugin);

/* ─── Constants ─────────────────────────────────────────── */
const COORDS = { latitude: 49.948, longitude: 82.6167 };
const CURRENT_VARS = [
  'temperature_2m','relative_humidity_2m','apparent_temperature',
  'is_day','precipitation','rain','cloud_cover','surface_pressure',
  'wind_speed_10m','wind_direction_10m','wind_gusts_10m',
].join(',');

/* ─── Helpers ───────────────────────────────────────────── */
function fmt24(v) {
  if (v == null) return '—';
  const d = (typeof v === 'number' && v > 1e9) ? new Date(v * 1000) : new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtHour(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getWindDir(deg) {
  if (deg == null) return '—';
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return d[Math.round(deg / 22.5) % 16];
}

function getCondition(cloud = 0, precip = 0) {
  if (precip > 2) return 'heavyRain';
  if (precip > 0) return 'rain';
  if (cloud > 80) return 'overcast';
  if (cloud > 50) return 'mostlyCloudy';
  if (cloud > 20) return 'partlyCloudy';
  return 'sunny';
}

function getDayCondition(day) {
  const sum = day.precipitation_sum ?? 0;
  if (sum > 5) return 'heavyRain';
  if (sum > 0.5) return 'rain';
  if ((day.temperature_2m_min ?? 0) < -5) return 'snow';
  if ((day.temperature_2m_max ?? 20) > 26) return 'sunny';
  return 'partlyCloudy';
}

function cvtT(c, unit) {
  if (c == null) return null;
  return unit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c);
}

/* ─── useCountUp ────────────────────────────────────────── */
function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(target ?? 0);
  const frame = useRef(null);
  useEffect(() => {
    if (target == null || isNaN(Number(target))) return;
    const end = Number(target);
    const from = 0;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / duration, 1);
      const ease = 1 - (1 - p) ** 3;
      setVal(Math.round(from + (end - from) * ease));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);
  return val;
}

/* ─── Animated Weather Icon ─────────────────────────────── */
function WeatherIcon({ condition, size = 80 }) {
  if (condition === 'sunny') {
    return (
      <WbSunnyIcon sx={{
        fontSize: size, color: '#FBBF24', display: 'block', mx: 'auto',
        animation: 'wxRotate 20s linear infinite, wxPulse 3s ease-in-out infinite',
      }} />
    );
  }
  if (condition === 'rain' || condition === 'heavyRain') {
    const drops = condition === 'heavyRain' ? 4 : 3;
    return (
      <Box sx={{ position: 'relative', width: size * 1.1, height: size * 1.15, mx: 'auto' }}>
        <CloudIcon sx={{
          fontSize: size, color: '#94A3B8',
          animation: 'wxCloud 4s ease-in-out infinite',
        }} />
        <Box sx={{ position: 'absolute', bottom: 0, left: '15%', display: 'flex', gap: '5px' }}>
          {Array.from({ length: drops }).map((_, i) => (
            <Box key={i} sx={{
              width: 3, height: size * 0.22, bgcolor: '#60A5FA', borderRadius: 2,
              animation: 'wxRain 1.1s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </Box>
      </Box>
    );
  }
  if (condition === 'snow') {
    return (
      <Box sx={{ position: 'relative', width: size * 1.1, height: size * 1.15, mx: 'auto' }}>
        <CloudIcon sx={{ fontSize: size, color: '#CBD5E1', animation: 'wxCloud 4s ease-in-out infinite' }} />
        <Box sx={{ position: 'absolute', bottom: 0, left: '20%', display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map(i => (
            <AcUnitIcon key={i} sx={{
              fontSize: size * 0.2, color: '#93C5FD',
              animation: 'wxSnow 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.25}s`,
            }} />
          ))}
        </Box>
      </Box>
    );
  }
  if (condition === 'overcast') {
    return (
      <CloudIcon sx={{
        fontSize: size, color: '#94A3B8', display: 'block', mx: 'auto',
        animation: 'wxCloud 5s ease-in-out infinite',
      }} />
    );
  }
  // partlyCloudy / mostlyCloudy
  return (
    <Box sx={{ position: 'relative', width: size * 1.35, height: size, mx: 'auto' }}>
      <WbSunnyIcon sx={{
        fontSize: size * 0.82, color: '#FBBF24', position: 'absolute', top: 0, left: 0,
        animation: 'wxPulse 3s ease-in-out infinite',
      }} />
      <CloudIcon sx={{
        fontSize: size * 0.72, color: '#CBD5E1', position: 'absolute', bottom: 0, right: 0,
        animation: 'wxCloud 3.5s ease-in-out infinite',
      }} />
    </Box>
  );
}

/* ─── Metric Card ───────────────────────────────────────── */
function MCard({ title, delay = 0, children, accent = '#0077B6' }) {
  return (
    <Box sx={{
      bgcolor: '#fff', borderRadius: '16px', p: 2.5,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      borderTop: `3px solid ${accent}`,
      animation: 'wxFadeUp 0.5s ease both',
      animationDelay: `${delay}ms`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 18px rgba(0,0,0,0.1)' },
    }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/* ─── Day Forecast Card ─────────────────────────────────── */
function DayCard({ day, unit, delay, t, isToday, locale }) {
  const d = new Date(day.date + 'T12:00:00');
  const dayName = d.toLocaleDateString(locale, { weekday: 'short' });
  const cond = getDayCondition(day);
  const iconProps = { fontSize: 26 };

  return (
    <Box sx={{
      flex: 1, textAlign: 'center',
      bgcolor: isToday ? 'rgba(0,119,182,0.06)' : '#fff',
      border: isToday ? '1.5px solid rgba(0,119,182,0.25)' : '1.5px solid #F3F4F6',
      borderRadius: '14px', py: 1.5, px: 0.5,
      animation: 'wxFadeUp 0.4s ease both',
      animationDelay: `${delay}ms`,
      transition: 'all 0.2s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 6px 16px rgba(0,0,0,0.09)' },
    }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: isToday ? '#0077B6' : '#6B7280', mb: 0.75 }}>
        {isToday ? t('weather.today') : dayName}
      </Typography>
      <Box sx={{ height: 34, display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 0.75 }}>
        {cond === 'sunny'    && <WbSunnyIcon   sx={{ ...iconProps, color: '#FBBF24' }} />}
        {(cond === 'rain' || cond === 'heavyRain') && <WaterDropIcon sx={{ ...iconProps, color: '#3B82F6' }} />}
        {cond === 'snow'     && <AcUnitIcon    sx={{ ...iconProps, color: '#60A5FA' }} />}
        {(cond === 'partlyCloudy' || cond === 'overcast' || cond === 'mostlyCloudy') && <CloudIcon sx={{ ...iconProps, color: '#9CA3AF' }} />}
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
        {cvtT(day.temperature_2m_max, unit) ?? '—'}°
      </Typography>
      <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.25 }}>
        {cvtT(day.temperature_2m_min, unit) ?? '—'}°
      </Typography>
      {(day.precipitation_sum ?? 0) > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
          <WaterDropIcon sx={{ fontSize: 10, color: '#60A5FA' }} />
          <Typography sx={{ fontSize: 10, color: '#60A5FA', fontWeight: 600 }}>
            {day.precipitation_sum.toFixed(1)}{t('weather.mm')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
export default function Weather() {
  const { t, i18n } = useTranslation();
  usePageTitle('pageTitles.weather');

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [unit, setUnit]     = useState('C');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const p = new URLSearchParams({
          latitude:  COORDS.latitude,
          longitude: COORDS.longitude,
          forecast_days: 7,
          past_days: 0,
          current: CURRENT_VARS,
        });
        const r = await fetch(`/api/open-meteo/forecast?${p}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cur   = data?.current  ?? {};
  const daily = data?.daily    ?? [];
  const hourly = data?.hourly  ?? [];

  /* Next 24 hourly entries starting from now */
  const next24 = useMemo(() => {
    if (!hourly.length) return [];
    const now = Date.now();
    let idx = 0;
    let minDiff = Infinity;
    hourly.forEach((h, i) => {
      const d = Math.abs(new Date(h.time).getTime() - now);
      if (d < minDiff) { minDiff = d; idx = i; }
    });
    return hourly.slice(idx, idx + 25);
  }, [hourly]);

  const today0 = daily[0] ?? {};
  const condition = useMemo(() => getCondition(cur.cloud_cover, cur.precipitation), [cur]);

  /* Animated temperature counter */
  const tempDisplay = useCountUp(cur.temperature_2m != null ? cvtT(cur.temperature_2m, unit) : 0, 900);

  /* Chart data */
  const chartLabels = useMemo(() => next24.map(h => fmtHour(h.time)), [next24]);
  const tempData    = useMemo(() => next24.map(h => h.temperature_2m), [next24]);
  const precipData  = useMemo(() => next24.map(h => h.precipitation_probability ?? 0), [next24]);

  const chartData = useMemo(() => ({
    labels: chartLabels,
    datasets: [
      {
        label: t('weather.temperature'),
        data: tempData,
        borderColor: '#0077B6',
        borderWidth: 2,
        fill: true,
        _useGrad: true,
        _gradTop:    'rgba(0,119,182,0.3)',
        _gradBottom: 'rgba(0,119,182,0)',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#0077B6',
        yAxisID: 'yTemp',
      },
      {
        label: t('weather.precipProbability'),
        data: precipData,
        type: 'bar',
        backgroundColor: 'rgba(96,165,250,0.25)',
        borderRadius: 3,
        yAxisID: 'yPrecip',
      },
    ],
  }), [chartLabels, tempData, precipData, t]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex === 0)
              return ` ${ctx.raw}°${unit}`;
            return ` ${ctx.raw}% ${t('weather.precipProbabilityShort')}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 9, font: { size: 11 }, color: '#9CA3AF' },
        grid: { display: false },
        border: { display: false },
      },
      yTemp: {
        position: 'left',
        ticks: {
          font: { size: 11 }, color: '#9CA3AF',
          callback: (v) => `${v}°`,
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
        border: { display: false },
      },
      yPrecip: {
        position: 'right',
        min: 0, max: 100,
        ticks: {
          font: { size: 11 }, color: '#9CA3AF',
          callback: (v) => `${v}%`,
        },
        grid: { drawOnChartArea: false },
        border: { display: false },
      },
    },
  }), [unit, t]);

  /* Humidity bar */
  const humidity = cur.relative_humidity_2m;
  const humColor = humidity > 80 ? '#3B82F6' : humidity > 60 ? '#0EA5E9' : humidity > 30 ? '#10B981' : '#F59E0B';

  /* Pressure comparison */
  const pressure = cur.surface_pressure != null ? Math.round(cur.surface_pressure) : null;

  if (loading) return (
    <PageContainer>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 500 }}>
        <CircularProgress />
      </Box>
    </PageContainer>
  );

  if (error) return (
    <PageContainer>
      <Alert severity="error">{t('weather.loadError')}: {error}</Alert>
    </PageContainer>
  );

  return (
    <>
      {/* ── Global keyframe animations ── */}
      <GlobalStyles styles={{
        '@keyframes wxFadeUp': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes wxRotate': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        '@keyframes wxPulse': {
          '0%,100%': { filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.3))' },
          '50%':     { filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.85))' },
        },
        '@keyframes wxCloud': {
          '0%,100%': { transform: 'translateX(0px)' },
          '50%':     { transform: 'translateX(5px)' },
        },
        '@keyframes wxRain': {
          '0%':   { transform: 'translateY(-6px)', opacity: 0 },
          '30%':  { opacity: 0.9 },
          '100%': { transform: 'translateY(10px)', opacity: 0 },
        },
        '@keyframes wxSnow': {
          '0%':   { transform: 'translateY(-4px) rotate(0deg)', opacity: 0 },
          '50%':  { opacity: 0.9 },
          '100%': { transform: 'translateY(8px) rotate(180deg)', opacity: 0 },
        },
      }} />

      <PageContainer>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* ══ ROW 1: Hero + Chart ══════════════════════════════ */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'stretch' }}>

            {/* Current weather hero */}
            <Box sx={{
              width: { xs: '100%', md: 290 }, flexShrink: 0,
              background: 'linear-gradient(145deg, #023E8A 0%, #0077B6 55%, #48CAE4 100%)',
              borderRadius: '20px', p: 3,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0,119,182,0.35)',
              animation: 'wxFadeUp 0.4s ease both',
              color: '#fff',
            }}>
              {/* Location */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                <LocationOnIcon sx={{ fontSize: 15, opacity: 0.8 }} />
                <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
                  {t('weather.city')}, KZ
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                  {['C', 'F'].map(u => (
                    <Box key={u} onClick={() => setUnit(u)} sx={{
                      px: 1, py: 0.25, borderRadius: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      bgcolor: unit === u ? 'rgba(255,255,255,0.25)' : 'transparent',
                      color: unit === u ? '#fff' : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.15s',
                    }}>°{u}</Box>
                  ))}
                </Box>
              </Box>

              {/* Animated icon */}
              <Box sx={{ mb: 1 }}>
                <WeatherIcon condition={condition} size={80} />
              </Box>

              {/* Big temperature */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 1 }}>
                <Typography sx={{ fontSize: 72, fontWeight: 800, lineHeight: 1, color: '#fff' }}>
                  {cur.temperature_2m != null ? tempDisplay : '—'}
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 400, mt: 1.5, opacity: 0.8 }}>°{unit}</Typography>
              </Box>

              {/* Condition */}
              <Typography sx={{ fontSize: 16, fontWeight: 600, opacity: 0.9, mt: 0.5 }}>
                {t(`weather.conditions.${condition}`)}
              </Typography>

              {/* Feels like */}
              <Typography sx={{ fontSize: 12, opacity: 0.65, mt: 0.25 }}>
                {t('weather.feelsLike')} {cur.apparent_temperature != null ? `${cvtT(cur.apparent_temperature, unit)}°${unit}` : '—'}
              </Typography>

              <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.2)', mt: 2, pt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Wind */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, opacity: 0.8 }}>
                    <AirIcon sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: 12 }}>{t('weather.wind')}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {cur.wind_speed_10m != null ? `${cur.wind_speed_10m.toFixed(1)} ${t('weather.kmh')}` : '—'}
                    {cur.wind_direction_10m != null ? ` · ${getWindDir(cur.wind_direction_10m)}` : ''}
                  </Typography>
                </Box>
                {/* Humidity */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, opacity: 0.8 }}>
                    <OpacityIcon sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: 12 }}>{t('weather.humidity')}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {cur.relative_humidity_2m ?? '—'}%
                  </Typography>
                </Box>
                {/* Pressure */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, opacity: 0.8 }}>
                    <CompressIcon sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: 12 }}>{t('weather.pressure')}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {pressure ?? '—'} {t('weather.hpa')}
                  </Typography>
                </Box>
              </Box>

            </Box>

            {/* 24-hour chart */}
            <Box sx={{
              flex: 1, bgcolor: '#fff', borderRadius: '20px', p: 3,
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              animation: 'wxFadeUp 0.4s ease both',
              animationDelay: '80ms',
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {t('weather.hourlyForecast')}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#9CA3AF', mt: 0.25 }}>
                    {t('weather.temperature')} & {t('weather.precipProbability')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 3, bgcolor: '#0077B6', borderRadius: 1 }} />
                    <Typography sx={{ fontSize: 11, color: '#6B7280' }}>{t('weather.temperature')}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 8, bgcolor: 'rgba(96,165,250,0.5)', borderRadius: '2px' }} />
                    <Typography sx={{ fontSize: 11, color: '#6B7280' }}>{t('weather.precipProbability')}</Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ flex: 1, minHeight: 220 }}>
                {next24.length > 0
                  ? <Line data={chartData} options={chartOptions} />
                  : <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
                      <Typography>{t('weather.noData')}</Typography>
                    </Box>
                }
              </Box>
            </Box>
          </Box>

          {/* ══ ROW 2: 7-day forecast ═════════════════════════════ */}
          <Box sx={{
            bgcolor: '#fff', borderRadius: '20px', p: 2.5,
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            animation: 'wxFadeUp 0.4s ease both',
            animationDelay: '160ms',
          }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#111827', mb: 2 }}>
              {t('weather.dailyForecast')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {daily.map((day, i) => (
                <DayCard key={i} day={day} unit={unit} delay={200 + i * 50} t={t} isToday={i === 0} locale={i18n.language} />
              ))}
            </Box>
          </Box>

          {/* ══ ROW 3: 6 Metric Cards ════════════════════════════ */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', lg: repeat => 'repeat(6, 1fr)' },
            gap: 2,
          }}>

            {/* Wind */}
            <MCard title={t('weather.windStatus')} delay={300} accent="#0EA5E9">
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {cur.wind_speed_10m != null ? cur.wind_speed_10m.toFixed(1) : '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>{t('weather.kmh')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
                <AirIcon sx={{ fontSize: 16, color: '#0EA5E9' }} />
                <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                  {getWindDir(cur.wind_direction_10m)}
                </Typography>
              </Box>
              {cur.wind_gusts_10m != null && (
                <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.5 }}>
                  {t('weather.gusts')}: {cur.wind_gusts_10m.toFixed(1)} {t('weather.kmh')}
                </Typography>
              )}
            </MCard>

            {/* Humidity */}
            <MCard title={t('weather.humidity')} delay={350} accent={humColor}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {humidity ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={humidity ?? 0}
                sx={{
                  mt: 1.5, mb: 0.75, height: 6, borderRadius: 3,
                  bgcolor: '#F3F4F6',
                  '& .MuiLinearProgress-bar': { bgcolor: humColor, borderRadius: 3 },
                }}
              />
              <Typography sx={{ fontSize: 11, color: '#6B7280' }}>
                {t(`weather.humidStatus.${humidity > 80 ? 'veryHigh' : humidity > 60 ? 'high' : humidity > 30 ? 'normal' : 'low'}`)}
              </Typography>
            </MCard>

            {/* Precipitation */}
            <MCard title={t('weather.precipitation')} delay={400} accent="#60A5FA">
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {cur.precipitation != null ? cur.precipitation.toFixed(1) : '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>{t('weather.mm')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
                <WaterDropIcon sx={{ fontSize: 16, color: '#60A5FA' }} />
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                  {(cur.precipitation ?? 0) > 5 ? t('weather.precipHeavy')
                    : (cur.precipitation ?? 0) > 0 ? t('weather.precipLight')
                    : t('weather.precipNone')}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.5 }}>
                {t('weather.rain')}: {cur.rain != null ? `${cur.rain.toFixed(1)} ${t('weather.mm')}` : '—'}
              </Typography>
            </MCard>

            {/* Cloud Cover */}
            <MCard title={t('weather.cloudCover')} delay={450} accent="#94A3B8">
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {cur.cloud_cover ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={cur.cloud_cover ?? 0}
                sx={{
                  mt: 1.5, mb: 0.75, height: 6, borderRadius: 3,
                  bgcolor: '#F3F4F6',
                  '& .MuiLinearProgress-bar': { bgcolor: '#94A3B8', borderRadius: 3 },
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CloudIcon sx={{ fontSize: 15, color: '#9CA3AF' }} />
                <Typography sx={{ fontSize: 11, color: '#6B7280' }}>
                  {t(`weather.conditions.${condition}`)}
                </Typography>
              </Box>
            </MCard>

            {/* Pressure */}
            <MCard title={t('weather.pressure')} delay={500} accent="#8B5CF6">
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {pressure ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>{t('weather.hpa')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
                <CompressIcon sx={{ fontSize: 16, color: '#8B5CF6' }} />
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                  {pressure != null
                    ? pressure > 1020 ? t('weather.pressureHigh')
                      : pressure < 1000 ? t('weather.pressureLow')
                      : t('weather.pressureNormal')
                    : '—'}
                </Typography>
              </Box>
            </MCard>

            {/* Temperature details */}
            <MCard title={t('weather.feelsLike')} delay={550} accent="#F59E0B">
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {cur.apparent_temperature != null ? cvtT(cur.apparent_temperature, unit) : '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>°{unit}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>{t('weather.maxT')}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#EF4444' }}>
                    {today0.temperature_2m_max != null ? `${cvtT(today0.temperature_2m_max, unit)}°` : '—'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>{t('weather.minT')}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#3B82F6' }}>
                    {today0.temperature_2m_min != null ? `${cvtT(today0.temperature_2m_min, unit)}°` : '—'}
                  </Typography>
                </Box>
              </Box>
            </MCard>
          </Box>

        </Box>
      </PageContainer>
    </>
  );
}
