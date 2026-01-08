// frontend/src/pages/Database.jsx
// -------------------------------------------------------
// Страница базы данных
// -------------------------------------------------------

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';

export default function Database() {
  const { t } = useTranslation();
  usePageTitle('pageTitles.database');

  return (
    <PageContainer>
      <Box>
        <Typography variant="h4" gutterBottom>
          {t('pageTitles.database')}
        </Typography>
      </Box>
    </PageContainer>
  );
}

