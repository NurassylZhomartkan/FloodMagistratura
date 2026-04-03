import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Paper,
  Table, TableHead, TableBody,
  TableRow, TableCell, TextField, Menu,
  MenuItem, List, ListItem, ListItemText, Divider,
  InputAdornment, IconButton, Snackbar, Alert,
  CircularProgress,
} from '@mui/material'
import BaseModal from '../components/BaseModal'
import ShareIcon from '@mui/icons-material/Share'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '../utils/usePageTitle'
import PageContainer from '../components/layout/PageContainer'

const API_URL = '/api/hec-ras/'

/** Согласовано с `client_max_body_size` в docker/nginx/default.conf (512m). */
const MAX_HECRAS_UPLOAD_BYTES = 512 * 1024 * 1024

function detailFromJson(data) {
  if (!data || typeof data !== 'object') return null
  const d = data.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    const msgs = d.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && typeof item.msg === 'string') return item.msg
      return null
    }).filter(Boolean)
    if (msgs.length) return msgs.join(' ')
  }
  if (d != null && typeof d !== 'object') return String(d)
  return null
}

/**
 * Безопасно извлекает сообщение об ошибке из ответа (JSON, текст или HTML-страница прокси).
 */
async function getUploadErrorMessage(response, t) {
  if (response.status === 413 || response.status === 507) {
    return t(
      'hec.uploadPayloadTooLarge',
      'Файл слишком большой. Уменьшите размер файла или обратитесь к администратору.'
    )
  }
  const ct = (response.headers.get('content-type') || '').toLowerCase()
  let text = ''
  try {
    text = await response.text()
  } catch {
    return t('hec.uploadReadBodyFailed', 'Не удалось прочитать ответ сервера.')
  }
  const trimmed = text.trim()
  if (
    ct.includes('application/json') &&
    (trimmed.startsWith('{') || trimmed.startsWith('['))
  ) {
    try {
      const data = JSON.parse(trimmed)
      const fromDetail = detailFromJson(data)
      if (fromDetail) return fromDetail
    } catch {
      /* игнорируем и используем запасной текст */
    }
  }
  if (trimmed && !trimmed.startsWith('<') && trimmed.length < 2000) {
    return trimmed
  }
  return t('hec.uploadHttpError', { status: response.status })
}

const fileExceedsClientLimit = (file) =>
  Boolean(file && file.size > MAX_HECRAS_UPLOAD_BYTES)

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return iso;
  }
}

