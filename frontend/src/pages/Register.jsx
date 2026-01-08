// src/pages/Register.jsx

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Link as MuiLink,
  CircularProgress,
} from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthIllustration from '../components/AuthIllustration';
import { getLanguageCookie } from '../utils/languageUtils';
import { usePageTitle } from '../utils/usePageTitle';
import { defaultLanguage } from '../config/languages';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.register');

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef(form);

  // Обновляем ref при изменении формы
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const handleChange = useCallback((e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
    setMessage('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    const currentForm = formRef.current;

    // проверяем совпадение паролей
    if (currentForm.password !== currentForm.confirmPassword) {
      setError(t('register.passwordMismatch'));
      setIsLoading(false);
      return;
    }

    try {
      // Получаем язык из cookie или используем язык по умолчанию
      const userLanguage = getLanguageCookie() || defaultLanguage;
      
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentForm.username,
          email: currentForm.email,
          password: currentForm.password,
          language: userLanguage,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(t('register.successWithEmail'));
        // Не перенаправляем сразу, показываем сообщение о подтверждении email
      } else {
        // Переводим известные ошибки сервера
        let errorMessage = t('register.error');
        if (data.detail) {
          if (data.detail.includes('Username already registered')) {
            errorMessage = t('register.usernameAlreadyRegistered');
          } else if (data.detail.includes('Email already registered')) {
            errorMessage = t('register.emailAlreadyRegistered');
          } else {
            // Для неизвестных ошибок показываем общее сообщение
            errorMessage = t('register.error');
          }
        }
        setError(errorMessage);
      }
    } catch (err) {
      console.error(t('register.registrationError'), err);
      setError(t('register.serverError'));
    } finally {
      setIsLoading(false);
    }
  }, [t, navigate]);

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
          overflowY: "auto",
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

          {/* Приветственное сообщение */}
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "#111827",
                mb: 1,
              }}
            >
              {t('register.welcome')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#6B7280",
                fontSize: "1rem",
              }}
            >
              {t('register.subtitle')}
            </Typography>
          </Box>

          {!message ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                fullWidth
                label={t('register.username')}
                name="username"
                value={form.username}
                onChange={handleChange}
                variant="outlined"
                disabled={isLoading}
                sx={inputStyles}
              />
              <TextField
                fullWidth
                label={t('register.email')}
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                variant="outlined"
                disabled={isLoading}
                sx={inputStyles}
              />
              <TextField
                fullWidth
                label={t('register.password')}
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                variant="outlined"
                disabled={isLoading}
                sx={inputStyles}
              />
              <TextField
                fullWidth
                label={t('register.confirmPassword')}
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                error={Boolean(error)}
                helperText={error}
                variant="outlined"
                disabled={isLoading}
                sx={inputStyles}
              />
              
              {/* Кнопка Sign Up */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
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
                {isLoading ? (
                  <CircularProgress size={24} sx={{ color: "white" }} />
                ) : (
                  t('register.submit')
                )}
              </Button>

              {/* Ссылка на вход */}
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <Typography
                  sx={{
                    color: "#6B7280",
                    fontSize: "0.875rem",
                  }}
                >
                  {t('register.haveAccount')}{" "}
                  <MuiLink
                    component={Link}
                    to="/login"
                    sx={{
                      color: "#6366F1",
                      textDecoration: "none",
                      fontWeight: 600,
                      "&:hover": {
                        textDecoration: "underline",
                      },
                    }}
                  >
                    {t('register.signIn')}
                  </MuiLink>
                </Typography>
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
                    {t('register.goToLogin')}
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
