// src/App.jsx
// -------------------------------------------------------
// Главная страница приложения.
// Показывает приветственный текст «Добро пожаловать»
// и оборачивает всё содержимое в Sidebar (каркас с кнопками).
// -------------------------------------------------------

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Typography } from '@mui/material';

import Sidebar        from './components/page/Sidebar';
import Profile        from './components/page/Profile';
import HecRasProjects from './components/page/HecRasProjects';
import HecRasViewer   from './components/page/HecRasViewer';

export default function App() {
  return (
    <Sidebar>
      <Routes>
        {/* Главная (index) — приветствие */}
        <Route
          index
          element={
            <Typography variant="h3" sx={{ p: 2 }}>
              Добро пожаловать
            </Typography>
          }
        />

        {/* Страницы HEC‑RAS */}
        <Route
          path="hec-ras/upload"
          element={
            <Typography variant="h4" sx={{ p: 2 }}>
              Страница загрузки нового проекта
            </Typography>
          }
        />
        <Route path="hec-ras"              element={<HecRasProjects />} />
        <Route path="hec-ras/:projectHash" element={<HecRasViewer  />} />

        {/* Профиль пользователя */}
        <Route path="profile" element={<Profile />} />

        {/* Всё остальное → на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Sidebar>
  );
}
