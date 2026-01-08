// frontend/src/pages/VerifyEmail.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthIllustration from '../components/AuthIllustration';
import { usePageTitle } from '../utils/usePageTitle';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.verifyEmail');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('verifyEmail.noToken'));
      return;
    }

    // Если уже был успешный ответ, не делаем повторный запрос
    if (hasVerified.current) {
      setStatus('success');
      setMessage(t('verifyEmail.success'));
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/auth/verify-email?token=${token}`, {
          method: 'GET',
        });

        const data = await res.json();

        if (res.ok) {
          hasVerified.current = true; // Помечаем как успешно подтверждено
          setStatus('success');
          setMessage(t('verifyEmail.success'));
          setTimeout(() => navigate('/login'), 3000);
        } else {
          // Проверяем, не был ли токен уже использован (email уже подтвержден)
          // Если это так, показываем успех вместо ошибки
          if (data.detail && data.detail.includes('already verified')) {
            hasVerified.current = true;
            setStatus('success');
            setMessage(t('verifyEmail.success'));
          } else {
            setStatus('error');
            setMessage(data.detail || t('verifyEmail.error'));
          }
        }
      } catch (err) {
        console.error('Ошибка при подтверждении email:', err);
        setStatus('error');
        setMessage(t('verifyEmail.serverError'));
      }
    };

    verifyEmail();
  }, [token, t, navigate]);

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
            textAlign: "center",
          }}
        >
          {/* Логотип/Название */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
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

          {/* Содержимое в зависимости от статуса */}
          {status === 'loading' && (
            <>
              <CircularProgress 
                sx={{ 
                  mb: 2,
                  color: "#6366F1",
                }} 
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: "#111827",
                  mb: 1,
                }}
              >
                {t('verifyEmail.verifying')}
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  mb: 2,
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: "#111827",
                  mb: 1,
                }}
              >
                {t('verifyEmail.successTitle')}
              </Typography>
              <Typography
                sx={{
                  color: "#6B7280",
                  fontSize: "1rem",
                  mb: 2,
                }}
              >
                {message}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "#9CA3AF",
                  fontSize: "0.875rem",
                  mb: 3,
                }}
              >
                {t('verifyEmail.redirecting')}
              </Typography>
              <Button
                component={Link}
                to="/login"
                variant="contained"
                fullWidth
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
                {t('verifyEmail.goToLogin')}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundColor: "#EF4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  mb: 2,
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: "#111827",
                  mb: 1,
                }}
              >
                {t('verifyEmail.errorTitle')}
              </Typography>
              <Typography
                sx={{
                  color: "#6B7280",
                  fontSize: "1rem",
                  mb: 3,
                  padding: 2,
                  backgroundColor: "#FEF2F2",
                  borderRadius: "12px",
                  border: "1px solid #EF4444",
                }}
              >
                {message}
              </Typography>
              <Button
                component={Link}
                to="/login"
                variant="contained"
                fullWidth
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
                {t('verifyEmail.goToLogin')}
              </Button>
            </>
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
