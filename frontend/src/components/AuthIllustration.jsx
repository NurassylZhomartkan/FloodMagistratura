import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import floodImage from '../assets/floodsiteBackground.jpg';

export default function AuthIllustration() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `url(${floodImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(0, 77, 153, 0.75) 0%, rgba(0, 180, 216, 0.65) 100%)',
          zIndex: 1,
        },
      }}
    >
      {/* Декоративный оверлей с текстом */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          textAlign: 'center',
          color: 'white',
        }}
      >
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: 4,
            maxWidth: '400px',
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              mb: 2,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            }}
          >
            {t('authIllustration.title')}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 400,
              opacity: 0.95,
              textShadow: '0 1px 5px rgba(0, 0, 0, 0.3)',
            }}
          >
            {t('authIllustration.subtitle')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

