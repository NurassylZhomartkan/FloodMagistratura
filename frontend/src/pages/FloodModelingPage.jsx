// frontend/src/pages/FloodModelingPage.jsx
// Страница с полноэкранной картой

import React from 'react';
import { Box } from '@mui/material';
import MapView from '../components/flood/MapView';
import { usePageTitle } from '../utils/usePageTitle';

export default function FloodModelingPage() {
  usePageTitle('pageTitles.floodModeling');

  return (
    <Box sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: '#000',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none', // IE and Edge
    }}>
      <MapView />
    </Box>
  );
}

