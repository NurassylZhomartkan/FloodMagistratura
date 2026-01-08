// src/components/layout/Layout.jsx
// Полноэкранный компонент layout с Header, Sidebar и областью контента

import React, { useState, useEffect, useRef } from 'react';
import { CssBaseline } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { LayoutContext } from './PageContainer';

const HEADER_HEIGHT = 64;
const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_CLOSED = 64;

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);
  
  // Определяем, находимся ли мы на странице просмотра карты
  const isMapViewer = (
    location.pathname.includes('/hec-ras/') && 
    location.pathname !== '/app/hec-ras' && 
    location.pathname !== '/app/hec-ras/upload'
  ) || 
  location.pathname === '/app/layers' || 
  location.pathname === '/app/flood' ||
  location.pathname === '/app/terrain-map';

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Вычисляем отступ слева в зависимости от состояния sidebar
  const sidebarWidth = sidebarOpen ? DRAWER_WIDTH : DRAWER_WIDTH_CLOSED;

  // Убираем aria-hidden с элементов, содержащих карту, чтобы избежать конфликтов с фокусом canvas
  useEffect(() => {
    const rootElement = document.getElementById('root');
    
    const removeAriaHidden = () => {
      // Убираем aria-hidden с main элемента, если он установлен
      if (mainRef.current) {
        mainRef.current.removeAttribute('aria-hidden');
      }
      
      // Убираем aria-hidden с #root, если он установлен и содержит карту
      if (rootElement && isMapViewer) {
        rootElement.removeAttribute('aria-hidden');
      }
    };

    // Вызываем сразу и после небольшой задержки (на случай, если aria-hidden устанавливается асинхронно)
    removeAriaHidden();
    const timeoutId = setTimeout(removeAriaHidden, 100);
    
    // Также слушаем изменения DOM через MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
          removeAriaHidden();
        }
      });
    });

    if (mainRef.current) {
      observer.observe(mainRef.current, {
        attributes: true,
        attributeFilter: ['aria-hidden']
      });
    }

    if (rootElement) {
      observer.observe(rootElement, {
        attributes: true,
        attributeFilter: ['aria-hidden']
      });
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [isMapViewer, sidebarOpen]);

  return (
    <LayoutContext.Provider
      value={{
        sidebarOpen,
        sidebarWidth,
        headerHeight: HEADER_HEIGHT
      }}
    >
      <CssBaseline />

      {/* ---------- HEADER ---------- */}
      <Header 
        open={sidebarOpen} 
        onToggle={handleSidebarToggle} 
        headerHeight={HEADER_HEIGHT}
      />

      {/* ---------- SIDEBAR ---------- */}
      <Sidebar 
        open={sidebarOpen}
        headerHeight={HEADER_HEIGHT}
      />

      {/* ---------- CONTENT AREA ---------- */}
      <main
        ref={mainRef}
        style={{
          flexGrow: 1,
          padding: 0,
          position: 'relative',
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          marginTop: HEADER_HEIGHT,
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth}px)`,
          transition: 'margin-left 0.3s ease, width 0.3s ease',
          overflow: isMapViewer ? 'hidden' : 'auto',
          backgroundColor: '#F5F5F5',
          ...(isMapViewer ? {
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          } : {})
        }}
        className={isMapViewer ? 'no-scrollbar' : ''}
        // Явно убираем aria-hidden для страниц с картой
        aria-hidden={isMapViewer ? false : undefined}
      >
        {children}
      </main>
    </LayoutContext.Provider>
  );
}

