// frontend/src/pages/Information.jsx
// -------------------------------------------------------
// Информационная страница
// -------------------------------------------------------

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';

export default function Information() {
  const { t } = useTranslation();
  usePageTitle('pageTitles.information');

  return (
    <PageContainer>
      <Box>
        <Typography variant="h4" gutterBottom>
          {t('pageTitles.information')}
        </Typography>
      </Box>
    </PageContainer>
  );
}

