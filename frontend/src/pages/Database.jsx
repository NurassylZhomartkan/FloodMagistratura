// frontend/src/pages/Database.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltipPlugin,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TablePagination,
  Button,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderIcon from '@mui/icons-material/Folder';
import WaterIcon from '@mui/icons-material/Water';
import LayersIcon from '@mui/icons-material/Layers';
import StorageIcon from '@mui/icons-material/Storage';
import WavesIcon from '@mui/icons-material/Waves';
import SensorsIcon from '@mui/icons-material/Sensors';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, ChartTooltipPlugin, Legend);

const PRIMARY = '#0077B6';
const PRIMARY_DARK = '#023E8A';
const PRIMARY_BG = '#E8F4F8';

async function fetchJson(url) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

function formatShortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function formatDateOnly(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function BoolChip({ value, yes, no }) {
  return (
    <Chip
      label={value ? yes : no}
      size="small"
      sx={{
        fontSize: '0.7rem',
        height: 22,
        fontWeight: 600,
        borderRadius: '6px',
        ...(value
          ? {
              bgcolor: 'rgba(5,150,105,0.1)',
              color: '#047857',
              border: '1px solid rgba(5,150,105,0.3)',
            }
          : {
              bgcolor: 'rgba(100,116,139,0.08)',
              color: '#64748B',
              border: '1px solid rgba(100,116,139,0.2)',
            }),
      }}
    />
  );
}

function ColorDot({ hex }) {
  if (!hex) return <Typography variant="caption" color="text.disabled">—</Typography>;
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Box
        sx={{
          width: 16, height: 16, borderRadius: '4px',
          bgcolor: hex,
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontWeight: 500 }}>
        {hex}
      </Typography>
    </Box>
  );
}

function IdBadge({ value }) {
  if (value == null) return '—';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        height: 22,
        px: 0.75,
        borderRadius: '6px',
        bgcolor: PRIMARY_BG,
        border: `1px solid ${PRIMARY}30`,
        color: PRIMARY_DARK,
        fontSize: '0.72rem',
        fontWeight: 700,
        fontFamily: 'monospace',
      }}
    >
      {value}
    </Box>
  );
}

