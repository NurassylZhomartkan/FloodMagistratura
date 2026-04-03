// frontend/src/pages/ForgotPassword.jsx

import React, { useState, useCallback } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Link as MuiLink,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthIllustration from '../components/AuthIllustration';
import { usePageTitle } from '../utils/usePageTitle';

export default function ForgotPassword() {
  const { t } = useTranslation();
  usePageTitle('pageTitles.forgotPassword');

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((e) => {
    setEmail(e.target.value);
    setError('');
    setMessage('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!email) {
      setError(t('forgotPassword.emailRequired'));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(t('forgotPassword.success'));
      } else {
        setError(data.detail || t('forgotPassword.error'));
      }
    } catch (err) {
      console.error('Ошибка при запросе восстановления пароля:', err);
      setError(t('forgotPassword.serverError'));
    } finally {
      setLoading(false);
    }
  }, [email, t]);

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        bgcolor: "background.default",
      }}
    >
      {/* Левая часть - форма */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {/* Логотип/Название */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "1.2rem",
              }}
            >
              F
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                letterSpacing: "-0.5px",
              }}
            >
              FloodSite
            </Typography>
          </Box>

          {/* Заголовок */}
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                mb: 1,
              }}
            >
              {t('forgotPassword.title')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                fontSize: "1rem",
              }}
            >
              {t('forgotPassword.description')}
            </Typography>
          </Box>

          {/* Форма */}
          {!message ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                fullWidth
                label={t('forgotPassword.email')}
                name="email"
                type="email"
                value={email}
                onChange={handleChange}
                error={Boolean(error)}
                helperText={error}
                disabled={loading}
                variant="outlined"
              />

              {/* Кнопка Submit */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ py: '12px', mt: 1 }}
              >
                {loading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
              </Button>

              {/* Ссылка на вход */}
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <MuiLink
                  component={Link}
                  to="/login"
                  sx={{
                    color: "primary.main",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  {t('forgotPassword.backToLogin')}
                </MuiLink>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography
                sx={{
                  color: "success.main",
                  fontSize: "1rem",
                  textAlign: "center",
                  mb: 3,
                  padding: 2,
                  bgcolor: "success.light",
                  borderRadius: "12px",
                  border: 1,
                  borderColor: "success.main",
                }}
              >
                {message}
              </Typography>
              <Box sx={{ textAlign: "center" }}>
                <Link to="/login" style={{ textDecoration: "none" }}>
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ py: '12px', mt: 1 }}
                  >
                    {t('forgotPassword.backToLogin')}
                  </Button>
                </Link>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Правая часть - иллюстрация */}
      <Box
        sx={{
          flex: 1,
          display: { xs: "none", md: "flex" },
        }}
      >
        <AuthIllustration />
      </Box>
    </Box>
  );
}
