// frontend/src/pages/ResetPassword.jsx

import React, { useState, useCallback, useEffect } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
} from '@mui/material';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import backgroundImage from '../assets/floodsiteBackground.jpg';
import { usePageTitle } from '../utils/usePageTitle';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.resetPassword');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('resetPassword.noToken'));
    }
  }, [token, t]);

  const handleChange = useCallback((e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
    setMessage('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError(t('resetPassword.noToken'));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }

    if (form.password.length < 6) {
      setError(t('resetPassword.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: form.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(t('resetPassword.success'));
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(data.detail || t('resetPassword.error'));
      }
    } catch (err) {
      console.error('Ошибка при сбросе пароля:', err);
      setError(t('resetPassword.serverError'));
    } finally {
      setLoading(false);
    }
  }, [token, form, t, navigate]);

  const boxStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const paperStyles = {
    p: 4,
    maxWidth: 400,
    width: '100%',
  };

  return (
    <Box sx={boxStyles}>
      <Paper sx={paperStyles} elevation={3}>
        <Typography variant="h5" gutterBottom align="center">
          {t('resetPassword.title')}
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={t('resetPassword.password')}
            name="password"
            type="password"
            value={form.password}
            margin="normal"
            onChange={handleChange}
            disabled={loading || !token}
          />
          <TextField
            fullWidth
            label={t('resetPassword.confirmPassword')}
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            margin="normal"
            onChange={handleChange}
            error={Boolean(error)}
            helperText={error}
            disabled={loading || !token}
          />

          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="contained"
              type="submit"
              fullWidth
              disabled={loading || !token}
            >
              {loading ? t('resetPassword.resetting') : t('resetPassword.submit')}
            </Button>
            <Button component={Link} to="/login" variant="outlined" fullWidth>
              {t('resetPassword.backToLogin')}
            </Button>
          </Box>

          {message && (
            <Typography color="success.main" sx={{ mt: 2 }}>
              {message}
            </Typography>
          )}
        </form>
      </Paper>
    </Box>
  );
}


