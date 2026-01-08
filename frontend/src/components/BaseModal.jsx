import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Базовый компонент для всплывающих окон (модальных окон)
 * 
 * @param {boolean} open - Открыто ли модальное окно
 * @param {function} onClose - Функция закрытия модального окна
 * @param {string} title - Заголовок модального окна
 * @param {React.ReactNode} children - Содержимое модального окна
 * @param {React.ReactNode} actions - Действия (кнопки) в нижней части модального окна
 * @param {string} maxWidth - Максимальная ширина ('xs' | 'sm' | 'md' | 'lg' | 'xl' | false)
 * @param {boolean} fullWidth - Занимать ли всю доступную ширину
 * @param {boolean} showCloseButton - Показывать ли кнопку закрытия в заголовке
 * @param {boolean} disableEscapeKeyDown - Отключить закрытие по Escape
 * @param {boolean} disableBackdropClick - Отключить закрытие при клике на фон
 * @param {object} titleSx - Дополнительные стили для заголовка
 * @param {object} contentSx - Дополнительные стили для контента
 * @param {object} actionsSx - Дополнительные стили для действий
 * @param {object} paperProps - Дополнительные пропсы для Paper компонента
 * @param {function} onBackdropClick - Кастомный обработчик клика на фон
 */
export default function BaseModal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  showCloseButton = true,
  disableEscapeKeyDown = false,
  disableBackdropClick = false,
  titleSx = {},
  contentSx = {},
  actionsSx = {},
  paperProps = {},
  onBackdropClick,
}) {
  const handleClose = (event, reason) => {
    if (reason === 'backdropClick' && disableBackdropClick) {
      return;
    }
    if (reason === 'escapeKeyDown' && disableEscapeKeyDown) {
      return;
    }
    if (onBackdropClick && reason === 'backdropClick') {
      onBackdropClick(event, reason);
      return;
    }
    onClose(event, reason);
  };

  const defaultPaperProps = {
    sx: {
      borderRadius: '16px',
      padding: '8px',
      ...paperProps.sx,
    },
    ...paperProps,
  };

  const defaultTitleSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontWeight: 700,
    fontSize: '1.5rem',
    pb: 1,
    ...titleSx,
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEscapeKeyDown={disableEscapeKeyDown}
      PaperProps={defaultPaperProps}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000, // Высокий z-index для перекрытия всех элементов
            pointerEvents: 'auto', // Явно блокируем взаимодействие
          },
        },
      }}
      sx={{
        zIndex: 10001, // Dialog должен быть выше backdrop
        '& .MuiBackdrop-root': {
          pointerEvents: 'auto', // Блокируем все взаимодействия под backdrop
          zIndex: 10000, // Высокий z-index для перекрытия всех элементов
        },
        '& .MuiDialog-container': {
          zIndex: 10001,
        },
        '& .MuiDialog-paper': {
          zIndex: 10001,
        },
      }}
    >
      {title && (
        <DialogTitle sx={defaultTitleSx}>
          <Box component="span">{title}</Box>
          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                color: (theme) => theme.palette.grey[500],
                '&:hover': {
                  color: (theme) => theme.palette.grey[700],
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}
      
      <DialogContent sx={contentSx}>
        {children}
      </DialogContent>

      {actions && (
        <DialogActions sx={{ padding: '16px 24px', ...actionsSx }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}







