// frontend/src/pages/HecRasSharedViewer.jsx
// Публичный просмотр HEC-RAS проекта по share_hash (без Layout, sidebar и appbar)

import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, TextField, Alert } from '@mui/material';
import BaseModal from '../components/BaseModal';
import { useTranslation } from 'react-i18next';
import ErrorBoundary from '../components/ErrorBoundary';

// Ленивая загрузка HecRasViewer
const HecRasViewer = React.lazy(() => import('./HecRasViewer'));

export default function HecRasSharedViewer() {
  const { t } = useTranslation();
  const { shareHash } = useParams();
  const navigate = useNavigate();
  const [projectId, setProjectId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [passwordRequired, setPasswordRequired] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [verifyingPassword, setVerifyingPassword] = React.useState(false);

  React.useEffect(() => {
    // Проверяем, требуется ли пароль
    const checkPassword = async () => {
      try {
        const infoRes = await fetch(`/api/hec-ras/shared/${shareHash}/info`);
        if (!infoRes.ok) {
          if (infoRes.status === 404) {
            setError(t('hecRasSharedViewer.projectNotFound'));
          } else {
            setError(t('hecRasSharedViewer.loadError'));
          }
          setLoading(false);
          return;
        }
        const info = await infoRes.json();
        
        if (info.has_password) {
          // Требуется пароль
          setPasswordRequired(true);
          setLoading(false);
        } else {
          // Пароль не требуется, загружаем проект
          loadProject();
        }
      } catch (err) {
        console.error('Error checking password requirement:', err);
        setError(t('hecRasSharedViewer.loadError'));
        setLoading(false);
      }
    };

    // Загружаем проект по share_hash
    const loadProject = async (providedPassword = null) => {
      try {
        let url = `/api/hec-ras/shared/${shareHash}`;
        if (providedPassword) {
          url += `?password=${encodeURIComponent(providedPassword)}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 403) {
            // Требуется пароль
            setPasswordRequired(true);
            setLoading(false);
            return;
          } else if (res.status === 401) {
            // Неверный пароль
            setPasswordError(t('hecRasSharedViewer.wrongPassword'));
            setVerifyingPassword(false);
            return;
          } else if (res.status === 404) {
            setError(t('hecRasSharedViewer.projectNotFound'));
          } else {
            setError(t('hecRasSharedViewer.loadError'));
          }
          setLoading(false);
          return;
        }
        const project = await res.json();
        setProjectId(project.id);
        setPasswordRequired(false);
        setLoading(false);
      } catch (err) {
        console.error('Error loading shared project:', err);
        setError(t('hecRasSharedViewer.loadError'));
        setLoading(false);
      }
    };

    if (shareHash) {
      checkPassword();
    } else {
      setError(t('hecRasSharedViewer.shareHashNotProvided'));
      setLoading(false);
    }
  }, [shareHash, t]);

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setPasswordError(t('hecRasSharedViewer.enterPassword'));
      return;
    }
    
    setPasswordError('');
    setVerifyingPassword(true);
    
    try {
      const res = await fetch(`/api/hec-ras/shared/${shareHash}?password=${encodeURIComponent(password)}`);
      if (!res.ok) {
        if (res.status === 401) {
          setPasswordError(t('hecRasSharedViewer.wrongPassword'));
          setVerifyingPassword(false);
          return;
        } else {
          setPasswordError(t('hecRasSharedViewer.passwordCheckError'));
          setVerifyingPassword(false);
          return;
        }
      }
      const project = await res.json();
      setProjectId(project.id);
      setPasswordRequired(false);
      setVerifyingPassword(false);
    } catch (err) {
      console.error('Error verifying password:', err);
      setPasswordError(t('hecRasSharedViewer.passwordCheckError'));
      setVerifyingPassword(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        width: '100vw'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        width: '100vw',
        gap: 2
      }}>
        <Typography variant="h5" color="error">
          {error}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('hecRasSharedViewer.checkLinkMessage')}
        </Typography>
      </Box>
    );
  }

  if (passwordRequired) {
    return (
      <BaseModal
        open={true}
        onClose={() => navigate('/')}
        title={t('hecRasSharedViewer.passwordRequired')}
        confirmText={verifyingPassword ? t('hecRasSharedViewer.verifying') : t('hecRasSharedViewer.signIn')}
        onConfirm={handlePasswordSubmit}
        confirmLoading={verifyingPassword}
        confirmDisabled={!password.trim()}
        cancelText={t('common.cancel')}
        onCancel={() => navigate('/')}
      >
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t('hecRasSharedViewer.passwordRequiredDescription')}
        </Typography>
        <TextField
          fullWidth
          type="password"
          label={t('hecRasSharedViewer.password')}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError('');
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handlePasswordSubmit();
            }
          }}
          error={!!passwordError}
          helperText={passwordError}
          disabled={verifyingPassword}
          autoFocus
        />
        {passwordError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setPasswordError('')}>
            {passwordError}
          </Alert>
        )}
      </BaseModal>
    );
  }

  if (!projectId) {
    return null;
  }

  return (
    <ErrorBoundary>
      <Box sx={{ 
        position: 'fixed',
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
          <HecRasViewer projectHash={projectId} shareHash={shareHash} />
        </Suspense>
      </Box>
    </ErrorBoundary>
  );
}
