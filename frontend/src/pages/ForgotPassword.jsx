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

  const inputStyles = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px",
      backgroundColor: "#F9FAFB",
      "& fieldset": {
        borderColor: "#E5E7EB",
      },
      "&:hover fieldset": {
        borderColor: "#6366F1",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#6366F1",
      },
    },
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        backgroundColor: "#F5F5F5",
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
          backgroundColor: "#FFFFFF",
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
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
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
                color: "#1F2937",
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
                color: "#111827",
                mb: 1,
              }}
            >
              {t('forgotPassword.title')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#6B7280",
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
                sx={inputStyles}
              />

              {/* Кнопка Submit */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  backgroundColor: "#6366F1",
                  color: "white",
                  padding: "12px",
                  borderRadius: "12px",
                  textTransform: "none",
                  fontSize: "1rem",
                  fontWeight: 600,
                  boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
                  mt: 1,
                  "&:hover": {
                    backgroundColor: "#4F46E5",
                    boxShadow: "0 6px 20px 0 rgba(99, 102, 241, 0.5)",
                  },
                  "&:disabled": {
                    backgroundColor: "#9CA3AF",
                  },
                }}
              >
                {loading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
              </Button>

              {/* Ссылка на вход */}
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <MuiLink
                  component={Link}
                  to="/login"
                  sx={{
                    color: "#6366F1",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    "&:hover": {
                      textDecoration: "underline",
                    },
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
                  color: "#10B981",
                  fontSize: "1rem",
                  textAlign: "center",
                  mb: 3,
                  padding: 2,
                  backgroundColor: "#ECFDF5",
                  borderRadius: "12px",
                  border: "1px solid #10B981",
                }}
              >
                {message}
              </Typography>
              <Box sx={{ textAlign: "center" }}>
                <Link to="/login" style={{ textDecoration: "none" }}>
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{
                      backgroundColor: "#6366F1",
                      color: "white",
                      padding: "12px",
                      borderRadius: "12px",
                      textTransform: "none",
                      fontSize: "1rem",
                      fontWeight: 600,
                      boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
                      "&:hover": {
                        backgroundColor: "#4F46E5",
                        boxShadow: "0 6px 20px 0 rgba(99, 102, 241, 0.5)",
                      },
                    }}
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
