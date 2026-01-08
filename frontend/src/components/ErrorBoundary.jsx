// frontend/src/components/ErrorBoundary.jsx
// Компонент для изоляции ошибок на уровне страниц

import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

class ErrorBoundaryClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Обновляем состояние, чтобы показать UI с ошибкой
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Логируем ошибку для отладки
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Если передан обработчик сброса, вызываем его
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.handleReset();
    if (this.props.onNavigate) {
      this.props.onNavigate('/app');
    } else if (window.location) {
      window.location.href = '/app';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallbackWrapper
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

// Функциональный компонент для UI, который может использовать хуки
function ErrorFallbackWrapper({ error, errorInfo, onReset, onGoHome }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoHome = () => {
    onReset();
    navigate('/app');
  };

  return (
    <ErrorFallbackUI
      error={error}
      errorInfo={errorInfo}
      onReset={onReset}
      onGoHome={onGoHome || handleGoHome}
      t={t}
    />
  );
}

// Чистый компонент UI без хуков
function ErrorFallbackUI({ error, errorInfo, onReset, onGoHome, t }) {
  // Используем переданную функцию перевода
  const title = t('errorBoundary.title');
  const message = t('errorBoundary.message');
  const errorDetails = t('errorBoundary.errorDetails');
  const goHomeText = t('errorBoundary.goHome');
  const retryText = t('errorBoundary.retry');

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 2,
        backgroundColor: '#f5f5f5'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          maxWidth: 600,
          width: '100%'
        }}
      >
        <Typography variant="h4" gutterBottom color="error">
          {title}
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 3 }}>
          {message}
        </Typography>
        
        {process.env.NODE_ENV === 'development' && error && (
          <Box
            sx={{
              mt: 2,
              mb: 3,
              padding: 2,
              backgroundColor: '#ffebee',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 300
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {errorDetails}
            </Typography>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {error.toString()}
              {errorInfo && errorInfo.componentStack && (
                <>
                  {'\n\n'}
                  {errorInfo.componentStack}
                </>
              )}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={onGoHome}
            sx={{ flex: 1 }}
          >
            {goHomeText}
          </Button>
          <Button
            variant="outlined"
            onClick={onReset}
            sx={{ flex: 1 }}
          >
            {retryText}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

// Обертка для использования с хуками
export default function ErrorBoundary({ children, onReset, onNavigate }) {
  return (
    <ErrorBoundaryClass onReset={onReset} onNavigate={onNavigate}>
      {children}
    </ErrorBoundaryClass>
  );
}

