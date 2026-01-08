// frontend/src/pages/Weather.jsx
// -------------------------------------------------------
// Страница погоды
// -------------------------------------------------------

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';

export default function Weather() {
  const { t } = useTranslation();
  usePageTitle('pageTitles.weather');

  return (
    <PageContainer>
      <Box>
        <Typography variant="h4" gutterBottom>
          {t('pageTitles.weather')}
        </Typography>
      </Box>
    </PageContainer>
  );
}

