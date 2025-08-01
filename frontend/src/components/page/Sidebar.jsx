// src/components/page/Sidebar.jsx
import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box, Drawer as MuiDrawer, AppBar as MuiAppBar, Toolbar,
  CssBaseline, List, Typography, Divider, IconButton,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar,
} from '@mui/material';
import MenuIcon        from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeIcon   from '@mui/icons-material/Home';
import LayersIcon from '@mui/icons-material/Layers';
import GridOnIcon from '@mui/icons-material/GridOn';
import { useNavigate }   from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DRAWER_WIDTH  = 240;
const HEADER_HEIGHT = 64;

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
  width: HEADER_HEIGHT,
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
    ...(open
      ? { ...opened(theme), '& .MuiDrawer-paper': opened(theme) }
      : { ...closed(theme), '& .MuiDrawer-paper': closed(theme) }),
  }),
);
const AppBar = styled(MuiAppBar, { shouldForwardProp: (p) => p !== 'open' })(
  ({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
      easing  : theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
      marginLeft: DRAWER_WIDTH,
      width     : `calc(100% - ${DRAWER_WIDTH}px)`,
      transition: theme.transitions.create(['width', 'margin'], {
        easing  : theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    }),
  }),
);
/* ------------------------------------ */

export default function MiniDrawer({ children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  /* берём имя из localStorage; если нет – показываем "?" */
  const username =
    (localStorage.getItem('username') || '?').trim().toUpperCase();

  const navItems = [
    { icon: <HomeIcon   />, label: t('app.home'),   route: '/app'        },
    { icon: <LayersIcon />, label: t('app.layers'), route: '#' },
    { icon: <GridOnIcon />, label: t('app.hecRas'),  route: '/app/hec-ras'  },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* ---------- TOP BAR ---------- */}
      <AppBar position="fixed" open={open}>
        <Toolbar sx={{ minHeight: HEADER_HEIGHT }}>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(!open)} sx={{ mr: 2 }}>
            {open ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>

          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {t('app.portalTitle')}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* ---------- SIDE DRAWER ---------- */}
      <Drawer variant="permanent" open={open}>
        {open ? (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/profile')}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/app/profile')}
            sx={{
              height: HEADER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              px: 2,
              gap: 1.5,
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
              {username}
            </Avatar>
            <Typography variant="body2" fontWeight={500} noWrap sx={{ ml: 2 }}>
              {t('app.profile')}
            </Typography>
          </Box>
        ) : (
          <Toolbar disableGutters sx={{ minHeight: HEADER_HEIGHT }} />
        )}

        <Divider />

        <List>
          {navItems.map(({ icon, label, route }) => (
            <ListItem key={label} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => navigate(route)}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {icon}
                </ListItemIcon>
                <ListItemText primary={label} sx={{ opacity: open ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* ---------- CONTENT ---------- */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar sx={{ minHeight: HEADER_HEIGHT }} />
        {children}
      </Box>
    </Box>
  );
}