function DataTable({ columns, rows, loading, error, noDataMsg }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" flex={1} gap={2}>
        <CircularProgress size={32} sx={{ color: PRIMARY }} />
        <Typography variant="body2" color="text.secondary">Загрузка данных...</Typography>
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  const visible = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Статистика */}
      {rows.length > 0 && (
        <Box
          sx={{
            px: 2.5, py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: '#FAFCFE',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Всего записей:
          </Typography>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 1,
              py: 0.25,
              borderRadius: '20px',
              bgcolor: PRIMARY_BG,
              border: `1px solid ${PRIMARY}30`,
            }}
          >
            <Typography variant="caption" sx={{ color: PRIMARY, fontWeight: 700 }}>
              {rows.length}
            </Typography>
          </Box>
        </Box>
      )}

      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col, i) => (
                <TableCell
                  key={col.key}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#475569',
                    whiteSpace: 'nowrap',
                    minWidth: col.minWidth,
                    bgcolor: '#F1F5F9',
                    borderBottom: `2px solid ${PRIMARY}30`,
                    py: 1.5,
                    px: 2,
                    ...(i === 0 && { pl: 2.5 }),
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  align="center"
                  sx={{ py: 8, color: 'text.secondary', border: 0 }}
                >
                  <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                    <Box
                      sx={{
                        width: 48, height: 48, borderRadius: '50%',
                        bgcolor: PRIMARY_BG,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <StorageIcon sx={{ color: PRIMARY, opacity: 0.5, fontSize: 24 }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">{noDataMsg}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row, idx) => (
                <TableRow
                  key={row.id ?? idx}
                  sx={{
                    '&:last-child td': { borderBottom: 0 },
                    '&:nth-of-type(even)': { bgcolor: '#FAFCFE' },
                    transition: 'background-color 0.15s',
                    '&:hover': {
                      bgcolor: `${PRIMARY}08 !important`,
                      '& td': { color: 'text.primary' },
                    },
                  }}
                >
                  {columns.map((col, i) => (
                    <TableCell
                      key={col.key}
                      sx={{
                        whiteSpace: 'nowrap',
                        fontSize: '0.85rem',
                        color: 'text.primary',
                        borderColor: 'rgba(203,213,225,0.5)',
                        py: 1.25,
                        px: 2,
                        ...(i === 0 && { pl: 2.5 }),
                      }}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {rows.length > 10 && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: '#FAFCFE', flexShrink: 0 }}>
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[5, 10, 25, 100, 500, 1000]}
            labelRowsPerPage="Строк:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
            sx={{
              '& .MuiTablePagination-toolbar': { minHeight: 44 },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontSize: '0.8rem',
                color: 'text.secondary',
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export default function Database() {
  const { t } = useTranslation();
  usePageTitle('pageTitles.database');

  const [tab, setTab] = useState(3); // по умолчанию гидропосты
  const [hecras, setHecras] = useState([]);
  const [flood, setFlood] = useState([]);
  const [layers, setLayers] = useState([]);
  const [hydro, setHydro] = useState([]);
  const [hydroStatus, setHydroStatus] = useState(null);
  const [hydroChart, setHydroChart] = useState(null);
  const [hydroHistory, setHydroHistory] = useState(null);
  const [hydroHistoryLoading, setHydroHistoryLoading] = useState(false);
  const [hydroHistoryError, setHydroHistoryError] = useState(null);
  const [selectedHydroStation, setSelectedHydroStation] = useState('');
  const [historyMetric, setHistoryMetric] = useState('discharge');
  const [historyDateFrom, setHistoryDateFrom] = useState('2020-01-01');
  const [historyDateTo, setHistoryDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [hydroImportBusy, setHydroImportBusy] = useState(false);
  const [hydroImportMsg, setHydroImportMsg] = useState(null);
  const hydroCsvInputRef = useRef(null);
  const [hydroTableStationFilter, setHydroTableStationFilter] = useState('');
  const [loadingMap, setLoadingMap] = useState({});
  const [errorMap, setErrorMap] = useState({});

  const load = useCallback(async (key, url, setter) => {
    setLoadingMap((m) => ({ ...m, [key]: true }));
    setErrorMap((m) => ({ ...m, [key]: null }));
    try {
      const data = await fetchJson(url);
      setter(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e.message && e.message.includes('404')) {
        setter([]);
      } else {
        setErrorMap((m) => ({ ...m, [key]: t('databasePage.error') }));
      }
    } finally {
      setLoadingMap((m) => ({ ...m, [key]: false }));
    }
  }, [t]);

  const loadHydroStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/hydro-stations/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setHydroStatus(await res.json());
    } catch {}
  }, []);

  const loadHydroChart = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/hydro-stations/chart-snapshot?only_allowlist=1', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setHydroChart(null);
        return;
      }
      const j = await res.json();
      setHydroChart(j.ok ? j : null);
    } catch {
      setHydroChart(null);
    }
  }, []);

  const loadHydroHistory = useCallback(async () => {
    if (!selectedHydroStation) {
      setHydroHistory(null);
      return;
    }
    setHydroHistoryLoading(true);
    setHydroHistoryError(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        station_id: selectedHydroStation,
        metric: historyMetric,
      });
      if (historyDateFrom) params.set('date_from', historyDateFrom);
      if (historyDateTo) params.set('date_to', historyDateTo);
      const res = await fetch(`/api/hydro-stations/history?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setHydroHistory(null);
        setHydroHistoryError(`HTTP ${res.status}`);
        return;
      }
      const j = await res.json();
      setHydroHistory(j?.ok ? j : null);
    } catch {
      setHydroHistory(null);
      setHydroHistoryError(t('databasePage.error'));
    } finally {
      setHydroHistoryLoading(false);
    }
  }, [historyDateFrom, historyDateTo, historyMetric, selectedHydroStation, t]);

  const loadAll = useCallback(() => {
    load('hecras', '/api/hec-ras/', setHecras);
    load('flood',  '/api/flood/my-projects', setFlood);
    load('layers', '/api/custom-layers/', setLayers);
    load('hydro',  '/api/hydro-stations/all?metric=both', setHydro);
  }, [load]);

  const onHydroCsvChange = useCallback(
    async (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      setHydroImportBusy(true);
      setHydroImportMsg(null);
      try {
        const token = localStorage.getItem('token');
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch('/api/hydro-stations/import-csv', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = typeof j.detail === 'string' ? j.detail : (Array.isArray(j.detail) ? j.detail.map((x) => x.msg || x).join(', ') : '');
          setHydroImportMsg({ type: 'error', text: detail || t('databasePage.importCsvFail') });
          return;
        }
        setHydroImportMsg({ type: 'success', text: t('databasePage.importCsvOk', { count: j.imported }) });
        loadAll();
      } catch {
        setHydroImportMsg({ type: 'error', text: t('databasePage.importCsvFail') });
      } finally {
        setHydroImportBusy(false);
      }
    },
    [loadAll, t],
  );

  useEffect(() => { loadAll(); }, [loadAll]);

  const hydroStations = useMemo(() => {
    const byId = new Map();
    hydro.forEach((r) => {
      const sid = String(r.station_id || '').trim();
      if (!sid) return;
      if (!byId.has(sid)) byId.set(sid, r.station_name || sid);
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id, 'ru'));
  }, [hydro]);

  useEffect(() => {
    if (!hydroTableStationFilter) return;
    if (!hydroStations.some((s) => s.id === hydroTableStationFilter)) {
      setHydroTableStationFilter('');
    }
  }, [hydroStations, hydroTableStationFilter]);

  useEffect(() => {
    if (!hydroStations.length) {
      setSelectedHydroStation('');
      return;
    }
    if (!selectedHydroStation || !hydroStations.some((s) => s.id === selectedHydroStation)) {
      setSelectedHydroStation(hydroStations[0].id);
    }
  }, [hydroStations, selectedHydroStation]);

  useEffect(() => {
    // Страница /app/database теперь "только таблица": график/история не грузим
    // eslint-disable-next-line no-unreachable
    if (false) loadHydroHistory();
  }, [loadHydroHistory]);

  const yes = t('databasePage.yes');
  const no  = t('databasePage.no');

  const hecrasColumns = [
    { key: 'id',                label: t('databasePage.columns.id'),         minWidth: 50,  render: (v) => <IdBadge value={v} /> },
    { key: 'name',              label: t('databasePage.columns.name'),        minWidth: 160 },
    { key: 'original_filename', label: t('databasePage.columns.filename'),    minWidth: 200 },
    { key: 'created_at',        label: t('databasePage.columns.createdAt'),   minWidth: 150, render: fmtDate },
    { key: 'share_hash',        label: t('databasePage.columns.hasShare'),    minWidth: 130,
      render: (v) => <BoolChip value={!!v} yes={yes} no={no} /> },
    { key: 'has_password',      label: t('databasePage.columns.hasPassword'), minWidth: 150,
      render: (v) => <BoolChip value={v} yes={yes} no={no} /> },
  ];

  const floodColumns = [
    { key: 'id',         label: t('databasePage.columns.id'),       minWidth: 50,  render: (v) => <IdBadge value={v} /> },
    { key: 'name',       label: t('databasePage.columns.name'),      minWidth: 160 },
    { key: 'created_at', label: t('databasePage.columns.createdAt'), minWidth: 150, render: fmtDate },
    { key: 'has_share',  label: t('databasePage.columns.hasShare'),  minWidth: 130,
      render: (v) => <BoolChip value={v} yes={yes} no={no} /> },
  ];

  const layersColumns = [
    { key: 'id',         label: t('databasePage.columns.id'),        minWidth: 50,  render: (v) => <IdBadge value={v} /> },
    { key: 'name',       label: t('databasePage.columns.name'),       minWidth: 160 },
    { key: 'fill_color', label: t('databasePage.columns.fillColor'),  minWidth: 130,
      render: (v) => <ColorDot hex={v} /> },
    { key: 'line_color', label: t('databasePage.columns.lineColor'),  minWidth: 130,
      render: (v) => <ColorDot hex={v} /> },
    { key: 'created_at', label: t('databasePage.columns.createdAt'),  minWidth: 150, render: fmtDate },
  ];

  const PARAM_LABELS = {
    level:     t('databasePage.paramLevel'),
    discharge: t('databasePage.paramDischarge'),
  };

  const COLOR_MAP = {
    red:    '#EF4444',
    orange: '#F97316',
    green:  '#22C55E',
    blue:   '#3B82F6',
    grey:   '#9CA3AF',
    gray:   '#9CA3AF',
  };

  function ColorBadge({ color }) {
    if (!color) return <Typography variant="caption" color="text.disabled">—</Typography>;
    const hex = COLOR_MAP[color?.toLowerCase()] || color;
    return (
      <Box display="flex" alignItems="center" gap={0.75}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: hex, flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }} />
        <Typography variant="caption" color="text.secondary">{color}</Typography>
      </Box>
    );
  }

  const hydroColumns = [
    { key: 'station_name', label: t('databasePage.columns.stationName'), minWidth: 180 },
    { key: 'date_on_site', label: t('databasePage.columns.dateOnSite'), minWidth: 110, render: formatDateOnly },
    { key: 'actual_level', label: t('databasePage.columns.actualLevel'), minWidth: 120 },
    { key: 'danger_level', label: t('databasePage.columns.dangerLevel'), minWidth: 120 },
    { key: 'discharge',    label: t('databasePage.columns.discharge'),   minWidth: 110 },
    { key: 'water_temp',   label: t('databasePage.columns.waterTemp'),   minWidth: 110 },
  ];

  const tabs = [
    { key: 'hecras', label: t('databasePage.tabs.hecras'), icon: <FolderIcon fontSize="small" />, rows: hecras,  columns: hecrasColumns },
    { key: 'flood',  label: t('databasePage.tabs.flood'),  icon: <WaterIcon  fontSize="small" />, rows: flood,   columns: floodColumns  },
    { key: 'layers', label: t('databasePage.tabs.layers'), icon: <LayersIcon fontSize="small" />, rows: layers,  columns: layersColumns },
    { key: 'hydro',  label: t('databasePage.tabs.hydro'),  icon: <WavesIcon  fontSize="small" />, rows: hydro
      .slice()
      .sort((a, b) => {
        const sa = String(a.station_id || '');
        const sb = String(b.station_id || '');
        if (sa !== sb) return sa.localeCompare(sb, 'ru');
        return String(b.date_on_site || '').localeCompare(String(a.date_on_site || ''), 'ru');
      }),
      columns: hydroColumns  },
  ];

  const current = tabs[tab];
  const currentRows = useMemo(() => {
    if (current.key !== 'hydro') return current.rows;
    if (!hydroTableStationFilter) return current.rows;
    return current.rows.filter((r) => String(r.station_id || '') === hydroTableStationFilter);
  }, [current, hydroTableStationFilter]);

  const hydroBarData = useMemo(() => {
    if (!hydroChart?.ok || !hydroChart.labels?.length) return null;
    return {
      labels: hydroChart.labels,
      datasets: [
        {
          label: t('databasePage.chartActual'),
          data: hydroChart.levels.map((v) => (v == null ? null : v)),
          backgroundColor: 'rgba(0, 119, 182, 0.72)',
          borderColor: 'rgba(2, 62, 138, 0.95)',
          borderWidth: 1,
        },
        {
          type: 'line',
          label: t('databasePage.chartCritical'),
          data: hydroChart.danger_levels.map((v) => (v == null ? null : v)),
          backgroundColor: 'rgba(220, 38, 38, 0.10)',
          borderColor: 'rgba(220, 38, 38, 0.95)',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 3,
          tension: 0.15,
          fill: false,
          order: 0,
        },
      ],
    };
  }, [hydroChart, t]);

  const hydroBarOptions = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
        title: { display: false },
      },
      scales: {
        x: {
          title: { display: true, text: t('databasePage.chartAxisCm'), font: { size: 11 } },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
        y: {
          ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: false },
          grid: { display: false },
        },
      },
    }),
    [t],
  );

  const hydroLineData = useMemo(() => {
    if (!hydroHistory?.ok) return null;
    const labelsSet = new Set();
    (hydroHistory.levels || []).forEach((r) => labelsSet.add(r.date));
    (hydroHistory.discharges || []).forEach((r) => labelsSet.add(r.date));
    const labels = [...labelsSet].sort();
    if (!labels.length) return null;

    const byLevel = new Map((hydroHistory.levels || []).map((r) => [r.date, r]));
    const byDischarge = new Map((hydroHistory.discharges || []).map((r) => [r.date, r]));
    const datasets = [];
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayIndex = labels.findIndex((d) => d >= todayIso);

    if (historyMetric !== 'discharge') {
      datasets.push({
        label: 'Факт. уровень, см',
        data: labels.map((d) => byLevel.get(d)?.actual_level ?? null),
        borderColor: 'rgba(0, 119, 182, 0.95)',
        backgroundColor: 'rgba(0, 119, 182, 0.15)',
        pointRadius: 2,
        tension: 0.25,
      });
      datasets.push({
        label: 'Опасный уровень, см',
        data: labels.map((d) => byLevel.get(d)?.danger_level ?? null),
        borderColor: 'rgba(220, 38, 38, 0.95)',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        pointRadius: 0,
        borderDash: [6, 4],
        tension: 0,
      });
    }
    if (historyMetric !== 'level') {
      const dischargeValues = labels.map((d) => byDischarge.get(d)?.discharge ?? null);
      const currentAndFuture = dischargeValues.filter((v) => v != null);
      const maxDischarge = currentAndFuture.length ? Math.max(...currentAndFuture) : null;
      const thresholds = maxDischarge
        ? [0.88, 0.74, 0.58, 0.46].map((k) => Math.round(maxDischarge * k))
        : [];

      const pastSeries = labels.map((_, idx) => {
        if (todayIndex < 0) return dischargeValues[idx];
        return idx <= todayIndex ? dischargeValues[idx] : null;
      });
      const futureSeries = labels.map((_, idx) => {
        if (todayIndex < 0) return null;
        return idx >= todayIndex ? dischargeValues[idx] : null;
      });

      thresholds.forEach((value, idx) => {
        const colors = ['#8B0000', '#FF3B1F', '#F08519', '#D09A0B'];
        datasets.push({
          label: idx === 0 ? 'Пороговые уровни' : undefined,
          data: labels.map(() => value),
          borderColor: colors[idx],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
        });
      });

      datasets.push({
        label: 'Расход воды, м3/с',
        data: pastSeries,
        borderColor: '#1E63CC',
        backgroundColor: 'rgba(30, 99, 204, 0.14)',
        pointRadius: 0,
        tension: 0.28,
        fill: true,
      });
      datasets.push({
        label: 'Прогноз',
        data: futureSeries,
        borderColor: '#1E63CC',
        backgroundColor: 'rgba(30, 99, 204, 0)',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.28,
        fill: false,
      });
    }
    if (!datasets.length) return null;
    return { labels, datasets, todayIndex };
  }, [historyMetric, hydroHistory]);

  const hydroHistoryCoverage = useMemo(() => {
    if (!hydroHistory?.ok) return null;
    const labelsSet = new Set();
    (hydroHistory.levels || []).forEach((r) => labelsSet.add(r.date));
    (hydroHistory.discharges || []).forEach((r) => labelsSet.add(r.date));
    const labels = [...labelsSet].sort();
    if (!labels.length) return { count: 0, minDate: null, maxDate: null };
    return {
      count: labels.length,
      minDate: labels[0],
      maxDate: labels[labels.length - 1],
    };
  }, [hydroHistory]);

  const hydroLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            filter: (item) => item.text && item.text !== 'Пороговые уровни',
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => (items?.[0] ? formatShortDate(items[0].label) : ''),
          },
        },
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { color: 'rgba(148,163,184,0.12)' },
          ticks: {
            callback: (_, idx) => formatShortDate(hydroLineData?.labels?.[idx]),
            maxTicksLimit: 7,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: historyMetric !== 'level',
            text: 'Сток (м³/с)',
          },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
      },
    }),
    [historyMetric, hydroLineData],
  );

  const nowMarkerPlugin = useMemo(
    () => ({
      id: 'hydroNowMarker',
      afterDatasetsDraw(chart) {
        const idx = hydroLineData?.todayIndex;
        if (idx == null || idx < 0) return;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        const x = xScale.getPixelForValue(idx);
        const { ctx } = chart;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#4B5563';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, yScale.top + 4);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#2F3136';
        ctx.font = '600 14px sans-serif';
        ctx.fillText('Сейчас', x + 8, yScale.top + 20);
        ctx.restore();
      },
    }),
    [hydroLineData],
  );

  return (
    <PageContainer fullHeight>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      {/* Заголовок */}
      <Box display="flex" alignItems="center" justifyContent="space-between" flexShrink={0}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 40, height: 40,
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,119,182,0.3)',
            }}
          >
            <StorageIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            {t('databasePage.title')}
          </Typography>
        </Box>
        <Tooltip title={t('databasePage.refresh')}>
          <IconButton
            onClick={loadAll}
            size="small"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              '&:hover': { borderColor: PRIMARY, bgcolor: PRIMARY_BG },
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Основная карточка */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Табы */}
        <Box
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
            px: 1,
            flexShrink: 0,
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            TabIndicatorProps={{
              style: {
                height: 3,
                borderRadius: '3px 3px 0 0',
                background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              },
            }}
          >
            {tabs.map((cfg, i) => (
              <Tab
                key={cfg.key}
                label={
                  <Box display="flex" alignItems="center" gap={0.75}>
                    <Box
                      sx={{
                        display: 'flex', alignItems: 'center',
                        color: tab === i ? PRIMARY : 'text.secondary',
                        transition: 'color 0.2s',
                      }}
                    >
                      {cfg.icon}
                    </Box>
                    <span>{cfg.label}</span>
                    {cfg.rows.length > 0 && (
                      <Box
                        sx={{
                          ml: 0.25,
                          minWidth: 20, height: 18,
                          borderRadius: '9px',
                          bgcolor: tab === i ? PRIMARY : 'rgba(100,116,139,0.12)',
                          color: tab === i ? '#fff' : 'text.secondary',
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          px: 0.6,
                          transition: 'all 0.2s',
                        }}
                      >
                        {cfg.rows.length}
                      </Box>
                    )}
                  </Box>
                }
                sx={{
                  minHeight: 52,
                  textTransform: 'none',
                  fontWeight: tab === i ? 700 : 500,
                  fontSize: '0.875rem',
                  color: tab === i ? PRIMARY : 'text.secondary',
                  '&.Mui-selected': { color: PRIMARY },
                  transition: 'color 0.2s',
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Панель: Казгидромет / ecodata + статус парсера */}
        {false && (
          <Box
            sx={{
              px: 2.5, py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: '#F8FAFC',
              flexShrink: 0,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5, mb: 1 }}>
              {t('databasePage.hydroSource')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5, mb: 1 }}>
              {t('databasePage.importCsvHint')}
            </Typography>
            <input
              ref={hydroCsvInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={onHydroCsvChange}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={hydroImportBusy ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon />}
              disabled={hydroImportBusy}
              onClick={() => hydroCsvInputRef.current?.click()}
              sx={{ mb: hydroImportMsg ? 1 : hydroStatus ? 1 : 0, textTransform: 'none', borderRadius: 2 }}
            >
              {hydroImportBusy ? t('databasePage.importing') : t('databasePage.importCsv')}
            </Button>
            {hydroImportMsg && (
              <Alert severity={hydroImportMsg.type} sx={{ py: 0.25, mb: hydroStatus ? 1 : 0 }} onClose={() => setHydroImportMsg(null)}>
                {hydroImportMsg.text}
              </Alert>
            )}
            {hydroStatus && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
            <Box display="flex" alignItems="center" gap={0.75}>
              <SensorsIcon sx={{ fontSize: 15, color: hydroStatus.scheduler_running ? '#22C55E' : '#EF4444' }} />
              <Typography variant="caption" color="text.secondary">
                {t('databasePage.scheduler')}:{' '}
                <Box component="span" sx={{ fontWeight: 700, color: hydroStatus.scheduler_running ? '#15803D' : '#B91C1C' }}>
                  {hydroStatus.scheduler_running ? t('databasePage.schedulerOn') : t('databasePage.schedulerOff')}
                </Box>
              </Typography>
            </Box>
            {hydroStatus.last_run && (
              <Typography variant="caption" color="text.secondary">
                {t('databasePage.lastScrape')}: <Box component="span" sx={{ fontWeight: 600 }}>{fmtDate(hydroStatus.last_run)}</Box>
              </Typography>
            )}
            {hydroStatus.next_run && (
              <Typography variant="caption" color="text.secondary">
                {t('databasePage.nextScrape')}: <Box component="span" sx={{ fontWeight: 600 }}>{fmtDate(hydroStatus.next_run)}</Box>
              </Typography>
            )}
            {hydroStatus.is_scraping && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <CircularProgress size={12} sx={{ color: PRIMARY }} />
                <Typography variant="caption" sx={{ color: PRIMARY, fontWeight: 600 }}>{t('databasePage.scraping')}</Typography>
              </Box>
            )}
            <Tooltip title={t('databasePage.triggerNow')}>
              <IconButton
                size="small"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    await fetch('/api/hydro-stations/trigger', {
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    setTimeout(() => {
                      loadHydroStatus();
                      loadHydroChart();
                    }, 1000);
                  } catch {}
                }}
                sx={{
                  ml: 'auto', width: 26, height: 26,
                  border: '1px solid', borderColor: 'divider',
                  bgcolor: 'background.paper',
                  '&:hover': { borderColor: PRIMARY, bgcolor: PRIMARY_BG },
                }}
              >
                <RefreshIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
              </Box>
            )}
          </Box>
        )}

        {false && (
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: '#F8FAFC',
              flexShrink: 0,
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.25 }}>
              График по гидропосту (линейный)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 1.5 }}>
              <TextField
                select
                size="small"
                label="Гидропост"
                SelectProps={{ native: true }}
                value={selectedHydroStation}
                onChange={(e) => setSelectedHydroStation(e.target.value)}
                sx={{ minWidth: 260 }}
              >
                {hydroStations.map((s) => (
                  <option key={s.id} value={s.id}>{`${s.id} - ${s.name}`}</option>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Данные"
                SelectProps={{ native: true }}
                value={historyMetric}
                onChange={(e) => setHistoryMetric(e.target.value)}
                sx={{ minWidth: 190 }}
              >
                <option value="level">Уровень воды</option>
                <option value="discharge">Расход воды</option>
                <option value="both">Оба параметра</option>
              </TextField>
              <TextField
                size="small"
                type="date"
                label="С даты"
                InputLabelProps={{ shrink: true }}
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="По дату"
                InputLabelProps={{ shrink: true }}
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={loadHydroHistory}
                disabled={hydroHistoryLoading || !selectedHydroStation}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {hydroHistoryLoading ? 'Загрузка...' : 'Показать'}
              </Button>
            </Box>

            {hydroHistoryError && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {`Не удалось загрузить историю: ${hydroHistoryError}`}
              </Alert>
            )}

            {!hydroHistoryError && hydroHistoryCoverage?.count > 0 && (
              <Alert severity={hydroHistoryCoverage.count === 1 ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
                {hydroHistoryCoverage.count === 1
                  ? `В выбранном диапазоне найдена только 1 дата (${formatShortDate(hydroHistoryCoverage.minDate)}).`
                  : `Найдено ${hydroHistoryCoverage.count} дат: ${formatShortDate(hydroHistoryCoverage.minDate)} - ${formatShortDate(hydroHistoryCoverage.maxDate)}.`}
              </Alert>
            )}

            {hydroLineData ? (
              <Box sx={{ height: 340 }}>
                <Line data={hydroLineData} options={hydroLineOptions} plugins={[nowMarkerPlugin]} />
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Нет данных за выбранный диапазон дат.
              </Typography>
            )}
          </Box>
        )}

        {current.key === 'hydro' && (
          <Box
            sx={{
              px: 2.5,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: '#F8FAFC',
              flexShrink: 0,
            }}
          >
            <TextField
              select
              size="small"
              label="Гидропост"
              SelectProps={{ native: true }}
              value={hydroTableStationFilter}
              onChange={(e) => setHydroTableStationFilter(e.target.value)}
              sx={{ minWidth: 320 }}
            >
              <option value="">Все гидропосты</option>
              {hydroStations.map((s) => (
                <option key={s.id} value={s.id}>{`${s.id} - ${s.name}`}</option>
              ))}
            </TextField>
          </Box>
        )}

        <DataTable
          columns={current.columns}
          rows={currentRows}
          loading={loadingMap[current.key]}
          error={errorMap[current.key]}
          noDataMsg={t('databasePage.noData')}
        />
      </Paper>
      </Box>
    </PageContainer>
  );
}
