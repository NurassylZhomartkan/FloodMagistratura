import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'

// Импортируем утилиты для подавления ошибок ДО импорта других компонентов
import './utils/suppressChromeExtensionErrors'
import './utils/suppressMapboxErrors'

import { ThemeProvider } from '@mui/material/styles'
import theme from './theme'

import PrivateRoute from './components/auth/PrivateRoute'
import PublicRoute  from './components/auth/PublicRoute'

import './styles/index.css'
import { I18nextProvider } from 'react-i18next'
import i18n from './config/i18n'
import { registerMapCacheServiceWorker } from './utils/mapCache'

const App              = React.lazy(() => import('./App'))
const Login            = React.lazy(() => import('./pages/Login'))
const Register         = React.lazy(() => import('./pages/Register'))
const VerifyEmail      = React.lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword   = React.lazy(() => import('./pages/ForgotPassword'))
const ResetPassword    = React.lazy(() => import('./pages/ResetPassword'))
const HecRasSharedViewer = React.lazy(() => import('./pages/HecRasSharedViewer'))
const FloodSharedViewer  = React.lazy(() => import('./pages/FloodSharedViewer'))

// Регистрируем Service Worker для кэширования тайлов карты
if (import.meta.env.PROD) {
  registerMapCacheServiceWorker().catch((error) => {
    console.warn('Не удалось зарегистрировать Service Worker для кэширования карты:', error)
  })
}

ReactDOM
  .createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              <CircularProgress />
            </Box>
          }>
            <Routes>
              {/* корень → логин */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Публичные маршруты - перенаправляют авторизованных пользователей на /app */}
              <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/verify-email"    element={<PublicRoute><VerifyEmail /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/reset-password"  element={<PublicRoute><ResetPassword /></PublicRoute>} />

              {/* Публичный доступ к проектам HEC-RAS по share_hash (без авторизации и Layout) */}
              <Route path="/app/hec-ras/shared/:shareHash" element={<HecRasSharedViewer />} />

              {/* Публичный доступ к flood проектам по share_hash (без авторизации и Layout) */}
              <Route path="/app/flood/shared/:shareHash" element={<FloodSharedViewer />} />

              {/* всё под /app/* — через PrivateRoute */}
              <Route path="/app/*" element={<PrivateRoute><App /></PrivateRoute>} />

              {/* иначе → на корень */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </I18nextProvider>
      </ThemeProvider>
    </React.StrictMode>
  )
