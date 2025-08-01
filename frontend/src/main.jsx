import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import App          from './App'
import Login        from './pages/Login'
import Register     from './pages/Register'
import PrivateRoute from './components/PrivateRoute'

import './index.css'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'

ReactDOM
  .createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <Routes>
            {/* корень → логин */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login"    element={<Login    />} />
            <Route path="/register" element={<Register />} />

            {/* всё под /app/* — через PrivateRoute */}
            <Route
              path="/app/*"
              element={
                <PrivateRoute>
                  <App />
                </PrivateRoute>
              }
            />

            {/* иначе → на корень */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </I18nextProvider>
    </React.StrictMode>
  )
