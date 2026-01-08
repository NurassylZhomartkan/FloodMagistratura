// Компонент модального окна для выбора языка при первом входе

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { setLanguageCookie, getLanguageCookie } from '../utils/languageUtils';
import { languages, defaultLanguage } from '../config/languages';

export default function LanguageSelectModal({ open, onClose }) {
  const { i18n, t } = useTranslation();
  // Получаем текущий язык из cookie или используем язык по умолчанию
  const cookieLang = getLanguageCookie();
  const [selectedLang, setSelectedLang] = useState(
    cookieLang || i18n.language || defaultLanguage
  );

  const handleLanguageChange = (event) => {
    const lang = event.target.value;
    setSelectedLang(lang);
  };

  const handleConfirm = () => {
    // Сохраняем выбор в cookie
    setLanguageCookie(selectedLang);
    // Устанавливаем язык в i18n
    i18n.changeLanguage(selectedLang);
    // Закрываем модальное окно
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {}} // Не позволяем закрывать без выбора
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: '16px',
          padding: '8px',
        },
      }}
    >
      <DialogTitle
        sx={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '1.5rem',
          pb: 1,
        }}
      >
        {t('languageSelect.title')}
      </DialogTitle>
      <DialogContent>
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
                control={
                  <Radio
                    sx={{
                      color: '#6366F1',
                      '&.Mui-checked': {
                        color: '#6366F1',
                      },
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {lang.nativeName}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6B7280' }}>
                      {lang.name}
                    </Typography>
                  </Box>
                }
                sx={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  margin: 0,
                  '&:hover': {
                    backgroundColor: '#F9FAFB',
                    borderColor: '#6366F1',
                  },
                  '&.Mui-checked': {
                    borderColor: '#6366F1',
                    backgroundColor: '#EEF2FF',
                  },
                }}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ padding: '16px 24px', justifyContent: 'center' }}>
        <Button
          onClick={handleConfirm}
          variant="contained"
          fullWidth
          sx={{
            backgroundColor: '#6366F1',
            color: 'white',
            padding: '12px',
            borderRadius: '12px',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
            '&:hover': {
              backgroundColor: '#4F46E5',
              boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
            },
          }}
        >
          {t('languageSelect.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

