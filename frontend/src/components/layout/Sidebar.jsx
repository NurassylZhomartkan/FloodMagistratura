// src/components/layout/Sidebar.jsx
// Компонент боковой панели навигации
import React, { useState, useEffect, useRef } from 'react';
import { styled, keyframes } from '@mui/material/styles';
import {
  Drawer as MuiDrawer, Toolbar,
  List, Divider,
  ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Typography, Box, Tooltip,
} from '@mui/material';
import HomeIcon   from '@mui/icons-material/Home';
import LayersIcon from '@mui/icons-material/Layers';
import GridOnIcon from '@mui/icons-material/GridOn';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import TerrainIcon from '@mui/icons-material/Terrain';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import InfoIcon from '@mui/icons-material/Info';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate, useLocation }   from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_BASE = '/auth';

const DRAWER_WIDTH = 240;

/* ---------- Scrollable Text Component ---------- */
const ScrollableText = styled(Box)({
  overflow: 'visible',
  position: 'relative',
  width: '100%',
  '& .text-content': {
    whiteSpace: 'nowrap',
    display: 'inline-block',
    willChange: 'transform',
    transform: 'translateX(0)',
  },
});

/* ---------- Drawer helpers ---------- */
const opened = (t) => ({
  width: DRAWER_WIDTH,
  transition: t.transitions.create('width', {
    easing  : t.transitions.easing.sharp,
    duration: t.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});
const closed = (t) => ({
  width: 64, // Минимальная ширина закрытого drawer
  transition: t.transitions.create('width', {
    easing  : t.transitions.easing.sharp,
    duration: t.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
});
const Drawer = styled(MuiDrawer, { shouldForwardProp: (p) => p !== 'open' })(
  ({ theme, open }) => ({
    whiteSpace: 'nowrap',
    boxSizing : 'border-box',
    '& .MuiDrawer-paper': {
      backgroundColor: '#FFFFFF',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
      borderRight: 'none',
    },
    ...(open
      ? { ...opened(theme), '& .MuiDrawer-paper': opened(theme) }
      : { ...closed(theme), '& .MuiDrawer-paper': closed(theme) }),
  }),
);
/* ------------------------------------ */

// Компонент для текста с прокруткой при переполнении
function ScrollableTextItem({ children, open, sx, ...props }) {
  const textRef = useRef(null);
  const containerRef = useRef(null);

  const animateToEnd = () => {
    if (!textRef.current || !containerRef.current) return;

    // Reset before measuring
    textRef.current.style.transition = 'none';
    textRef.current.style.transform = 'translateX(0)';

    requestAnimationFrame(() => {
      if (!textRef.current || !containerRef.current) return;

      // Create temporary element to measure actual text width
      const tempElement = document.createElement('span');
      const styles = window.getComputedStyle(textRef.current);
      tempElement.style.position = 'absolute';
      tempElement.style.visibility = 'hidden';
      tempElement.style.whiteSpace = 'nowrap';
      tempElement.style.font = styles.font;
      tempElement.style.fontSize = styles.fontSize;
      tempElement.style.fontFamily = styles.fontFamily;
      tempElement.style.fontWeight = styles.fontWeight;
      tempElement.style.letterSpacing = styles.letterSpacing;
      tempElement.textContent = textRef.current.textContent || textRef.current.innerText;
      document.body.appendChild(tempElement);
      
      const textWidth = tempElement.getBoundingClientRect().width;
      const containerWidth = containerRef.current.clientWidth;
      
      document.body.removeChild(tempElement);

      const overflow = textWidth - containerWidth;

      // If it fits, do nothing - don't animate
      if (overflow <= 0) {
        textRef.current.style.transform = 'translateX(0)';
        return;
      }

      // Speed control (60px per second)
      const speed = 60; // px/s
      const duration = overflow / speed;

      textRef.current.style.transition = `transform ${duration}s linear`;
      // Move exactly by the overflow amount so the last character is visible
      textRef.current.style.transform = `translateX(${-overflow}px)`;
    });
  };

  const resetAnimation = () => {
    if (!textRef.current) return;
    // Always return text to original state when mouse leaves
    textRef.current.style.transition = 'transform 0.3s ease-out';
    textRef.current.style.transform = 'translateX(0)';
  };

  useEffect(() => {
    if (open && textRef.current && containerRef.current) {
      const setupAnimation = () => {
        requestAnimationFrame(() => {
          if (!textRef.current || !containerRef.current) return;
          
          // Create temporary element to measure actual text width
          const tempElement = document.createElement('span');
          const styles = window.getComputedStyle(textRef.current);
          tempElement.style.position = 'absolute';
          tempElement.style.visibility = 'hidden';
          tempElement.style.whiteSpace = 'nowrap';
          tempElement.style.font = styles.font;
          tempElement.style.fontSize = styles.fontSize;
          tempElement.style.fontFamily = styles.fontFamily;
          tempElement.style.fontWeight = styles.fontWeight;
          tempElement.style.letterSpacing = styles.letterSpacing;
          tempElement.textContent = textRef.current.textContent || textRef.current.innerText;
          document.body.appendChild(tempElement);
          
          const textWidth = tempElement.getBoundingClientRect().width;
          const containerWidth = containerRef.current.clientWidth;
          
          document.body.removeChild(tempElement);
          
          // Check if text overflows
          const overflow = textWidth - containerWidth;
          
          // Add small threshold (2px) to account for measurement inaccuracies
          // Only add hover handlers and animate if text is clearly overflowing
          if (overflow > 2) {
            const container = containerRef.current;
            
            // Remove existing listeners if any
            container.removeEventListener('mouseenter', animateToEnd);
            container.removeEventListener('mouseleave', resetAnimation);
            
            // Add hover handlers
            container.addEventListener('mouseenter', animateToEnd);
            container.addEventListener('mouseleave', resetAnimation);
            
            // Ensure text starts in original state (not scrolled)
            if (textRef.current) {
              textRef.current.style.transition = 'none';
              textRef.current.style.transform = 'translateX(0)';
            }
          } else {
            // Remove listeners if text fits
            const container = containerRef.current;
            container.removeEventListener('mouseenter', animateToEnd);
            container.removeEventListener('mouseleave', resetAnimation);
            // Reset transform
            if (textRef.current) {
              textRef.current.style.transition = 'none';
              textRef.current.style.transform = 'translateX(0)';
            }
          }
        });
      };
      
      const timeoutId = setTimeout(setupAnimation, 100);
      window.addEventListener('resize', setupAnimation);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', setupAnimation);
        if (containerRef.current) {
          containerRef.current.removeEventListener('mouseenter', animateToEnd);
          containerRef.current.removeEventListener('mouseleave', resetAnimation);
        }
      };
    }
  }, [open, children]);

  if (!open) return null;

  return (
    <ScrollableText
      ref={containerRef}
      sx={{
        ...sx,
        display: 'flex',
        alignItems: 'center',
      }}
      {...props}
    >
      <Box
        ref={textRef}
        className="text-content"
        component="span"
        sx={{
          whiteSpace: 'nowrap',
          display: 'inline-block',
          lineHeight: 1.5,
        }}
      >
        {children}
      </Box>
    </ScrollableText>
  );
}

export default function Sidebar({ open, headerHeight = 64 }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  // Загрузка данных пользователя
  useEffect(() => {
    loadUserData();
    
    // Слушаем событие обновления профиля для синхронизации аватара
    const handleProfileUpdate = () => {
      loadUserData();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

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
      } else if (res.status === 401) {
        // Токен истек или невалидный - очищаем и перенаправляем на страницу входа
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rememberMe');
        // Не логируем ошибку - это нормальная ситуация при истекшем токене
        navigate('/login');
      }
    } catch (error) {
      // Логируем только реальные ошибки сети, не ошибки авторизации
      if (!error.message || !error.message.includes('401')) {
        console.error('Error loading user data:', error);
      }
    }
  };

  /* берём имя из localStorage или данных пользователя; если нет – показываем "?" */
  const username = (user?.username || localStorage.getItem('username') || '?').trim();
  const avatarUrl = user?.avatar_url || null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('rememberMe');
    navigate('/login');
  };

  const navItems = [
    { icon: <HomeIcon   />, label: t('app.home'),   route: '/app'        },
    { icon: <CloudIcon />, label: t('app.weather'), route: '/app/weather' },
    { icon: <LayersIcon />, label: t('app.layers'), route: '/app/layers' },
    { icon: <GridOnIcon />, label: t('app.hecRas'),  route: '/app/hec-ras'  },
    { icon: <WaterDropIcon />, label: t('app.floodModeling'), route: '/app/flood' },
    { icon: <TerrainIcon />, label: t('app.terrainMap'), route: '/app/stations' },
    { icon: <StorageIcon />, label: t('app.database'), route: '/app/database' },
    { icon: <MenuBookIcon />, label: t('app.instruction'), route: '/app/instruction' },
    { icon: <InfoIcon />, label: t('app.information'), route: '/app/information' },
  ];

  return (
    <Drawer variant="permanent" open={open}>
      {/* Spacer для выравнивания с header */}
      <Toolbar 
        disableGutters 
        sx={{ 
          minHeight: headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: open ? 2 : 1,
          gap: 1,
        }}
      >
        {/* Профиль пользователя */}
        <Tooltip title={!open ? t('app.profile') : ''} placement="right" arrow>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              width: '100%',
            }}
          >
            <Avatar
              role="button"
              tabIndex={0}
              onClick={() => navigate('/app/profile')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/app/profile')}
              src={avatarUrl}
              sx={{ 
                width: 32, 
                height: 32, 
                fontSize: 14,
                background: 'rgba(0, 119, 182, 0.2)',
                color: '#0077B6',
                cursor: 'pointer',
                mr: open ? 1.5 : 0,
                '&:hover': { 
                  backgroundColor: 'rgba(99, 102, 241, 0.3)',
                },
              }}
            >
              {!avatarUrl && username[0]}
            </Avatar>
            <ScrollableTextItem
              open={open}
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'visible',
              }}
            >
              <Typography
                component="span"
                variant="body2"
                fontWeight={500}
                sx={{
                  color: 'text.primary',
                  cursor: 'pointer',
                  userSelect: 'none',
                  lineHeight: 1.5,
                }}
                onClick={() => navigate('/app/profile')}
              >
                {t('app.profile')}
              </Typography>
            </ScrollableTextItem>
          </Box>
        </Tooltip>
      </Toolbar>

      <Divider />

      <List sx={{ flexGrow: 1 }}>
        {navItems.flatMap(({ icon, label, route }, index) => {
          const textRef = useRef(null);
          const containerRef = useRef(null);
          const scrollableTextRef = useRef(null);
          
          // Добавляем Divider после database
          const shouldAddDivider = route === '/app/database' && index < navItems.length - 1;

          const animateToEnd = () => {
            if (!textRef.current || !scrollableTextRef.current) return;

            // Reset before measuring
            textRef.current.style.transition = 'none';
            textRef.current.style.transform = 'translateX(0)';

            requestAnimationFrame(() => {
              if (!textRef.current || !scrollableTextRef.current) return;

              // Create temporary element to measure actual text width
              const tempElement = document.createElement('span');
              const styles = window.getComputedStyle(textRef.current);
              tempElement.style.position = 'absolute';
              tempElement.style.visibility = 'hidden';
              tempElement.style.whiteSpace = 'nowrap';
              tempElement.style.font = styles.font;
              tempElement.style.fontSize = styles.fontSize;
              tempElement.style.fontFamily = styles.fontFamily;
              tempElement.style.fontWeight = styles.fontWeight;
              tempElement.style.letterSpacing = styles.letterSpacing;
              tempElement.textContent = textRef.current.textContent || textRef.current.innerText;
              document.body.appendChild(tempElement);
              
              const textWidth = tempElement.getBoundingClientRect().width;
              const containerWidth = scrollableTextRef.current.clientWidth;
              
              document.body.removeChild(tempElement);

              const overflow = textWidth - containerWidth;
              
              // Add small threshold (2px) to account for measurement inaccuracies
              // Only animate if text is clearly overflowing
              if (overflow <= 2) {
                textRef.current.style.transform = 'translateX(0)';
                return;
              }

              // Speed control (60px per second)
              const speed = 60; // px/s
              const duration = overflow / speed;

              textRef.current.style.transition = `transform ${duration}s linear`;
              // Move exactly by the overflow amount so the last character is visible
              textRef.current.style.transform = `translateX(${-overflow}px)`;
            });
          };

          const resetAnimation = () => {
            if (!textRef.current) return;
            // Always return text to original state when mouse leaves
            textRef.current.style.transition = 'transform 0.3s ease-out';
            textRef.current.style.transform = 'translateX(0)';
          };

          useEffect(() => {
            if (open && textRef.current && scrollableTextRef.current) {
              const setupAnimation = () => {
                requestAnimationFrame(() => {
                  if (!textRef.current || !scrollableTextRef.current) return;
                  
                  // Create temporary element to measure actual text width
                  const tempElement = document.createElement('span');
                  const styles = window.getComputedStyle(textRef.current);
                  tempElement.style.position = 'absolute';
                  tempElement.style.visibility = 'hidden';
                  tempElement.style.whiteSpace = 'nowrap';
                  tempElement.style.font = styles.font;
                  tempElement.style.fontSize = styles.fontSize;
                  tempElement.style.fontFamily = styles.fontFamily;
                  tempElement.style.fontWeight = styles.fontWeight;
                  tempElement.style.letterSpacing = styles.letterSpacing;
                  tempElement.textContent = textRef.current.textContent || textRef.current.innerText;
                  document.body.appendChild(tempElement);
                  
                  const textWidth = tempElement.getBoundingClientRect().width;
                  const containerWidth = scrollableTextRef.current.clientWidth;
                  
                  document.body.removeChild(tempElement);
                  
                  // Check if text overflows
                  const overflow = textWidth - containerWidth;
                  
                  // Add small threshold (2px) to account for measurement inaccuracies
                  // Only add hover handlers and animate if text is clearly overflowing
                  if (overflow > 2) {
                    const container = scrollableTextRef.current;
                    
                    // Remove existing listeners if any
                    container.removeEventListener('mouseenter', animateToEnd);
                    container.removeEventListener('mouseleave', resetAnimation);
                    
                    // Add hover handlers
                    container.addEventListener('mouseenter', animateToEnd);
                    container.addEventListener('mouseleave', resetAnimation);
                    
                    // Ensure text starts in original state (not scrolled)
                    if (textRef.current) {
                      textRef.current.style.transition = 'none';
                      textRef.current.style.transform = 'translateX(0)';
                    }
                  } else {
                    // Remove listeners if text fits
                    const container = scrollableTextRef.current;
                    container.removeEventListener('mouseenter', animateToEnd);
                    container.removeEventListener('mouseleave', resetAnimation);
                    // Reset transform
                    if (textRef.current) {
                      textRef.current.style.transition = 'none';
                      textRef.current.style.transform = 'translateX(0)';
                    }
                  }
                });
              };
              
              const timeoutId = setTimeout(setupAnimation, 100);
              window.addEventListener('resize', setupAnimation);
              
              return () => {
                clearTimeout(timeoutId);
                window.removeEventListener('resize', setupAnimation);
                if (scrollableTextRef.current) {
                  scrollableTextRef.current.removeEventListener('mouseenter', animateToEnd);
                  scrollableTextRef.current.removeEventListener('mouseleave', resetAnimation);
                }
              };
            }
          }, [open, label]);

          const listItem = (
            <ListItem key={label} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={!open ? label : ''} placement="right" arrow>
                <ListItemButton
                  ref={containerRef}
                  onClick={() => navigate(route)}
                  selected={location.pathname === route}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    alignItems: 'center',
                    px: 2.5,
                    overflow: 'visible',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      '&:hover': {
                        backgroundColor: 'rgba(99, 102, 241, 0.16)',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 1.5 : 'auto',
                      justifyContent: 'center',
                      alignItems: 'center',
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </ListItemIcon>
                  {open && (
                    <ScrollableText
                      ref={scrollableTextRef}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        ref={textRef}
                        className="text-content"
                        component="span"
                        sx={{
                          overflow: 'visible',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          maxWidth: '100%',
                          lineHeight: 1.5,
                        }}
                      >
                        {label}
                      </Box>
                    </ScrollableText>
                  )}
                  {!open && (
                    <ListItemText 
                      primary={label} 
                      sx={{ opacity: 0 }} 
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );

          // Возвращаем массив: элемент и, возможно, Divider
          if (shouldAddDivider) {
            return [
              listItem,
              <Divider key={`divider-${label}`} sx={{ my: 1 }} />
            ];
          }
          return [listItem];
        })}
      </List>

      <Divider />

      <ListItem disablePadding sx={{ display: 'block' }}>
        <Tooltip title={!open ? t('app.logout') : ''} placement="right" arrow>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 48,
              justifyContent: open ? 'initial' : 'center',
              alignItems: 'center',
              px: 2.5,
              '&:hover': {
                backgroundColor: 'rgba(211, 47, 47, 0.08)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: open ? 1.5 : 'auto',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
                color: 'error.main',
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            <ScrollableTextItem
              open={open}
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'visible',
              }}
            >
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: 'error.main',
                  lineHeight: 1.5,
                }}
              >
                {t('app.logout')}
              </Typography>
            </ScrollableTextItem>
            {!open && (
              <ListItemText 
                primary={t('app.logout')} 
                sx={{ opacity: 0 }}
                primaryTypographyProps={{
                  sx: { color: 'error.main' }
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    </Drawer>
  );
}

