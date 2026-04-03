// src/components/layout/Header.jsx
import React from 'react';
import { styled } from '@mui/material/styles';
import { AppBar as MuiAppBar, Toolbar, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useTranslation } from 'react-i18next';

const DRAWER_WIDTH = 240;

const AppBar = styled(MuiAppBar, { shouldForwardProp: (p) => p !== 'open' })(
  ({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    background: 'linear-gradient(135deg, #0077B6 0%, #48CAE4 100%)',
    color: '#FFFFFF',
    boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
      marginLeft: DRAWER_WIDTH,
      width: `calc(100% - ${DRAWER_WIDTH}px)`,
      transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    }),
  }),
);

export default function Header({ open, onToggle, headerHeight = 64 }) {
  const { t } = useTranslation();

  return (
    <AppBar position="fixed" open={open}>
      <Toolbar sx={{ minHeight: headerHeight }}>
        <IconButton
          edge="start"
          onClick={onToggle}
          sx={{
            mr: 2,
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {open ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>

        <Typography
          variant="h6"
          noWrap
          sx={{
            flexGrow: 1,
            color: '#FFFFFF',
            fontWeight: 700,
          }}
        >
          {t('app.portalTitle')}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

