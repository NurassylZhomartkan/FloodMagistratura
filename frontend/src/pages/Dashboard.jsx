// src/components/page/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  Divider,
  GlobalStyles,
  CircularProgress,
} from '@mui/material';
import BaseModal         from '../components/BaseModal';
import WarningIcon       from '@mui/icons-material/Warning';
import LocationOnIcon    from '@mui/icons-material/LocationOn';
import PeopleIcon        from '@mui/icons-material/People';
import HomeIcon          from '@mui/icons-material/Home';
import WaterDropIcon     from '@mui/icons-material/WaterDrop';
import TrendingUpIcon    from '@mui/icons-material/TrendingUp';
import AccessTimeIcon    from '@mui/icons-material/AccessTime';
import SpeedIcon         from '@mui/icons-material/Speed';
import PublicIcon        from '@mui/icons-material/Public';
import { usePageTitle }  from '../utils/usePageTitle';
import { useTranslation } from 'react-i18next';
import { useNavigate }   from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltipPlugin,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltipPlugin, Legend);

/* ─── Animated number hook ───────────────────────────────── */
const useAnimatedNumber = (targetValue, duration = 2000, decimals = 0) => {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    if (typeof targetValue !== 'number') { setCurrentValue(targetValue); return; }
    const startTime = Date.now();
    const animate = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setCurrentValue(targetValue * ease);
      if (p < 1) requestAnimationFrame(animate);
      else setCurrentValue(targetValue);
    };
    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  if (typeof currentValue !== 'number') return currentValue;
  return decimals === 0 ? Math.round(currentValue) : parseFloat(currentValue.toFixed(decimals));
};

const AnimatedNumber = ({ value, decimals = 0, suffix = '', prefix = '', showSign = false }) => {
  const v = useAnimatedNumber(value, 2000, decimals);
  if (typeof v !== 'number') return <>{prefix}{v}{suffix}</>;
  const fmt = decimals === 0
    ? Math.round(v).toLocaleString('ru-RU')
    : v.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (showSign && v > 0) return <>{prefix}+{fmt}{suffix}</>;
  return <>{prefix}{fmt}{suffix}</>;
};

/* ─── Static data ────────────────────────────────────────── */
const STATIC_DATA = {
  currentStatus: {
    avgWaterLevel: 2.4, feelsLike: 2.4, change24h: 0.3,
    maxLevel: 3.8, minLevel: 0.5, precipitation: 45.2,
    criticalZones: 2, activeZones: 0,
  },
  totalArea: 247.5, populationAtRisk: 18450,
  avgWaterLevel: 2.4, maxWaterLevel: 3.8,
  currentVelocity: 1.5, timeToPeak: 6,
  criticalObjects: 12, affectedBuildings: 342,
};

const statusMeta = {
  'Критическая': { color: 'error',   hex: '#EF4444' },
  'Под угрозой': { color: 'error',   hex: '#EF4444' },
  'Активная':    { color: 'warning', hex: '#F59E0B' },
  'Мониторинг':  { color: 'info',    hex: '#0EA5E9' },
};
const getStatusColor = (s) => (statusMeta[s] ?? { color: 'default' }).color;
const getStatusHex   = (s) => (statusMeta[s] ?? { hex: '#9CA3AF' }).hex;


