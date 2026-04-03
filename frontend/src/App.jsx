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

const Profile          = React.lazy(() => import('./pages/Profile'));
const HecRasProjects   = React.lazy(() => import('./pages/HecRasProjects'));
const HecRasViewer     = React.lazy(() => import('./pages/HecRasViewer'));
const LayersWindow     = React.lazy(() => import('./pages/LayersWindow'));
const DrawLayer        = React.lazy(() => import('./pages/DrawLayer'));
const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const FloodModelingPage = React.lazy(() => import('./pages/FloodModelingPage'));
const DTMFilterPage    = React.lazy(() => import('./pages/DTMFilterPage'));
const TerrainMap       = React.lazy(() => import('./pages/TerrainMap'));
const Instruction      = React.lazy(() => import('./pages/Instruction'));
const Information      = React.lazy(() => import('./pages/Information'));
const Database         = React.lazy(() => import('./pages/Database'));
const Weather          = React.lazy(() => import('./pages/Weather'));

const PageFallback = (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <CircularProgress />
  </Box>
);

export default function App() {
  const { t } = useTranslation();
  return (
    <Layout>
      <Suspense fallback={PageFallback}>
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
                <HecRasViewer />
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

        {/* Карта станций мониторинга */}
        <Route 
          path="stations" 
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

        {/* Всё остальное → на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
