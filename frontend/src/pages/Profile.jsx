import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Typography,
  Box,
  Button,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Paper,
  Divider,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import BaseModal from '../components/BaseModal';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { setLanguageCookie, getLanguageCookie } from '../utils/languageUtils';
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';
import { languages, defaultLanguage } from '../config/languages';

const API_BASE = '/auth';

export default function Profile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.profile');
  const cookieLang = getLanguageCookie();
  const [selectedLang, setSelectedLang] = useState(
    cookieLang || i18n.language || defaultLanguage
  );

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Состояния для изменения email
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Состояния для изменения пароля
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Состояния для аватара
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [deleteAvatarDialogOpen, setDeleteAvatarDialogOpen] = useState(false);

  // Состояния для настроек карты
  const [mapStyle, setMapStyle] = useState('satellite-streets-v12');
  const [mapProjection, setMapProjection] = useState('mercator');
  const [mapSettingsLoading, setMapSettingsLoading] = useState(false);

  // Загрузка данных пользователя
  useEffect(() => {
    loadUserData();
  }, []);

  // Синхронизация языка
  useEffect(() => {
    const currentLang = getLanguageCookie() || i18n.language || defaultLanguage;
    setSelectedLang(currentLang);
  }, [i18n.language]);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
        if (data.avatar_url) {
          setAvatarPreview(data.avatar_url);
        }
        // Загружаем настройки карты
        if (data.default_map_style) {
          setMapStyle(data.default_map_style);
        } else {
          setMapStyle('satellite-streets-v12'); // значение по умолчанию
        }
        if (data.default_map_projection) {
          setMapProjection(data.default_map_projection);
        } else {
          setMapProjection('mercator'); // значение по умолчанию
        }
      } else if (res.status === 401) {
        // Токен истек или невалидный - очищаем и перенаправляем на страницу входа
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rememberMe');
        navigate('/login');
      }
    } catch (error) {
      // Логируем только реальные ошибки сети, не ошибки авторизации
      if (!error.message || !error.message.includes('401')) {
        console.error('Error loading user data:', error);
        showSnackbar(t('profile.loadUserDataError'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleLanguageChange = (event) => {
    const lang = event.target.value;
    setSelectedLang(lang);
    setLanguageCookie(lang);
    i18n.changeLanguage(lang);
  };

  // Запрос кода для изменения email
  const handleRequestEmailChange = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      showSnackbar(t('profile.invalidEmail'), 'error');
      return;
    }

    setEmailLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/users/me/email/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_email: newEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        showSnackbar(t('profile.codeSentMessage'), 'success');
        setCodeSent(true);
      } else {
        showSnackbar(data.detail || t('profile.error'), 'error');
      }
    } catch {
      showSnackbar(t('profile.requestEmailChangeError'), 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  // Подтверждение изменения email по коду
  const handleVerifyEmailChange = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showSnackbar(t('profile.enterCodeError'), 'error');
      return;
    }

    setEmailLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/users/me/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await res.json();
      if (res.ok) {
        showSnackbar(t('profile.emailUpdated'), 'success');
        setEmailDialogOpen(false);
        setNewEmail('');
        setVerificationCode('');
        setCodeSent(false);
        await loadUserData();
      } else {
        showSnackbar(data.detail || t('profile.error'), 'error');
      }
    } catch {
      showSnackbar(t('profile.verifyEmailChangeError'), 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  // Изменение пароля
  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      showSnackbar(t('profile.passwordsMismatch'), 'error');
      return;
    }
    if (passwordForm.new.length < 6) {
      showSnackbar(t('profile.passwordTooShort'), 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.new,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSnackbar(t('profile.passwordUpdated'), 'success');
        setPasswordDialogOpen(false);
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        showSnackbar(data.detail || t('profile.error'), 'error');
      }
    } catch {
      showSnackbar(t('profile.changePasswordError'), 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Загрузка аватара
  const handleAvatarFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка типа файла
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showSnackbar(t('profile.invalidFileType'), 'error');
        return;
      }

      // Проверка размера (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showSnackbar(t('profile.fileTooLarge'), 'error');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setAvatarLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', avatarFile);

      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        showSnackbar(t('profile.avatarUploaded'), 'success');
        setAvatarFile(null);
        await loadUserData();
        // Уведомляем другие компоненты об обновлении профиля
        window.dispatchEvent(new Event('profileUpdated'));
      } else {
        showSnackbar(data.detail || t('profile.error'), 'error');
      }
    } catch {
      showSnackbar(t('profile.error'), 'error');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleAvatarDelete = () => {
    setDeleteAvatarDialogOpen(true);
  };

  const handleConfirmAvatarDelete = async () => {
    setDeleteAvatarDialogOpen(false);
    setAvatarLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        showSnackbar(t('profile.avatarDeleted'), 'success');
        setAvatarPreview(null);
        setAvatarFile(null);
        await loadUserData();
        // Уведомляем другие компоненты об обновлении профиля
        window.dispatchEvent(new Event('profileUpdated'));
      } else {
        showSnackbar(data.detail || t('profile.error'), 'error');
      }
    } catch {
      showSnackbar(t('profile.error'), 'error');
    } finally {
      setAvatarLoading(false);
    }
  };

  // Сохранение настроек карты
  const handleMapSettingsSave = async () => {
    setMapSettingsLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('Saving map settings:', { map_style: mapStyle, map_projection: mapProjection });
      const res = await fetch(`${API_BASE}/users/me/map-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          map_style: mapStyle,
          map_projection: mapProjection,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        console.log('Map settings saved successfully:', data);
        showSnackbar(t('profile.mapSettingsUpdated'), 'success');
        await loadUserData();
        // Уведомляем другие компоненты об обновлении настроек карты
        window.dispatchEvent(new Event('mapSettingsUpdated'));
      } else {
        console.error('Error saving map settings:', data);
        showSnackbar(data.detail || t('profile.mapSettingsError'), 'error');
      }
    } catch (error) {
      console.error('Exception saving map settings:', error);
      showSnackbar(t('profile.mapSettingsError'), 'error');
    } finally {
      setMapSettingsLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  const username = user?.username || localStorage.getItem('username') || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.avatar_url || null;

  return (
    <PageContainer>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
          {t('app.profile')}
        </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Левая колонка - информация о пользователе */}
        <Paper sx={{ p: 3, flex: 1, minWidth: 300 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box sx={{ position: 'relative', mb: 2 }}>
              <Avatar
                src={avatarPreview || avatarUrl}
                sx={{
                  width: 120,
                  height: 120,
                  fontSize: 48,
                  bgcolor: 'primary.main',
                }}
              >
                {!avatarPreview && !avatarUrl && username[0].toUpperCase()}
              </Avatar>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="avatar-upload"
                type="file"
                onChange={handleAvatarFileChange}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  display: 'flex',
                  gap: 0.5,
                }}
              >
                <label htmlFor="avatar-upload">
                  <IconButton
                    component="span"
                    size="small"
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                    disabled={avatarLoading}
                  >
                    <CloudUploadIcon fontSize="small" />
                  </IconButton>
                </label>
                {avatarUrl && (
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: 'error.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'error.dark' },
                    }}
                    onClick={handleAvatarDelete}
                    disabled={avatarLoading}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
            {avatarFile && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleAvatarUpload}
                  disabled={avatarLoading}
                >
                  {t('profile.save')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview(avatarUrl);
                  }}
                  disabled={avatarLoading}
                >
                  {t('profile.cancel')}
                </Button>
              </Box>
            )}
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
              {username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {email}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEmailDialogOpen(true)}
              fullWidth
            >
              {t('profile.changeEmail')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setPasswordDialogOpen(true)}
              fullWidth
            >
              {t('profile.changePassword')}
            </Button>
          </Box>
        </Paper>

        {/* Правая колонка - настройки */}
        <Paper sx={{ p: 3, flex: 2 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            {t('app.changeLang')}
          </Typography>
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={selectedLang}
              onChange={handleLanguageChange}
              sx={{ gap: 1 }}
            >
              {languages.map((lang) => (
                <FormControlLabel
                  key={lang.code}
                  value={lang.code}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {lang.nativeName}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {lang.name}
                      </Typography>
                    </Box>
                  }
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    margin: 0,
                    '&:hover': {
                      bgcolor: 'action.hover',
                      borderColor: 'primary.main',
                    },
                    '&.Mui-checked': {
                      borderColor: 'primary.main',
                      bgcolor: '#E8F4F8',
                    },
                  }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            {t('profile.mapSettings')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="map-style-label">{t('profile.mapStyle')}</InputLabel>
              <Select
                labelId="map-style-label"
                id="map-style-select"
                value={mapStyle}
                label={t('profile.mapStyle')}
                onChange={(e) => setMapStyle(e.target.value)}
              >
                <MenuItem value="streets-v12">{t('profile.mapStyles.streets')}</MenuItem>
                <MenuItem value="satellite-v9">{t('profile.mapStyles.satellite')}</MenuItem>
                <MenuItem value="satellite-streets-v12">{t('profile.mapStyles.satelliteStreets')}</MenuItem>
                <MenuItem value="outdoors-v12">{t('profile.mapStyles.outdoors')}</MenuItem>
                <MenuItem value="light-v11">{t('profile.mapStyles.light')}</MenuItem>
                <MenuItem value="dark-v11">{t('profile.mapStyles.dark')}</MenuItem>
              </Select>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {t('profile.mapStyleDescription')}
              </Typography>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="map-projection-label">{t('profile.mapProjection')}</InputLabel>
              <Select
                labelId="map-projection-label"
                id="map-projection-select"
                value={mapProjection}
                label={t('profile.mapProjection')}
                onChange={(e) => {
                  console.log('Projection changed to:', e.target.value);
                  setMapProjection(e.target.value);
                }}
              >
                <MenuItem value="mercator">{t('profile.mapProjections.mercator')}</MenuItem>
                <MenuItem value="globe">{t('profile.mapProjections.globe')}</MenuItem>
                <MenuItem value="albers">{t('profile.mapProjections.albers')}</MenuItem>
                <MenuItem value="equalEarth">{t('profile.mapProjections.equalEarth')}</MenuItem>
                <MenuItem value="naturalEarth">{t('profile.mapProjections.naturalEarth')}</MenuItem>
              </Select>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {t('profile.mapProjectionDescription')}
              </Typography>
            </FormControl>

            <Button
              variant="contained"
              onClick={handleMapSettingsSave}
              disabled={mapSettingsLoading}
              sx={{ mt: 2 }}
            >
              {mapSettingsLoading ? <CircularProgress size={20} /> : t('profile.save')}
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Диалог изменения email */}
      <BaseModal
        open={emailDialogOpen}
        onClose={() => { setEmailDialogOpen(false); setNewEmail(''); setVerificationCode(''); setCodeSent(false); }}
        title={t('profile.changeEmail')}
        confirmText={!codeSent ? t('profile.sendCode') : t('profile.confirm')}
        onConfirm={!codeSent ? handleRequestEmailChange : handleVerifyEmailChange}
        confirmLoading={emailLoading}
        confirmDisabled={!codeSent ? !newEmail : (!verificationCode || verificationCode.length !== 6)}
        cancelText={t('profile.cancel')}
        onCancel={() => { setEmailDialogOpen(false); setNewEmail(''); setVerificationCode(''); setCodeSent(false); }}
      >
        {!codeSent ? (
          <TextField
            fullWidth
            label={t('profile.newEmail')}
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            sx={{ mt: 2 }}
            helperText={t('profile.emailConfirmationHelper')}
            disabled={emailLoading}
          />
        ) : (
          <>
            <TextField
              fullWidth
              label={t('profile.newEmail')}
              type="email"
              value={newEmail}
              sx={{ mt: 2 }}
              disabled
            />
            <TextField
              fullWidth
              label={t('profile.verificationCode')}
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              sx={{ mt: 2 }}
              helperText={t('profile.verificationCodeHelper')}
              inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '24px', letterSpacing: '8px' } }}
              disabled={emailLoading}
            />
          </>
        )}
      </BaseModal>

      {/* Диалог изменения пароля */}
      <BaseModal
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        title={t('profile.changePassword')}
        confirmText={t('profile.change')}
        onConfirm={handlePasswordChange}
        confirmLoading={passwordLoading}
        confirmDisabled={!passwordForm.current || !passwordForm.new || !passwordForm.confirm}
        cancelText={t('profile.cancel')}
      >
        <TextField
          fullWidth
          label={t('profile.currentPassword')}
          type="password"
          value={passwordForm.current}
          onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
          sx={{ mt: 2 }}
        />
        <TextField
          fullWidth
          label={t('profile.newPassword')}
          type="password"
          value={passwordForm.new}
          onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
          sx={{ mt: 2 }}
          helperText={t('profile.passwordMinLength')}
        />
        <TextField
          fullWidth
          label={t('profile.confirmPassword')}
          type="password"
          value={passwordForm.confirm}
          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
          sx={{ mt: 2 }}
        />
      </BaseModal>

      {/* Диалог удаления аватара */}
      <BaseModal
        open={deleteAvatarDialogOpen}
        onClose={() => setDeleteAvatarDialogOpen(false)}
        title={t('profile.deleteAvatar')}
        confirmText={t('profile.delete') || 'Удалить'}
        onConfirm={handleConfirmAvatarDelete}
        confirmColor="error"
        cancelText={t('profile.cancel')}
      >
        <Typography>{t('profile.deleteAvatarConfirm') || 'Вы уверены, что хотите удалить аватар?'}</Typography>
      </BaseModal>

      {/* Snackbar для уведомлений */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </PageContainer>
  );
}
