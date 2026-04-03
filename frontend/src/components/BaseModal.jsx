import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Базовый компонент для всплывающих окон (модальных окон).
 * Все модальные окна на сайте должны использовать этот компонент
 * для обеспечения единого стиля.
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {React.ReactNode} children
 * @param {React.ReactNode} actions — кастомные actions (если нужен полный контроль)
 * @param {string} maxWidth — 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
 * @param {boolean} fullWidth
 * @param {boolean} showCloseButton
 * @param {boolean} disableEscapeKeyDown
 * @param {boolean} disableBackdropClick
 * @param {object} titleSx
 * @param {object} contentSx
 * @param {object} actionsSx
 * @param {object} paperProps
 *
 * Стандартные кнопки подтверждения / отмены:
 * @param {string} confirmText — текст кнопки подтверждения
 * @param {function} onConfirm — обработчик подтверждения
 * @param {string} cancelText — текст кнопки отмены
 * @param {function} onCancel — обработчик отмены (по умолчанию = onClose)
 * @param {boolean} confirmLoading — показать спиннер на кнопке подтверждения
 * @param {boolean} confirmDisabled — отключить кнопку подтверждения
 * @param {string} confirmColor — цвет кнопки подтверждения ('primary' | 'error')
 * @param {boolean} hideCancel — скрыть кнопку отмены
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
  confirmText,
  onConfirm,
  cancelText,
  onCancel,
  confirmLoading = false,
  confirmDisabled = false,
  confirmColor = 'primary',
  hideCancel = false,
}) {
  const handleClose = (event, reason) => {
    if (reason === 'backdropClick' && disableBackdropClick) return;
    if (reason === 'escapeKeyDown' && disableEscapeKeyDown) return;
    onClose(event, reason);
  };

  const handleCancel = onCancel || onClose;

  const renderActions = () => {
    if (actions) return actions;

    if (!onConfirm && !confirmText) return null;

    return (
      <>
        {!hideCancel && (
          <Button
            onClick={handleCancel}
            variant="outlined"
            disabled={confirmLoading}
          >
            {cancelText || 'Отмена'}
          </Button>
        )}
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={confirmDisabled || confirmLoading}
        >
          {confirmLoading ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            confirmText || 'Подтвердить'
          )}
        </Button>
      </>
    );
  };

  const computedActions = renderActions();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEscapeKeyDown={disableEscapeKeyDown}
      PaperProps={paperProps}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
          },
        },
      }}
      sx={{
        zIndex: 10001,
        '& .MuiDialog-container': { zIndex: 10001 },
        '& .MuiDialog-paper': { zIndex: 10001 },
      }}
    >
      {title && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...titleSx,
          }}
        >
          <Box component="span">{title}</Box>
          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}

      <DialogContent sx={contentSx}>
        {children}
      </DialogContent>

      {computedActions && (
        <DialogActions sx={actionsSx}>
          {computedActions}
        </DialogActions>
      )}
    </Dialog>
  );
}