export default function HecRasProjects() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  usePageTitle('pageTitles.hecRas')

  const [projects, setProjects] = useState([])
  
  // Состояния для модального окна добавления
  const [openAdd, setOpenAdd] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  // Состояния для меню
  const [menuAnchorEl, setMenuAnchorEl] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  // Состояния для модальных окон
  const [openDelete, setOpenDelete] = useState(false)
  const [openRename, setOpenRename] = useState(false)
  const [openProperties, setOpenProperties] = useState(false)
  const [openShare, setOpenShare] = useState(false)
  const [shareProject, setShareProject] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [propertiesData, setPropertiesData] = useState(null)
  const [sharePassword, setSharePassword] = useState('')
  const [sharePasswordError, setSharePasswordError] = useState('')
  const [sharePasswordSuccess, setSharePasswordSuccess] = useState(false)
  const [loadingShareLink, setLoadingShareLink] = useState(false)
  const [showPasswordInput, setShowPasswordInput] = useState(false)

  // Загрузка списка проектов
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = () => {
    const token = localStorage.getItem('token')
    if (!token) return

    fetch(API_URL, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => setProjects(data))
      .catch(err => console.error('Fetch list error:', err))
  }

  // Функции для управления модальным окном добавления
  const handleClickOpen = () => {
    setOpenAdd(true)
  }

  const handleCloseAdd = () => {
    setOpenAdd(false)
    setNewProjectName('')
    setSelectedFile(null)
    setUploadError('')
    setUploading(false)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null
    setSelectedFile(file)
    setUploadError('')
    if (file && file.size > MAX_HECRAS_UPLOAD_BYTES) {
      setUploadError(
        t('hec.uploadFileTooLargeClient', {
          maxMb: Math.floor(MAX_HECRAS_UPLOAD_BYTES / (1024 * 1024)),
        })
      )
    }
  }

  // Функция для загрузки проекта на сервер
  const handleUpload = async () => {
    if (uploading) return
    setUploadError('')

    if (!newProjectName || !selectedFile) {
      setUploadError('Пожалуйста, укажите имя проекта и выберите файл.')
      return
    }

    if (selectedFile.size > MAX_HECRAS_UPLOAD_BYTES) {
      setUploadError(
        t('hec.uploadFileTooLargeClient', {
          maxMb: Math.floor(MAX_HECRAS_UPLOAD_BYTES / (1024 * 1024)),
        })
      )
      return
    }

    const formData = new FormData()
    formData.append('name', newProjectName)
    formData.append('file', selectedFile)

    const token = localStorage.getItem('token')

    setUploading(true)
    try {
      const res = await fetch('/api/hec-ras/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const msg = await getUploadErrorMessage(res, t)
        setUploadError(msg)
        return
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase()
      if (!ct.includes('application/json')) {
        setUploadError(
          t(
            'hec.uploadInvalidResponse',
            'Сервер вернул неожиданный ответ. Попробуйте позже или обратитесь к администратору.'
          )
        )
        return
      }

      try {
        await res.json()
      } catch {
        setUploadError(
          t(
            'hec.uploadInvalidResponse',
            'Сервер вернул неожиданный ответ. Попробуйте позже или обратитесь к администратору.'
          )
        )
        return
      }

      loadProjects()
      handleCloseAdd()
    } catch (err) {
      console.error('Upload error:', err)
      const isNetwork =
        err instanceof TypeError &&
        (err.message === 'Failed to fetch' || err.message.includes('NetworkError') || err.message.includes('Load failed'))
      setUploadError(
        isNetwork
          ? t(
              'hec.uploadNetworkError',
              'Сеть недоступна или запрос не выполнен. Проверьте подключение к интернету и попробуйте снова.'
            )
          : err instanceof Error
            ? err.message
            : t('hec.uploadUnknownError', 'Не удалось выполнить загрузку. Попробуйте снова.')
      )
    } finally {
      setUploading(false)
    }
  }

  // Обработка меню троеточия
  const handleMenuOpen = (event, project) => {
    event.stopPropagation()
    setSelectedProject(project)
    setMenuAnchorEl(event.currentTarget)
  }

  const handleCloseContextMenu = () => {
    setMenuAnchorEl(null)
  }

  const handleDeleteClick = () => {
    handleCloseContextMenu()
    setOpenDelete(true)
  }

  const handleRenameClick = () => {
    handleCloseContextMenu()
    setRenameValue(selectedProject.name)
    setOpenRename(true)
  }

  const handlePropertiesClick = async () => {
    handleCloseContextMenu()
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}${selectedProject.id}/properties`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setPropertiesData(data)
        setOpenProperties(true)
      }
    } catch (err) {
      console.error('Error fetching properties:', err)
    }
  }

  const handleShareClick = async (project) => {
    // Убеждаемся, что has_password инициализирован правильно (по умолчанию false)
    // Используем share_hash из проекта, если он есть
    setShareProject({
      ...project,
      share_hash: project.share_hash || null,
      has_password: project.has_password || false
    })
    setOpenShare(true)
    setSharePassword('')
    setSharePasswordError('')
    setSharePasswordSuccess(false)
    setLoadingShareLink(false)
    setShowPasswordInput(false)
    // Если ссылка уже есть, она отобразится автоматически
    // Если ссылки нет, пользователь должен нажать "Создать ссылку"
  }

  const handleCreateLink = async (regenerate = false) => {
    if (!shareProject) return
    
    setLoadingShareLink(true)
    try {
      const token = localStorage.getItem('token')
      // Если regenerate=true, создаем новую ссылку. Иначе получаем существующую или создаем новую
      const url = regenerate 
        ? `/api/hec-ras/${shareProject.id}/share?regenerate=true`
        : `/api/hec-ras/${shareProject.id}/share`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        // Обновляем share_hash в проекте
        setShareProject({ ...shareProject, share_hash: data.share_hash, has_password: data.has_password || false })
        // Обновляем список проектов, чтобы share_hash сохранился
        loadProjects()
      } else {
        console.error('Failed to generate share hash:', res.status)
        alert(t('hec.shareError', 'Не удалось создать ссылку'))
      }
    } catch (err) {
      console.error('Error generating share hash:', err)
      alert(t('hec.shareError', 'Не удалось создать ссылку'))
    } finally {
      setLoadingShareLink(false)
    }
  }

  const handleCopyLink = () => {
    if (!shareProject) return
    // Используем share_hash если он есть, иначе используем id
    const shareHash = shareProject.share_hash || shareProject.id
    const shareUrl = shareProject.share_hash 
      ? `${window.location.origin}/app/hec-ras/shared/${shareHash}`
      : `${window.location.origin}/app/hec-ras/${shareProject.id}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopySuccess(true)
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  const handleCloseShare = () => {
    setOpenShare(false)
    setShareProject(null)
    setSharePassword('')
    setSharePasswordError('')
    setSharePasswordSuccess(false)
    setShowPasswordInput(false)
  }

  const handleDeleteShare = async () => {
    if (!shareProject) return
    
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`/api/hec-ras/${shareProject.id}/share`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        // Обновляем проект, убирая share_hash
        setShareProject({ ...shareProject, share_hash: null, has_password: false })
        setSharePassword('')
        setSharePasswordError('')
        setSharePasswordSuccess(false)
        // Обновляем список проектов, чтобы share_hash удалился
        loadProjects()
      } else {
        const errData = await res.json()
        alert(errData.detail || t('hec.deleteShareError', 'Не удалось удалить ссылку'))
      }
    } catch (err) {
      console.error('Error deleting share hash:', err)
      alert(t('hec.deleteShareError', 'Не удалось удалить ссылку'))
    }
  }

  const handleSetPassword = async () => {
    if (!shareProject) return
    
    setSharePasswordError('')
    setSharePasswordSuccess(false)
    
    const token = localStorage.getItem('token')
    const formData = new FormData()
    if (sharePassword.trim()) {
      formData.append('password', sharePassword.trim())
    }
    
    try {
      const res = await fetch(`/api/hec-ras/${shareProject.id}/share`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setShareProject({ ...shareProject, has_password: data.has_password })
        setSharePassword('')
        setShowPasswordInput(false)
        setSharePasswordSuccess(true)
        setTimeout(() => setSharePasswordSuccess(false), 3000)
      } else {
        const errData = await res.json()
        setSharePasswordError(errData.detail || t('hec.setPasswordError', 'Не удалось установить пароль'))
      }
    } catch (err) {
      console.error('Error setting password:', err)
      setSharePasswordError(t('hec.setPasswordError', 'Не удалось установить пароль'))
    }
  }

  // Функции для удаления
  const handleDeleteConfirm = async () => {
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}${selectedProject.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        loadProjects()
        setOpenDelete(false)
        setSelectedProject(null)
      } else {
        const errData = await res.json()
        alert(errData.detail || t('hec.deleteError'))
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert(t('hec.deleteError'))
    }
  }

  // Функции для переименования
  const handleRenameConfirm = async () => {
    if (!renameValue.trim()) {
      alert(t('hec.enterNewName'))
      return
    }
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('new_name', renameValue.trim())

    try {
      const res = await fetch(`${API_URL}${selectedProject.id}/rename`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (res.ok) {
        loadProjects()
        setOpenRename(false)
        setSelectedProject(null)
        setRenameValue('')
      } else {
        const errData = await res.json()
        alert(errData.detail || t('hec.renameError'))
      }
    } catch (err) {
      console.error('Rename error:', err)
      alert(t('hec.renameError'))
    }
  }

  // Пустое состояние
  if (projects.length === 0) {
    return (
      <Box sx={{ 
        p: 4, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '60vh'
      }}>
        <Typography variant="h6" sx={{ mb: 3, color: 'text.secondary' }}>
          {t('hec.noProjects')}
        </Typography>
        <Button
          variant="contained"
          onClick={handleClickOpen}
          size="large"
        >
          {t('hec.add')}
        </Button>

        {/* Модальное окно для добавления проекта */}
        <BaseModal
          open={openAdd}
          onClose={handleCloseAdd}
          title={t('hec.addTitle', 'Добавить HEC-RAS проект')}
          confirmText={t('hec.save', 'Сохранить')}
          onConfirm={handleUpload}
          cancelText={t('hec.cancel', 'Отмена')}
          confirmLoading={uploading}
          confirmDisabled={fileExceedsClientLimit(selectedFile)}
          disableBackdropClick={uploading}
          disableEscapeKeyDown={uploading}
          showCloseButton={!uploading}
        >
          <TextField
            autoFocus
            required
            margin="dense"
            id="name"
            label={t('hec.name', 'Название проекта')}
            type="text"
            fullWidth
            variant="standard"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            disabled={uploading}
          />
          <Button
            variant="outlined"
            component="label"
            sx={{ mt: 2 }}
            disabled={uploading}
          >
            {t('hec.selectFile', 'Выбрать .db файл')}
            <input
              type="file"
              hidden
              required
              accept=".db"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </Button>
          {selectedFile && (
            <Typography sx={{ display: 'inline', ml: 2, fontStyle: 'italic' }}>{selectedFile.name}</Typography>
          )}
          {uploading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary">{t('hec.uploadUploading', 'Загрузка...')}</Typography>
            </Box>
          )}
          {uploadError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setUploadError('')}>
              {uploadError}
            </Alert>
          )}
        </BaseModal>
      </Box>
    )
  }

  // Состояние со списком файлов
  return (
    <PageContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          {t('hec.title')}
        </Typography>
        <Button
          variant="contained"
          onClick={handleClickOpen}
        >
          {t('hec.add')}
        </Button>
      </Box>

      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('hec.table.name', 'Название')}</TableCell>
              <TableCell>{t('hec.table.created', 'Дата создания')}</TableCell>
              <TableCell align="right">{t('hec.table.actions', 'Действия')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map(proj => (
              <TableRow key={proj.id}>
                <TableCell>{proj.name}</TableCell>
                <TableCell>
                  {fmtDateTime(proj.created_at)}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => navigate(`/app/hec-ras/${proj.id}`)}
                    sx={{ mr: 1 }}
                  >
                    {t('hec.view', 'Посмотреть')}
                  </Button>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, proj)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Меню троеточия */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseContextMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { handleCloseContextMenu(); handleShareClick(selectedProject) }}>
          {t('hec.share', 'Поделиться')}
        </MenuItem>
        <MenuItem onClick={handleRenameClick}>
          {t('hec.rename', 'Переименовать')}
        </MenuItem>
        <MenuItem onClick={handlePropertiesClick}>
          {t('hec.properties', 'Свойства')}
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          {t('hec.delete', 'Удалить')}
        </MenuItem>
      </Menu>

      {/* Модальное окно для добавления проекта */}
      <BaseModal
        open={openAdd}
        onClose={handleCloseAdd}
        title={t('hec.addTitle', 'Добавить HEC-RAS проект')}
        confirmText={t('hec.save', 'Сохранить')}
        onConfirm={handleUpload}
        cancelText={t('hec.cancel', 'Отмена')}
        confirmLoading={uploading}
        confirmDisabled={fileExceedsClientLimit(selectedFile)}
        disableBackdropClick={uploading}
        disableEscapeKeyDown={uploading}
        showCloseButton={!uploading}
      >
        <TextField
          autoFocus
          required
          margin="dense"
          id="name"
          label={t('hec.name', 'Название проекта')}
          type="text"
          fullWidth
          variant="standard"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          disabled={uploading}
        />
        <Button
          variant="outlined"
          component="label"
          sx={{ mt: 2 }}
          disabled={uploading}
        >
          {t('hec.selectFile', 'Выбрать .db файл')}
          <input
            type="file"
            hidden
            required
            accept=".db"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </Button>
        {selectedFile && (
          <Typography sx={{ display: 'inline', ml: 2, fontStyle: 'italic' }}>{selectedFile.name}</Typography>
        )}
        {uploading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">{t('hec.uploadUploading', 'Загрузка...')}</Typography>
          </Box>
        )}
        {uploadError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setUploadError('')}>
            {uploadError}
          </Alert>
        )}
      </BaseModal>

      {/* Модальное окно подтверждения удаления */}
      <BaseModal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title={t('hec.deleteConfirmTitle', 'Подтверждение удаления')}
        confirmText={t('hec.definitelyDelete', 'Точно удалить')}
        onConfirm={handleDeleteConfirm}
        confirmColor="error"
        cancelText={t('hec.cancel', 'Отмена')}
      >
        <Typography>
          {t('hec.deleteConfirm', 'Вы уверены, что хотите удалить этот файл?')}
        </Typography>
        {selectedProject && (
          <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
            {selectedProject.name}
          </Typography>
        )}
      </BaseModal>

      {/* Модальное окно переименования */}
      <BaseModal
        open={openRename}
        onClose={() => setOpenRename(false)}
        title={t('hec.renameTitle', 'Переименовать файл')}
        confirmText={t('hec.save', 'Сохранить')}
        onConfirm={handleRenameConfirm}
        cancelText={t('hec.cancel', 'Отмена')}
      >
        <TextField
          label={t('hec.oldName', 'Старое название')}
          value={selectedProject?.name || ''}
          fullWidth
          margin="dense"
          disabled
          sx={{ mb: 2 }}
        />
        <TextField
          autoFocus
          label={t('hec.newName', 'Новое название')}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          fullWidth
          margin="dense"
        />
      </BaseModal>

      {/* Модальное окно для шаринга */}
      <BaseModal
        open={openShare}
        onClose={handleCloseShare}
        title={t('hec.shareTitle', 'Поделиться проектом')}
        maxWidth="sm"
        actions={
          <Button onClick={handleCloseShare} variant="outlined">
            {t('hec.cancel', 'Отмена')}
          </Button>
        }
      >
          {!shareProject?.share_hash ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                {t('hec.shareDescription', 'Создайте ссылку для публичного доступа к проекту')}
              </Typography>
              <Button
                variant="contained"
                onClick={() => handleCreateLink(false)}
                disabled={loadingShareLink}
                sx={{ minWidth: '200px' }}
              >
                {loadingShareLink ? t('hec.creating', 'Создание...') : t('hec.createLink', 'Создать ссылку')}
              </Button>
            </div>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('hec.shareLink', 'Ссылка для просмотра')}:
              </Typography>
              <TextField
                fullWidth
                value={`${window.location.origin}/app/hec-ras/shared/${shareProject.share_hash}`}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleCopyLink} edge="end">
                        <ContentCopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              <Button
                variant="outlined"
                onClick={() => handleCreateLink(true)}
                disabled={loadingShareLink}
                fullWidth
                sx={{ mb: 3 }}
              >
                {loadingShareLink ? t('hec.creating', 'Создание...') : t('hec.createNewLink', 'Создать новую ссылку')}
              </Button>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold' }}>
                {t('hec.sharePassword', 'Пароль для доступа')}:
              </Typography>
              
              {showPasswordInput && (
                <>
                  <TextField
                    fullWidth
                    type="password"
                    label={shareProject.has_password ? t('hec.changePassword', 'Изменить пароль') : t('hec.setPassword', 'Установить пароль')}
                    value={sharePassword}
                    onChange={(e) => {
                      setSharePassword(e.target.value)
                      setSharePasswordError('')
                    }}
                    helperText={shareProject.has_password ? t('hec.passwordSet', 'Пароль установлен. Оставьте пустым для удаления.') : t('hec.passwordNotSet', 'Пароль не установлен')}
                    sx={{ mb: 2 }}
                  />
                  {sharePasswordError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSharePasswordError('')}>
                      {sharePasswordError}
                    </Alert>
                  )}
                  {sharePasswordSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSharePasswordSuccess(false)}>
                      {shareProject.has_password ? t('hec.passwordSetSuccess', 'Пароль успешно установлен') : t('hec.passwordRemovedSuccess', 'Пароль успешно удален')}
                    </Alert>
                  )}
                </>
              )}
              
              {!shareProject.has_password && !showPasswordInput ? (
                <Button
                  variant="outlined"
                  onClick={() => setShowPasswordInput(true)}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {t('hec.addPassword', 'Добавить пароль')}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  onClick={handleSetPassword}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {showPasswordInput && !shareProject.has_password 
                    ? t('hec.setPassword', 'Установить пароль')
                    : shareProject.has_password 
                    ? t('hec.removePassword', 'Удалить пароль')
                    : t('hec.setPassword', 'Установить пароль')}
                </Button>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Button
                variant="outlined"
                color="error"
                onClick={handleDeleteShare}
                fullWidth
              >
                {t('hec.deleteShare', 'Удалить ссылку')}
              </Button>
            </>
          )}
      </BaseModal>

      {/* Уведомление о копировании */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySuccess(false)} severity="success" sx={{ width: '100%' }}>
          {t('hec.shareLinkCopied', 'Ссылка скопирована в буфер обмена')}
        </Alert>
      </Snackbar>

      {/* Модальное окно свойств */}
      <BaseModal
        open={openProperties}
        onClose={() => setOpenProperties(false)}
        title={t('hec.propertiesTitle', 'Свойства файла')}
        maxWidth="md"
        actions={
          <Button onClick={() => setOpenProperties(false)} variant="outlined">
            {t('hec.cancel', 'Отмена')}
          </Button>
        }
      >
          {propertiesData && (
            <List>
              {/* Основная информация */}
              <ListItem>
                <ListItemText 
                  primary={t('hec.fileName', 'Имя файла')}
                  secondary={propertiesData.name}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary={t('hec.originalFileName', 'Оригинальное имя файла')}
                  secondary={propertiesData.original_filename}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary={t('hec.dateAdded', 'Дата добавления')}
                  secondary={fmtDateTime(propertiesData.created_at)}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary={t('hec.fileSize', 'Размер файла')}
                  secondary={propertiesData.file_size_formatted || '0.00 MB'}
                />
              </ListItem>
              
              {/* Структурированные данные из .db */}
              {propertiesData.structured_data && (
                <>
                  <Divider />
                  <ListItem>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
                      Данные из .db файла:
                    </Typography>
                  </ListItem>
                  
                  {/* Временной диапазон */}
                  {propertiesData.structured_data.times && (
                    <>
                      <ListItem>
                        <ListItemText 
                          primary="Временной диапазон"
                          secondary={
                            propertiesData.structured_data.times.count > 0
                              ? `${propertiesData.structured_data.times.count} временных шагов: от ${propertiesData.structured_data.times.first} до ${propertiesData.structured_data.times.last}`
                              : 'Нет временных данных'
                          }
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  
                  {/* Масштабы (zoom) */}
                  {propertiesData.structured_data.zoom && (
                    <>
                      <ListItem>
                        <ListItemText 
                          primary="Масштабы (zoom)"
                          secondary={
                            propertiesData.structured_data.zoom.min !== null && propertiesData.structured_data.zoom.max !== null
                              ? `Тайлы есть на уровнях z = ${propertiesData.structured_data.zoom.min} … ${propertiesData.structured_data.zoom.max}`
                              : 'Информация о zoom недоступна'
                          }
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  
                  {/* Количество тайлов */}
                  {propertiesData.structured_data.tile_count > 0 && (
                    <>
                      <ListItem>
                        <ListItemText 
                          primary="Количество тайлов"
                          secondary={`Всего записей: ${propertiesData.structured_data.tile_count} тайлов`}
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  
                  {/* Информация о проекте */}
                  {propertiesData.structured_data.project && 
                   (propertiesData.structured_data.project.project_name || 
                    propertiesData.structured_data.project.plan_name || 
                    propertiesData.structured_data.project.map_type) && (
                    <>
                      <ListItem>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {t('hec.projectInfo')}:
                        </Typography>
                      </ListItem>
                      {propertiesData.structured_data.project.project_name && (
                        <>
                          <ListItem>
                            <ListItemText 
                              primary={t('hec.projectName')}
                              secondary={propertiesData.structured_data.project.project_name}
                            />
                          </ListItem>
                          <Divider />
                        </>
                      )}
                      {propertiesData.structured_data.project.plan_name && (
                        <>
                          <ListItem>
                            <ListItemText 
                              primary={t('hec.planName')}
                              secondary={propertiesData.structured_data.project.plan_name}
                            />
                          </ListItem>
                          <Divider />
                        </>
                      )}
                      {propertiesData.structured_data.project.map_type && (
                        <>
                          <ListItem>
                            <ListItemText 
                              primary="Тип карты"
                              secondary={propertiesData.structured_data.project.map_type}
                            />
                          </ListItem>
                          <Divider />
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Географические данные */}
                  {propertiesData.structured_data.geography && 
                   (propertiesData.structured_data.geography.left || 
                    propertiesData.structured_data.geography.right || 
                    propertiesData.structured_data.geography.bottom || 
                    propertiesData.structured_data.geography.top) && (
                    <>
                      <ListItem>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
                          География (WGS84):
                        </Typography>
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Границы"
                          secondary={
                            propertiesData.structured_data.geography.left && 
                            propertiesData.structured_data.geography.right &&
                            propertiesData.structured_data.geography.bottom &&
                            propertiesData.structured_data.geography.top
                              ? `Запад: ${propertiesData.structured_data.geography.left}, Восток: ${propertiesData.structured_data.geography.right}, Юг: ${propertiesData.structured_data.geography.bottom}, Север: ${propertiesData.structured_data.geography.top}`
                              : 'Границы не определены'
                          }
                        />
                      </ListItem>
                      {(propertiesData.structured_data.geography.centerx || 
                        propertiesData.structured_data.geography.centery || 
                        propertiesData.structured_data.geography.centerz) && (
                        <>
                          <Divider />
                          <ListItem>
                            <ListItemText 
                              primary="Центр и стартовый зум"
                              secondary={
                                `Центр: (${propertiesData.structured_data.geography.centerx || 'N/A'}, ${propertiesData.structured_data.geography.centery || 'N/A'}), Zoom: ${propertiesData.structured_data.geography.centerz || 'N/A'}`
                              }
                            />
                          </ListItem>
                        </>
                      )}
                      <Divider />
                    </>
                  )}
                  
                  {/* Легенда */}
                  {propertiesData.structured_data.legend && 
                   (propertiesData.structured_data.legend.values || 
                    propertiesData.structured_data.legend.rgba) && (
                    <>
                      <ListItem>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
                          Легенда:
                        </Typography>
                      </ListItem>
                      {propertiesData.structured_data.legend.values && (
                        <>
                          <ListItem>
                            <ListItemText 
                              primary="Значения"
                              secondary={propertiesData.structured_data.legend.values}
                            />
                          </ListItem>
                          <Divider />
                        </>
                      )}
                      {propertiesData.structured_data.legend.rgba && (
                        <ListItem>
                          <ListItemText 
                            primary="Цвета (RGBA)"
                            secondary={`${propertiesData.structured_data.legend.rgba.split(',').length / 4} цветов`}
                          />
                        </ListItem>
                      )}
                    </>
                  )}
                </>
              )}
            </List>
          )}
      </BaseModal>
    </PageContainer>
  )
}
