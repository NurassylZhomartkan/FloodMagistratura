// src/components/page/Dashboard.jsx
// -------------------------------------------------------
// Главная страница с дашбордами:
// - Активные зоны подтопления
// - Площадь/население в зоне риска
// - Критические объекты
// -------------------------------------------------------

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import HomeIcon from '@mui/icons-material/Home';
import SchoolIcon from '@mui/icons-material/School';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import FactoryIcon from '@mui/icons-material/Factory';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import PublicIcon from '@mui/icons-material/Public';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import InfoIcon from '@mui/icons-material/Info';
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// Хук для анимации чисел от 0 до целевого значения
const useAnimatedNumber = (targetValue, duration = 2000, decimals = 0) => {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    if (typeof targetValue !== 'number') {
      setCurrentValue(targetValue);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;
    const endValue = targetValue;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Используем easing функцию для плавной анимации
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const newValue = startValue + (endValue - startValue) * easeOutQuart;
      setCurrentValue(newValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrentValue(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  // Форматируем число с нужным количеством знаков после запятой
  if (typeof currentValue !== 'number') {
    return currentValue;
  }

  if (decimals === 0) {
    return Math.round(currentValue);
  }

  return parseFloat(currentValue.toFixed(decimals));
};

// Компонент для отображения анимированного числа
const AnimatedNumber = ({ value, decimals = 0, suffix = '', prefix = '', formatNumber = null, showSign = false }) => {
  const animatedValue = useAnimatedNumber(value, 2000, decimals);
  
  if (formatNumber) {
    return <>{formatNumber(animatedValue)}</>;
  }

  if (typeof animatedValue === 'number') {
    let formattedValue;
    if (decimals === 0) {
      formattedValue = Math.round(animatedValue).toLocaleString('ru-RU');
    } else {
      formattedValue = animatedValue.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    
    // Добавляем знак "+" для положительных чисел, если нужно
    if (showSign && animatedValue > 0) {
      return <>{prefix}+{formattedValue}{suffix}</>;
    }
    
    return <>{prefix}{formattedValue}{suffix}</>;
  }

  return <>{prefix}{animatedValue}{suffix}</>;
};

// Рандомные данные (временно)
const getRandomData = () => ({
  currentStatus: {
    avgWaterLevel: 2.4,
    feelsLike: 2.4,
    change24h: 0.3,
    maxLevel: 3.8,
    minLevel: 0.5,
    precipitation: 45.2,
    criticalZones: 2,
    activeZones: 4,
  },
  activeZones: 4,
  totalArea: 247.5,
  populationAtRisk: 18450,
  avgWaterLevel: 2.4,
  maxWaterLevel: 3.8,
  currentVelocity: 1.5,
  timeToPeak: 6,
  criticalObjects: 12,
  affectedBuildings: 342,
  waterRiseRate: 0.15,
  activeZonesList: [
    { id: 1, name: 'Зона А (Северный район)', status: 'Критическая', level: 'Высокий', waterLevel: 3.2 },
    { id: 2, name: 'Зона Б (Центральный район)', status: 'Активная', level: 'Средний', waterLevel: 1.8 },
    { id: 3, name: 'Зона В (Южный район)', status: 'Активная', level: 'Низкий', waterLevel: 0.9 },
    { id: 4, name: 'Зона Г (Восточный район)', status: 'Мониторинг', level: 'Низкий', waterLevel: 0.5 },
  ],
  criticalObjectsList: [
    { id: 1, name: 'Больница №3', type: 'hospital', zone: 'Зона А', status: 'Под угрозой' },
    { id: 2, name: 'Школа №12', type: 'school', zone: 'Зона А', status: 'Под угрозой' },
    { id: 3, name: 'Завод "Стройматериалы"', type: 'factory', zone: 'Зона Б', status: 'Мониторинг' },
    { id: 4, name: 'Жилой комплекс "Восток"', type: 'residential', zone: 'Зона Б', status: 'Под угрозой' },
  ],
});

const getStatusColor = (status) => {
  switch (status) {
    case 'Критическая':
    case 'Под угрозой':
      return 'error';
    case 'Активная':
      return 'warning';
    case 'Мониторинг':
      return 'info';
    default:
      return 'default';
  }
};

const getObjectIcon = (type) => {
  switch (type) {
    case 'hospital':
      return <LocalHospitalIcon />;
    case 'school':
      return <SchoolIcon />;
    case 'factory':
      return <FactoryIcon />;
    case 'residential':
      return <HomeIcon />;
    default:
      return <LocationOnIcon />;
  }
};

// Компонент маленькой карточки метрики
const SmallMetricCard = ({ icon: Icon, title, value, unit, description, iconColor = '#2196f3', animateValue = true, decimals = 0 }) => {
  // Если value уже является строкой (например, форматированное число), не анимируем
  const shouldAnimate = animateValue && typeof value === 'number';
  
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        bgcolor: 'white',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Icon sx={{ fontSize: 28, color: iconColor, mr: 1 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.5 }}>
            {title}
          </Typography>
        </Box>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 'bold', 
            mb: 0.5,
            color: 'text.primary',
            fontSize: { xs: '1.75rem', sm: '2rem' }
          }}
        >
          {shouldAnimate ? (
            <AnimatedNumber value={value} decimals={decimals} />
          ) : (
            value
          )}
          {unit && (
            <Typography component="span" variant="body1" sx={{ ml: 0.5, fontWeight: 'normal' }}>
              {unit}
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.dashboard');
  const data = getRandomData();
  const status = data.currentStatus;

  const [showInstructionDialog, setShowInstructionDialog] = useState(false);

  useEffect(() => {
    // Проверяем, был ли это первый вход пользователя
    const hasSeenPrompt = localStorage.getItem('hasSeenInstructionPrompt');
    
    if (!hasSeenPrompt) {
      // Показываем диалог при первом входе
      setShowInstructionDialog(true);
    }
  }, []);

  const handleOpenInstruction = () => {
    // Сохраняем флаг, что пользователь видел предложение
    localStorage.setItem('hasSeenInstructionPrompt', 'true');
    setShowInstructionDialog(false);
    // Перенаправляем на страницу инструкций
    navigate('/app/instruction');
  };

  const handleCloseDialog = () => {
    // Сохраняем флаг, что пользователь видел предложение
    localStorage.setItem('hasSeenInstructionPrompt', 'true');
    setShowInstructionDialog(false);
  };

  return (
    <PageContainer>
      <Box sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
          {t('pageTitles.dashboard')}
        </Typography>
        <Grid container spacing={1.5} sx={{ flexGrow: 1 }}>
        {/* Большая карточка слева - Основная сводка */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex' }}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              bgcolor: 'white',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box>
                  <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 0.5, color: 'text.primary' }}>
                    <AnimatedNumber value={status.avgWaterLevel} decimals={1} suffix={t('dashboard.m')} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('dashboard.averageWaterLevel')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.feelsLike')}: <AnimatedNumber value={status.feelsLike} decimals={1} suffix={t('dashboard.m')} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('dashboard.change24h')}: <AnimatedNumber value={status.change24h} decimals={1} suffix={t('dashboard.m')} showSign={true} />
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 1 }}>
                    <WaterDropIcon sx={{ fontSize: 40, color: '#2196f3', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {t('dashboard.flooding')}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.max')}: <AnimatedNumber value={status.maxLevel} decimals={1} suffix={t('dashboard.m')} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.min')}: <AnimatedNumber value={status.minLevel} decimals={1} suffix={t('dashboard.m')} />
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 1.5 }} />

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <WarningIcon sx={{ fontSize: 18, color: 'error.main', mr: 0.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('dashboard.criticalZones')}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      <AnimatedNumber value={status.criticalZones} />
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <LocationOnIcon sx={{ fontSize: 18, color: 'warning.main', mr: 0.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('dashboard.activeZones')}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      <AnimatedNumber value={status.activeZones} />
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <TrendingUpIcon sx={{ fontSize: 18, color: 'info.main', mr: 0.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('dashboard.precipitation')}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      <AnimatedNumber value={status.precipitation} decimals={1} suffix={t('dashboard.mm')} />
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Большая карточка справа - Детальная информация */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              bgcolor: 'white',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                {t('dashboard.activeZones')}
              </Typography>
              <List sx={{ pt: 0 }}>
                {data.activeZonesList.slice(0, 3).map((zone, index) => (
                  <React.Fragment key={zone.id}>
                    <ListItem sx={{ px: 0, py: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <LocationOnIcon sx={{ color: getStatusColor(zone.status) === 'error' ? 'error.main' : 'warning.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {zone.name.split(' ')[1]} {zone.name.split(' ')[2]}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}
                            component="div"
                          >
                            <Typography variant="caption" color="text.secondary">
                              <AnimatedNumber value={zone.waterLevel} decimals={1} suffix=" м" />
                            </Typography>
                            <Chip
                              label={zone.status}
                              size="small"
                              color={getStatusColor(zone.status)}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                        secondaryTypographyProps={{
                          component: 'div',
                        }}
                      />
                    </ListItem>
                    {index < 2 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              <Box sx={{ mt: 'auto', pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.showAllZones')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Сетка из 8 маленьких карточек метрик */}
        <Grid size={{ xs: 12 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={WarningIcon}
                title={t('dashboard.activeZones')}
                value={data.activeZones}
                description={t('dashboard.zonesUnderMonitoring')}
                iconColor="#f44336"
                decimals={0}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={PublicIcon}
                title={t('dashboard.riskArea')}
                value={data.totalArea}
                unit={t('dashboard.km2')}
                description={t('dashboard.riskAreaDescription')}
                iconColor="#ff9800"
                decimals={1}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={PeopleIcon}
                title={t('dashboard.population')}
                value={data.populationAtRisk}
                description={t('dashboard.populationDescription')}
                iconColor="#f44336"
                decimals={0}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={HomeIcon}
                title={t('dashboard.buildings')}
                value={data.affectedBuildings}
                description={t('dashboard.buildingsDescription')}
                iconColor="#2196f3"
                decimals={0}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={WaterDropIcon}
                title={t('dashboard.waterLevel')}
                value={data.avgWaterLevel}
                unit={t('dashboard.m')}
                description={t('dashboard.waterLevelDescription')}
                iconColor="#00bcd4"
                decimals={1}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={TrendingUpIcon}
                title={t('dashboard.maxLevel')}
                value={data.maxWaterLevel}
                unit={t('dashboard.m')}
                description={t('dashboard.maxLevelDescription')}
                iconColor="#f44336"
                decimals={1}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={SpeedIcon}
                title={t('dashboard.currentVelocity')}
                value={data.currentVelocity}
                unit={t('dashboard.ms')}
                description={t('dashboard.currentVelocityDescription')}
                iconColor="#ff9800"
                decimals={1}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <SmallMetricCard
                icon={AccessTimeIcon}
                title={t('dashboard.timeToPeak')}
                value={data.timeToPeak}
                unit={t('dashboard.h')}
                description={t('dashboard.timeToPeakDescription')}
                iconColor="#00bcd4"
                decimals={0}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Детальная информация о критических объектах */}
        <Grid size={{ xs: 12 }}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              bgcolor: 'white',
              width: '100%',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <WarningIcon sx={{ fontSize: 28, color: 'error.main', mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {t('dashboard.criticalObjects')} (<AnimatedNumber value={data.criticalObjects} />)
                </Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Grid container spacing={1.5}>
                {data.criticalObjectsList.map((obj) => (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={obj.id}>
                    <Box
                      sx={{
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {getObjectIcon(obj.type)}
                        <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>
                          {obj.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {obj.zone}
                      </Typography>
                      <Chip
                        label={obj.status}
                        size="small"
                        color={getStatusColor(obj.status)}
                        sx={{ height: 20 }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </Box>

      {/* Диалог для первого входа */}
      <Dialog
        open={showInstructionDialog}
        onClose={handleCloseDialog}
        aria-labelledby="instruction-dialog-title"
        aria-describedby="instruction-dialog-description"
      >
        <DialogTitle id="instruction-dialog-title">
          {t('dashboard.instructionDialog.title', 'Добро пожаловать!')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="instruction-dialog-description">
            {t('dashboard.instructionDialog.message', 'Хотите открыть страницу с инструкциями?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            {t('dashboard.instructionDialog.cancel', 'Позже')}
          </Button>
          <Button onClick={handleOpenInstruction} color="primary" variant="contained" autoFocus>
            {t('dashboard.instructionDialog.open', 'Открыть инструкции')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
