import React from 'react';
import { Avatar, Typography, Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { t, i18n } = useTranslation();

  /* Имя, сохранённое после логина */
  const username = localStorage.getItem('username') || 'User';

  /* смена языка прямо из личного кабинета */
  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'kz' : 'ru';
    i18n.changeLanguage(next);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 360,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 64, height: 64, fontSize: 32 }}>
          {username[0].toUpperCase()}
        </Avatar>

        <Box>
          <Typography variant="h6">{username}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('app.profile')}
          </Typography>
        </Box>
      </Box>

      <Button variant="outlined" onClick={toggleLang}>
        {t('app.changeLang')}
      </Button>
    </Box>
  );
}
