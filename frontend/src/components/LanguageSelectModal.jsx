import React, { useState } from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { setLanguageCookie, getLanguageCookie } from '../utils/languageUtils';
import { languages, defaultLanguage } from '../config/languages';
import BaseModal from './BaseModal';

export default function LanguageSelectModal({ open, onClose }) {
  const { i18n, t } = useTranslation();
  const cookieLang = getLanguageCookie();
  const [selectedLang, setSelectedLang] = useState(
    cookieLang || i18n.language || defaultLanguage
  );

  const handleLanguageChange = (event) => {
    setSelectedLang(event.target.value);
  };

  const handleConfirm = () => {
    setLanguageCookie(selectedLang);
    i18n.changeLanguage(selectedLang);
    onClose();
  };

  return (
    <BaseModal
      open={open}
      onClose={() => {}}
      title={t('languageSelect.title')}
      showCloseButton={false}
      disableEscapeKeyDown
      disableBackdropClick
      confirmText={t('languageSelect.confirm')}
      onConfirm={handleConfirm}
      hideCancel
      titleSx={{ textAlign: 'center', justifyContent: 'center' }}
      actionsSx={{ justifyContent: 'center' }}
    >
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
                  <Typography variant="body2" color="text.secondary">
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
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                },
              }}
            />
          ))}
        </RadioGroup>
      </FormControl>
    </BaseModal>
  );
}