/* ─── SmallMetricCard ────────────────────────────────────── */
const SmallMetricCard = ({
  icon: Icon, title, value, unit, description,
  iconColor = '#0EA5E9', animateValue = true, decimals = 0, delay = 0,
}) => {
  const shouldAnimate = animateValue && typeof value === 'number';
  return (
    <Box sx={{
      height: '100%', bgcolor: '#fff', borderRadius: { xs: '16px', sm: '20px' },
      p: { xs: 1.75, sm: 2, md: 2.5 },
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      position: 'relative', overflow: 'hidden',
      animation: 'wxFadeUp 0.5s ease both',
      animationDelay: `${delay}ms`,
      transition: 'transform 0.25s, box-shadow 0.25s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 10px 28px rgba(0,0,0,0.1)` },
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: `linear-gradient(90deg, ${iconColor}, ${iconColor}55)`,
      },
    }}>
      {/* Icon badge */}
      <Box sx={{
        position: 'absolute', top: { xs: 12, sm: 16 }, right: { xs: 12, sm: 16 },
        width: { xs: 36, sm: 40, md: 44 }, height: { xs: 36, sm: 40, md: 44 },
        borderRadius: { xs: '10px', sm: '12px', md: '14px' },
        bgcolor: `${iconColor}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon sx={{ fontSize: { xs: 18, sm: 20, md: 22 }, color: iconColor }} />
      </Box>

      <Typography sx={{
        fontSize: { xs: 9, sm: 10 }, fontWeight: 700, color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        mb: { xs: 2, sm: 2.5 },
        pr: { xs: 5, sm: 6 },
      }}>
        {title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: { xs: 0.75, sm: 1 } }}>
        <Typography sx={{ fontSize: { xs: 26, sm: 30, md: 34 }, fontWeight: 900, color: '#111827', lineHeight: 1 }}>
          {shouldAnimate ? <AnimatedNumber value={value} decimals={decimals} /> : value}
        </Typography>
        {unit && (
          <Typography sx={{ fontSize: { xs: 12, sm: 13, md: 14 }, color: '#9CA3AF', fontWeight: 600, ml: 0.25 }}>
            {unit}
          </Typography>
        )}
      </Box>

      <Typography sx={{ fontSize: { xs: 11, sm: 12 }, color: '#6B7280', lineHeight: 1.4 }}>
        {description}
      </Typography>
    </Box>
  );
};

/* ═══════════════════════════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.dashboard');

  const [hydroPosts, setHydroPosts] = useState([]);
  const [hydroLatest, setHydroLatest] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [hydroHistory, setHydroHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    fetch('/stations/posts.json')
      .then((res) => res.json())
      .then((json) => {
        if (json.statusCode === 200 && json.data) {
          const hydroCategory = json.data.find((cat) => cat?.category?.id === 2);
          if (hydroCategory?.sites) setHydroPosts(hydroCategory.sites);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/hydro-stations/latest')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        setHydroLatest(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        setHydroLatest([]);
      });
  }, []);

  const levelByStationId = React.useMemo(() => {
    const map = new Map();
    hydroLatest
      .filter((r) => r?.param === 'level')
      .forEach((r) => {
        const sid = String(r.station_id ?? '').trim();
        if (!sid) return;
        map.set(sid, r);
      });
    return map;
  }, [hydroLatest]);

  const hydroPostsWithState = React.useMemo(() => {
    return hydroPosts.map((post) => {
      const sid = String(post?.code ?? '').trim();
      const levelRow = levelByStationId.get(sid);
      const actual = Number(levelRow?.actual_level);
      const danger = Number(levelRow?.danger_level);
      const hasActual = Number.isFinite(actual);
      const hasDanger = Number.isFinite(danger);
      const isDanger = hasActual && hasDanger && actual > danger;
      const exceedCm = isDanger ? actual - danger : 0;
      return {
        ...post,
        actualLevelCm: hasActual ? actual : null,
        dangerLevelCm: hasDanger ? danger : null,
        exceedCm,
        isDanger,
      };
    });
  }, [hydroPosts, levelByStationId]);

  const hydroSummary = React.useMemo(() => {
    const postsWithActual = hydroPostsWithState.filter((p) => Number.isFinite(p.actualLevelCm));
    const dangerPosts = hydroPostsWithState.filter((p) => p.isDanger);
    const sumExceedCm = dangerPosts.reduce((acc, p) => acc + p.exceedCm, 0);
    const avgLevelCm = postsWithActual.length
      ? postsWithActual.reduce((acc, p) => acc + p.actualLevelCm, 0) / postsWithActual.length
      : 0;
    const maxLevelCm = postsWithActual.length
      ? Math.max(...postsWithActual.map((p) => p.actualLevelCm))
      : 0;
    const minLevelCm = postsWithActual.length
      ? Math.min(...postsWithActual.map((p) => p.actualLevelCm))
      : 0;

    return {
      sumExceedM: sumExceedCm / 100,
      avgLevelM: avgLevelCm / 100,
      maxLevelM: maxLevelCm / 100,
      minLevelM: minLevelCm / 100,
      dangerCount: dangerPosts.length,
    };
  }, [hydroPostsWithState]);

  useEffect(() => {
    if (!historyOpen || !selectedPost?.code) return;
    const params = new URLSearchParams({
      station_id: String(selectedPost.code),
      metric: 'level',
    });
    setHistoryLoading(true);
    setHistoryError('');
    fetch(`/api/hydro-stations/history?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        setHydroHistory(json);
      })
      .catch(() => {
        setHydroHistory(null);
        setHistoryError(t('dashboard.historyLoadError', 'Не удалось загрузить историю поста'));
      })
      .finally(() => setHistoryLoading(false));
  }, [historyOpen, selectedPost, t]);

  const hydroLineData = React.useMemo(() => {
    if (!hydroHistory?.ok || !Array.isArray(hydroHistory.levels)) return null;
    const levels = hydroHistory.levels
      .filter((r) => r?.date)
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!levels.length) return null;
    return {
      labels: levels.map((r) => r.date),
      datasets: [
        {
          label: t('databasePage.chartActual', 'Фактический уровень, см'),
          data: levels.map((r) => (r.actual_level == null ? null : r.actual_level)),
          borderColor: 'rgba(0, 119, 182, 0.95)',
          backgroundColor: 'rgba(0, 119, 182, 0.12)',
          pointRadius: 2,
          tension: 0.25,
        },
        {
          label: t('databasePage.chartCritical', 'Критический уровень, см'),
          data: levels.map((r) => (r.danger_level == null ? null : r.danger_level)),
          borderColor: 'rgba(220, 38, 38, 0.95)',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.05,
        },
      ],
    };
  }, [hydroHistory, t]);

  const hydroLineOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
      },
      scales: {
        x: { grid: { color: 'rgba(148,163,184,0.12)' } },
        y: {
          beginAtZero: true,
          title: { display: true, text: t('databasePage.chartAxisCm', 'См') },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
      },
    }),
    [t],
  );

  const openStationHistory = (post) => {
    setSelectedPost(post);
    setHistoryOpen(true);
  };

  const data = {
    ...STATIC_DATA,
    activeZones: hydroPostsWithState.length,
    avgWaterLevel: hydroSummary.avgLevelM,
    maxWaterLevel: hydroSummary.maxLevelM,
    currentStatus: {
      ...STATIC_DATA.currentStatus,
      avgWaterLevel: hydroSummary.sumExceedM,
      feelsLike: hydroSummary.sumExceedM,
      change24h: 0,
      maxLevel: hydroSummary.maxLevelM,
      minLevel: hydroSummary.minLevelM,
      criticalZones: hydroSummary.dangerCount,
      activeZones: hydroPostsWithState.length,
    },
  };
  const status = data.currentStatus;

  const [showInstructionDialog, setShowInstructionDialog] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('hasSeenInstructionPrompt')) setShowInstructionDialog(true);
  }, []);
  const handleOpenInstruction = () => {
    localStorage.setItem('hasSeenInstructionPrompt', 'true');
    setShowInstructionDialog(false);
    navigate('/app/instruction');
  };
  const handleCloseDialog = () => {
    localStorage.setItem('hasSeenInstructionPrompt', 'true');
    setShowInstructionDialog(false);
  };

  const METRICS = [
    { icon: WarningIcon,    titleKey: 'activeZones',    descKey: 'zonesUnderMonitoring',       value: hydroPostsWithState.length, unitKey: null, color: '#10B981', decimals: 0, delay: 200 },
    { icon: PublicIcon,     titleKey: 'riskArea',        descKey: 'riskAreaDescription',        value: data.totalArea,         unitKey: 'km2', color: '#F59E0B', decimals: 1, delay: 250 },
    { icon: PeopleIcon,     titleKey: 'population',      descKey: 'populationDescription',      value: data.populationAtRisk,  unitKey: null,  color: '#EF4444', decimals: 0, delay: 300 },
    { icon: HomeIcon,       titleKey: 'buildings',       descKey: 'buildingsDescription',       value: data.affectedBuildings, unitKey: null,  color: '#0EA5E9', decimals: 0, delay: 350 },
    { icon: WaterDropIcon,  titleKey: 'waterLevel',      descKey: 'waterLevelDescription',      value: data.avgWaterLevel,     unitKey: 'm',   color: '#0077B6', decimals: 1, delay: 400 },
    { icon: TrendingUpIcon, titleKey: 'maxLevel',        descKey: 'maxLevelDescription',        value: data.maxWaterLevel,     unitKey: 'm',   color: '#EF4444', decimals: 1, delay: 450 },
    { icon: SpeedIcon,      titleKey: 'currentVelocity', descKey: 'currentVelocityDescription', value: data.currentVelocity,   unitKey: 'ms',  color: '#F59E0B', decimals: 1, delay: 500 },
    { icon: AccessTimeIcon, titleKey: 'timeToPeak',      descKey: 'timeToPeakDescription',      value: data.timeToPeak,        unitKey: 'h',   color: '#8B5CF6', decimals: 0, delay: 550 },
  ];

  return (
    <>
      <GlobalStyles styles={{
        '@keyframes wxFadeUp': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes wxPulse': {
          '0%,100%': { opacity: 0.8 },
          '50%':     { opacity: 1 },
        },
      }} />

      {/* ── Полноэкранный контейнер ── */}
      <Box sx={{
        width: '100%',
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 1.5, sm: 2 },
        boxSizing: 'border-box',
        bgcolor: '#F0F4F8',
        overflow: 'auto',
      }}>

        {/* Заголовок */}
        <Typography sx={{
          mb: { xs: 1, sm: 1.5 },
          fontWeight: 800, color: '#111827',
          fontSize: { xs: '1.2rem', sm: '1.5rem', md: '1.75rem' },
          flexShrink: 0,
        }}>
          {t('pageTitles.dashboard')}
        </Typography>

        {/* Основная сетка: 2 строки по 1fr — заполняет весь оставшийся экран */}
        <Box sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: { xs: 'auto auto', md: '1fr 1fr' },
          gap: { xs: 1.5, sm: 2 },
        }}>

          {/* ── Строка 1: Hero + Активные зоны ── */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            gap: { xs: 1.5, sm: 2 },
            minHeight: 0,
          }}>

            {/* HERO CARD */}
            <Box sx={{
              borderRadius: '24px',
              background: 'linear-gradient(145deg, #023E8A 0%, #0077B6 60%, #0096C7 100%)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,119,182,0.35)',
              animation: 'wxFadeUp 0.4s ease both',
              transition: 'transform 0.25s, box-shadow 0.25s',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 40px rgba(0,119,182,0.45)' },
              position: 'relative', overflow: 'hidden', color: '#fff', minHeight: 0,
            }}>
              <Box sx={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
              <Box sx={{ position: 'absolute', bottom: -50, left: -30, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: { xs: 10, sm: 11 }, fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
                      {t('dashboard.flooding')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Typography sx={{ fontSize: { xs: 40, sm: 52, md: 64 }, fontWeight: 900, lineHeight: 1, color: '#fff' }}>
                        <AnimatedNumber value={status.avgWaterLevel} decimals={1} />
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 16, sm: 20, md: 24 }, fontWeight: 400, opacity: 0.8, mt: { xs: 0.75, sm: 1.25 }, ml: 0.5 }}>
                        {t('dashboard.m')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: { xs: 11, sm: 13 }, opacity: 0.7, mt: 0.5 }}>
                      {t('dashboard.averageWaterLevel')}
                    </Typography>
                  </Box>
                  <Box sx={{
                    width: { xs: 48, sm: 58, md: 68 }, height: { xs: 48, sm: 58, md: 68 },
                    borderRadius: { xs: '14px', md: '18px' },
                    bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'wxPulse 3s ease-in-out infinite', flexShrink: 0,
                  }}>
                    <WaterDropIcon sx={{ fontSize: { xs: 26, sm: 30, md: 36 }, color: '#fff' }} />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2.5 }, flexWrap: 'wrap' }}>
                  {[
                    { label: t('dashboard.feelsLike'), value: status.feelsLike,  decimals: 1, unit: t('dashboard.m'), color: '#fff' },
                    { label: t('dashboard.change24h'), value: status.change24h,  decimals: 1, unit: t('dashboard.m'), color: '#86EFAC', showSign: true },
                    { label: t('dashboard.max'),        value: status.maxLevel,  decimals: 1, unit: t('dashboard.m'), color: '#FCA5A5' },
                    { label: t('dashboard.min'),        value: status.minLevel,  decimals: 1, unit: t('dashboard.m'), color: '#93C5FD' },
                  ].map(({ label, value, decimals, unit, color, showSign }, i) => (
                    <Box key={i}>
                      <Typography sx={{ fontSize: { xs: 9, sm: 10 }, opacity: 0.6, mb: 0.15 }}>{label}</Typography>
                      <Typography sx={{ fontSize: { xs: 13, sm: 15, md: 16 }, fontWeight: 700, color }}>
                        <AnimatedNumber value={value} decimals={decimals} suffix={unit} showSign={!!showSign} />
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, pt: { xs: 1.5, sm: 2 }, borderTop: '1px solid rgba(255,255,255,0.18)', flexWrap: 'wrap' }}>
                  {[
                    { icon: WarningIcon,    label: t('dashboard.criticalZones'), value: status.criticalZones, decimals: 0, color: '#FCA5A5' },
                    { icon: LocationOnIcon, label: t('dashboard.activeZones'),   value: status.activeZones,   decimals: 0, color: '#FDE68A' },
                    { icon: TrendingUpIcon, label: t('dashboard.precipitation'), value: status.precipitation, decimals: 1, unit: t('dashboard.mm'), color: '#93C5FD' },
                  ].map(({ icon: ItemIcon, label, value, decimals, unit, color }, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 },
                      bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '12px',
                      px: { xs: 1, sm: 1.5 }, py: { xs: 0.75, sm: 1 },
                      flex: 1, minWidth: { xs: 85, sm: 100 },
                    }}>
                      <ItemIcon sx={{ fontSize: { xs: 14, sm: 16 }, color, flexShrink: 0 }} />
                      <Box>
                        <Typography sx={{ fontSize: { xs: 9, sm: 10 }, opacity: 0.65, lineHeight: 1 }}>{label}</Typography>
                        <Typography sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color, lineHeight: 1.3 }}>
                          <AnimatedNumber value={value} decimals={decimals} suffix={unit || ''} />
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            {/* ACTIVE ZONES CARD */}
            <Box sx={{
              borderRadius: '24px', bgcolor: '#fff',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column',
              animation: 'wxFadeUp 0.4s ease both', animationDelay: '80ms',
              transition: 'transform 0.25s, box-shadow 0.25s',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 10px 28px rgba(0,0,0,0.1)' },
              position: 'relative', overflow: 'hidden', minHeight: 0,
              '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #EF4444, #F59E0B)' },
            }}>
              <Box sx={{ p: { xs: 2, sm: 2.5 }, flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1, sm: 1.5 }, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: { xs: 9, sm: 10 }, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {t('dashboard.hydroPosts', 'Гидрологические посты')}
                  </Typography>
                  <Box sx={{ bgcolor: '#ECFDF5', borderRadius: '8px', px: 1, py: 0.25 }}>
                    <Typography sx={{ fontSize: { xs: 11, sm: 12 }, fontWeight: 700, color: '#10B981' }}>
                      {hydroPosts.length}
                    </Typography>
                  </Box>
                </Box>
                <List sx={{ pt: 0, flex: 1, minHeight: 0, overflow: 'auto' }}>
                  {hydroPostsWithState.map((post, index) => {
                    const hex = post.isDanger ? '#DC2626' : '#10B981';
                    const chipLabel = post.isDanger
                      ? t('dashboard.danger', 'Опасность')
                      : t('dashboard.monitoring', 'Мониторинг');
                    const chipColor = post.isDanger ? 'error' : 'info';
                    return (
                      <React.Fragment key={post.id}>
                        <ListItem
                          onClick={() => openStationHistory(post)}
                          sx={{
                            px: 0,
                            py: { xs: 0.75, sm: 1 },
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderRadius: '10px',
                            transition: 'background-color 0.15s ease',
                            '&:hover': { backgroundColor: 'rgba(15, 23, 42, 0.04)' },
                          }}
                        >
                          <Box sx={{ width: { xs: 32, sm: 36 }, height: { xs: 32, sm: 36 }, borderRadius: '10px', bgcolor: `${hex}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5, flexShrink: 0 }}>
                            <LocationOnIcon sx={{ fontSize: { xs: 16, sm: 18 }, color: hex }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: { xs: 12, sm: 13 }, fontWeight: 600, color: '#111827', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {post.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                              <Typography sx={{ fontSize: { xs: 11, sm: 12 }, color: '#6B7280' }}>
                                {post.code}
                              </Typography>
                              <Chip label={chipLabel} size="small" color={chipColor} sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} />
                            </Box>
                          </Box>
                        </ListItem>
                        {index < hydroPostsWithState.length - 1 && <Divider sx={{ opacity: 0.4 }} />}
                      </React.Fragment>
                    );
                  })}
                  {hydroPostsWithState.length === 0 && (
                    <Typography sx={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', py: 2 }}>
                      {t('dashboard.loadingPosts', 'Загрузка...')}
                    </Typography>
                  )}
                </List>
              </Box>
            </Box>
          </Box>

          {/* ── Строка 2: 8 метрических карточек (4×2) ── */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gridTemplateRows: { xs: 'repeat(4, 1fr)', sm: 'repeat(2, 1fr)' },
            gap: { xs: 1.5, sm: 2 },
            minHeight: 0,
          }}>
            {METRICS.map(({ icon, titleKey, descKey, value, unitKey, color, decimals, delay }) => (
              <SmallMetricCard
                key={titleKey}
                icon={icon}
                title={t(`dashboard.${titleKey}`)}
                value={value}
                unit={unitKey ? t(`dashboard.${unitKey}`) : undefined}
                description={t(`dashboard.${descKey}`)}
                iconColor={color}
                decimals={decimals}
                delay={delay}
              />
            ))}
          </Box>

        </Box>
      </Box>

      <BaseModal
        open={showInstructionDialog}
        onClose={handleCloseDialog}
        title={t('dashboard.instructionDialog.title', 'Добро пожаловать!')}
        confirmText={t('dashboard.instructionDialog.open', 'Открыть инструкции')}
        onConfirm={handleOpenInstruction}
        cancelText={t('dashboard.instructionDialog.cancel', 'Позже')}
        onCancel={handleCloseDialog}
      >
        <Typography variant="body1" color="text.secondary">
          {t('dashboard.instructionDialog.message', 'Хотите открыть страницу с инструкциями?')}
        </Typography>
      </BaseModal>

      <BaseModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={selectedPost ? `${selectedPost.name} (${selectedPost.code})` : t('dashboard.hydroPostHistory', 'История гидропоста')}
        maxWidth="lg"
        fullWidth
        contentSx={{ minHeight: 420 }}
      >
        {historyLoading ? (
          <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={30} />
          </Box>
        ) : historyError ? (
          <Typography color="error.main">{historyError}</Typography>
        ) : hydroLineData ? (
          <Box sx={{ height: 360 }}>
            <Line data={hydroLineData} options={hydroLineOptions} />
          </Box>
        ) : (
          <Typography color="text.secondary">
            {t('dashboard.noHistoryData', 'Нет данных для выбранного поста')}
          </Typography>
        )}
      </BaseModal>
    </>
  );
}
