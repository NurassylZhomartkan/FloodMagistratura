import { createTheme } from '@mui/material/styles';

// Палитра "Вода" — для сайта мониторинга затоплений
const PRIMARY = '#0077B6';        // Океанский синий
const PRIMARY_DARK = '#023E8A';   // Глубокий океан
const PRIMARY_LIGHT = '#48CAE4';  // Поверхностная вода
const PRIMARY_BG = '#E8F4F8';     // Лёгкая водяная дымка

const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY,
      dark: PRIMARY_DARK,
      light: PRIMARY_LIGHT,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#64748B',
      dark: '#475569',
      light: '#94A3B8',
    },
    error: {
      main: '#DC2626',
      dark: '#B91C1C',
      light: '#FEF2F2',
    },
    warning: {
      main: '#D97706',
      dark: '#B45309',
      light: '#FFFBEB',
    },
    success: {
      main: '#059669',
      dark: '#047857',
      light: '#ECFDF5',
    },
    info: {
      main: '#0284C7',
      dark: '#0369A1',
      light: '#F0F9FF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      disabled: '#94A3B8',
    },
    background: {
      default: '#F0F4F8',
      paper: '#FFFFFF',
    },
    divider: '#CBD5E1',
  },

  shape: {
    borderRadius: 12,
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800, fontSize: '2rem' },
    h2: { fontWeight: 700, fontSize: '1.75rem' },
    h3: { fontWeight: 700, fontSize: '1.5rem' },
    h4: { fontWeight: 700, fontSize: '1.25rem' },
    h5: { fontWeight: 600, fontSize: '1.125rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },

  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.08)',
    '0 2px 8px rgba(0,0,0,0.1)',
    '0 4px 12px rgba(0,0,0,0.12)',
    '0 4px 14px 0 rgba(0, 119, 182, 0.35)',
    ...Array(21).fill('0 4px 14px 0 rgba(0, 119, 182, 0.35)'),
  ],

  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: false,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
        },
        contained: {
          boxShadow: '0 4px 14px 0 rgba(0, 119, 182, 0.35)',
          '&:hover': {
            boxShadow: '0 6px 20px 0 rgba(0, 119, 182, 0.45)',
          },
        },
        containedPrimary: {
          backgroundColor: PRIMARY,
          '&:hover': {
            backgroundColor: PRIMARY_DARK,
          },
        },
        containedError: {
          boxShadow: '0 4px 14px 0 rgba(220, 38, 38, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 20px 0 rgba(220, 38, 38, 0.4)',
          },
        },
        outlined: {
          borderColor: '#CBD5E1',
          color: '#64748B',
          '&:hover': {
            borderColor: PRIMARY,
            color: PRIMARY,
            backgroundColor: PRIMARY_BG,
          },
        },
        sizeSmall: {
          padding: '6px 16px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '12px 32px',
          fontSize: '1rem',
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          color: '#64748B',
          '&:hover': {
            color: PRIMARY,
            backgroundColor: PRIMARY_BG,
          },
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#F8FAFC',
            '& fieldset': {
              borderColor: '#CBD5E1',
            },
            '&:hover fieldset': {
              borderColor: PRIMARY,
            },
            '&.Mui-focused fieldset': {
              borderColor: PRIMARY,
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: PRIMARY,
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#CBD5E1',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: PRIMARY,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: PRIMARY,
          },
        },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: PRIMARY,
          '&.Mui-checked': {
            color: PRIMARY,
          },
        },
      },
    },

    MuiRadio: {
      styleOverrides: {
        root: {
          color: PRIMARY,
          '&.Mui-checked': {
            color: PRIMARY,
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          padding: 8,
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: '1.5rem',
          paddingBottom: 8,
        },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },

    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        autoHideDuration: 4000,
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#CBD5E1',
        },
        bar: {
          borderRadius: 4,
        },
      },
    },

    MuiLink: {
      styleOverrides: {
        root: {
          color: PRIMARY,
          textDecoration: 'none',
          fontWeight: 500,
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
  },
});

export default theme;
