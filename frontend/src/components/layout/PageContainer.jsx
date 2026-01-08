// src/components/layout/PageContainer.jsx
// Компонент-контейнер для страниц, который учитывает ограничения sidebar

import React, { useContext, createContext } from 'react';
import { Box } from '@mui/material';

// Контекст для передачи информации о sidebar
const LayoutContext = createContext({
  sidebarOpen: false,
  sidebarWidth: 64,
  headerHeight: 64
});

export const useLayoutContext = () => useContext(LayoutContext);

export { LayoutContext };

export default function PageContainer({ children, fullHeight = false, noPadding = false }) {
  const { headerHeight } = useLayoutContext();

  return (
    <Box
      sx={{
        width: '100%',
        height: fullHeight ? '100%' : 'auto',
        minHeight: fullHeight ? `calc(100vh - ${headerHeight}px)` : 'auto',
        padding: noPadding ? 0 : 2,
        backgroundColor: '#F5F5F5',
        boxSizing: 'border-box',
        overflow: fullHeight ? 'hidden' : 'visible'
      }}
    >
      {children}
    </Box>
  );
}

