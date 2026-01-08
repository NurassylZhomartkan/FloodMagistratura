// src/App.jsx
// -------------------------------------------------------
// Главная страница приложения.
// Использует Layout компонент для полноэкранной структуры
// с Header, Sidebar и областью контента.
// -------------------------------------------------------

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Typography, Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

import Layout        from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Profile        from './pages/Profile';
import HecRasProjects from './pages/HecRasProjects';
import MapContentDebug from './pages/MapContentDebug';
import LayersWindow   from './pages/LayersWindow';
import DrawLayer      from './pages/DrawLayer';
import Dashboard      from './pages/Dashboard';
import FloodModelingPage from './pages/FloodModelingPage';
import DTMFilterPage from './pages/DTMFilterPage';
import TerrainMap from './pages/TerrainMap';
import Instruction from './pages/Instruction';
import Information from './pages/Information';
import Database from './pages/Database';
import Weather from './pages/Weather';

// Ленивая загрузка HecRasViewer, чтобы он не выполнялся на странице /app/flood
const HecRasViewer = React.lazy(() => import('./pages/HecRasViewer'));

export default function App() {
  const { t } = useTranslation();
  return (
    <Layout>
      <Routes>
        {/* Главная (index) — дашборд */}
        <Route 
          index 
          element={
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          } 
        />

        {/* Страницы HEC‑RAS */}
        <Route
          path="hec-ras/upload"
          element={
            <ErrorBoundary>
              <Typography variant="h4" sx={{ p: 2 }}>
                {t('app.uploadNewProjectPage')}
              </Typography>
            </ErrorBoundary>
          }
        />
        <Route 
          path="hec-ras" 
          element={
            <ErrorBoundary>
              <HecRasProjects />
            </ErrorBoundary>
          } 
        />
        <Route 
          path="hec-ras/:projectHash" 
          element={
            <ErrorBoundary>
              <Box sx={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%', 
                height: '100%', 
                margin: 0,
                padding: 0,
                overflow: 'hidden'
              }}>
                <Suspense fallback={
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%' 
                  }}>
                    <CircularProgress />
                  </Box>
                }>
                  <HecRasViewer />
                </Suspense>
              </Box>
            </ErrorBoundary>
          } 
        />

        {/* Профиль пользователя */}
        <Route 
          path="profile" 
          element={
            <ErrorBoundary>
              <Profile />
            </ErrorBoundary>
          } 
        />

        {/* Управление слоями */}
        <Route 
          path="layers" 
          element={
            <ErrorBoundary>
              <LayersWindow />
            </ErrorBoundary>
          } 
        />
        <Route 
          path="layers/draw" 
          element={
            <ErrorBoundary>
              <DrawLayer />
            </ErrorBoundary>
          } 
        />

        {/* Моделирование наводнений */}
        <Route 
          path="flood" 
          element={
            <ErrorBoundary>
              <FloodModelingPage />
            </ErrorBoundary>
          }
        />

        {/* DTM Filter Tool */}
        <Route 
          path="dtm-filter" 
          element={
            <ErrorBoundary>
              <DTMFilterPage />
            </ErrorBoundary>
          }
        />

        {/* Карта с рельефом */}
        <Route 
          path="terrain-map" 
          element={
            <ErrorBoundary>
              <TerrainMap />
            </ErrorBoundary>
          }
        />

        {/* Страница инструкций */}
        <Route 
          path="instruction" 
          element={
            <ErrorBoundary>
              <Instruction />
            </ErrorBoundary>
          }
        />

        {/* Информационная страница */}
        <Route 
          path="information" 
          element={
            <ErrorBoundary>
              <Information />
            </ErrorBoundary>
          }
        />

        {/* Страница базы данных */}
        <Route 
          path="database" 
          element={
            <ErrorBoundary>
              <Database />
            </ErrorBoundary>
          }
        />

        {/* Страница погоды */}
        <Route 
          path="weather" 
          element={
            <ErrorBoundary>
              <Weather />
            </ErrorBoundary>
          }
        />

        {/* Отладка содержимого карты */}
        <Route 
          path="hec-ras/:projectHash/debug" 
          element={
            <ErrorBoundary>
              <MapContentDebug />
            </ErrorBoundary>
          } 
        />

        {/* Всё остальное → на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
