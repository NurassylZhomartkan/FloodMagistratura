// src/pages/Register.jsx

import React, { useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
} from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import backgroundImage from '../assets/floodsiteBackground.jpg';

export default function Register() {
  const { t } = useTranslation();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // проверяем совпадение паролей
    if (form.password !== form.confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(t('register.success'));
        navigate('/login');
      } else {
        setError(data.detail || data.msg || t('register.error'));
      }
    } catch (err) {
      console.error('Ошибка при регистрации:', err);
      setError(t('register.serverError'));
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '10vh 0 0 10vw',
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: 320,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.85)',
        }}
      >
        <Typography variant="h5" gutterBottom align="center">
          {t('register.title')}
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={t('register.username')}
            name="username"
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            fullWidth
            label={t('register.email')}
            name="email"
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            fullWidth
            label={t('register.password')}
            name="password"
            type="password"
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            fullWidth
            label={t('register.confirmPassword')}
            name="confirmPassword"
            type="password"
            margin="normal"
            onChange={handleChange}
            error={Boolean(error)}
            helperText={error}
          />
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 2 }}
          >
            <Button variant="contained" type="submit">
              {t('register.submit')}
            </Button>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="outlined">{t('register.back')}</Button>
            </Link>
          </Box>
        </form>

        {message && (
          <Typography color="primary" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
