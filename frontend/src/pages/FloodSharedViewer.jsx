// frontend/src/pages/FloodSharedViewer.jsx
// Публичный просмотр flood проекта по share_hash

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import MapView from '../components/flood/MapView';

export default function FloodSharedViewer() {
  const { t } = useTranslation();
  const { shareHash } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectData, setProjectData] = useState(null);

  useEffect(() => {
    const loadSharedProject = async () => {
      if (!shareHash) {
        setError(t('floodSharedViewer.shareHashNotProvided'));
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/flood/shared/${shareHash}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError(t('floodSharedViewer.projectNotFound'));
          } else {
            setError(t('floodSharedViewer.loadError'));
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        setProjectData(data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading shared project:', err);
        setError(t('floodSharedViewer.loadError'));
        setLoading(false);
      }
    };

    loadSharedProject();
  }, [shareHash, t]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography>{t('floodSharedViewer.loading')}</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 2,
          p: 3,
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // Передаем данные проекта в MapView через props
  // MapView должен автоматически загрузить файлы и применить параметры
  return (
    <Box sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: '#000'
    }}>
      <MapView sharedProjectData={projectData} shareHash={shareHash} />
    </Box>
  );
}

