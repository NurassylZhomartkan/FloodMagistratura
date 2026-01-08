import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Paper,
  Table, TableHead, TableBody,
  TableRow, TableCell, Dialog, DialogActions,
  DialogContent, DialogTitle, TextField, Menu,
  MenuItem, List, ListItem, ListItemText, Divider,
  InputAdornment, IconButton, Snackbar, Alert
} from '@mui/material'
import ShareIcon from '@mui/icons-material/Share'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '../utils/usePageTitle'
import PageContainer from '../components/layout/PageContainer'

const API_URL = '/api/hec-ras/'

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

  // Состояния для контекстного меню
  const [contextMenu, setContextMenu] = useState(null)
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
  }

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null)
  }

  // Функция для загрузки проекта на сервер
  const handleUpload = async () => {
    if (!newProjectName || !selectedFile) {
      setUploadError('Пожалуйста, укажите имя проекта и выберите файл.')
      return
    }

    const formData = new FormData()
    formData.append('name', newProjectName)
    formData.append('file', selectedFile)

    const token = localStorage.getItem('token')

    try {
      const res = await fetch('/api/hec-ras/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || t('hec.loadError'))
      }

      await res.json()
      loadProjects() // Перезагружаем список
      handleCloseAdd()

    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(err.message)
    }
  }

  // Обработка контекстного меню
  const handleContextMenu = (event, project) => {
    event.preventDefault()
    setSelectedProject(project)
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null,
    )
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null)
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
        <Dialog open={openAdd} onClose={handleCloseAdd} PaperProps={{ component: 'form' }}>
          <DialogTitle>{t('hec.addTitle', 'Добавить HEC-RAS проект')}</DialogTitle>
          <DialogContent>
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
            />
            <Button
              variant="outlined"
              component="label"
              sx={{ mt: 2 }}
            >
              {t('hec.selectFile', 'Выбрать .db файл')}
              <input
                type="file"
                hidden
                required
                accept=".db"
                onChange={handleFileChange}
              />
            </Button>
            {selectedFile && <Typography sx={{ display: 'inline', ml: 2, fontStyle: 'italic' }}>{selectedFile.name}</Typography>}
            {uploadError && <Typography color="error" sx={{ mt: 2 }}>{uploadError}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAdd}>{t('hec.cancel', 'Отмена')}</Button>
            <Button type="button" onClick={handleUpload}>{t('hec.save', 'Сохранить')}</Button>
          </DialogActions>
        </Dialog>
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
            <TableRow
              onContextMenu={(e) => handleContextMenu(e, null)}
              sx={{ cursor: 'context-menu' }}
            >
              <TableCell>{t('hec.table.name', 'Название')}</TableCell>
              <TableCell>{t('hec.table.created', 'Дата создания')}</TableCell>
              <TableCell align="right">{t('hec.table.actions', 'Действия')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map(proj => (
              <TableRow 
                key={proj.id}
                onContextMenu={(e) => handleContextMenu(e, proj)}
                sx={{ cursor: 'context-menu' }}
              >
                <TableCell>{proj.name}</TableCell>
                <TableCell>
                  {new Date(proj.created_at).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => navigate(`/app/hec-ras/${proj.id}`)}
                    sx={{ mr: 1 }}
                  >
                    {t('hec.view', 'Посмотреть')}
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ShareIcon />}
                    onClick={() => handleShareClick(proj)}
                    variant="outlined"
                  >
                    {t('hec.share', 'Поделиться')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Контекстное меню */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleDeleteClick} disabled={!selectedProject}>
          {t('hec.delete', 'Удалить')}
        </MenuItem>
        <MenuItem onClick={handleRenameClick} disabled={!selectedProject}>
          {t('hec.rename', 'Переименовать')}
        </MenuItem>
        <MenuItem onClick={handlePropertiesClick} disabled={!selectedProject}>
          {t('hec.properties', 'Свойства')}
        </MenuItem>
      </Menu>

      {/* Модальное окно для добавления проекта */}
      <Dialog open={openAdd} onClose={handleCloseAdd} PaperProps={{ component: 'form' }}>
        <DialogTitle>{t('hec.addTitle', 'Добавить HEC-RAS проект')}</DialogTitle>
        <DialogContent>
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
          />
          <Button
            variant="outlined"
            component="label"
            sx={{ mt: 2 }}
          >
            {t('hec.selectFile', 'Выбрать .db файл')}
            <input
              type="file"
              hidden
              required
              accept=".db"
              onChange={handleFileChange}
            />
          </Button>
          {selectedFile && <Typography sx={{ display: 'inline', ml: 2, fontStyle: 'italic' }}>{selectedFile.name}</Typography>}
          {uploadError && <Typography color="error" sx={{ mt: 2 }}>{uploadError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAdd}>{t('hec.cancel', 'Отмена')}</Button>
          <Button type="button" onClick={handleUpload}>{t('hec.save', 'Сохранить')}</Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно подтверждения удаления */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>{t('hec.deleteConfirmTitle', 'Подтверждение удаления')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('hec.deleteConfirm', 'Вы уверены, что хотите удалить этот файл?')}
          </Typography>
          {selectedProject && (
            <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
              {selectedProject.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>{t('hec.cancel', 'Отмена')}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('hec.definitelyDelete', 'Точно удалить')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно переименования */}
      <Dialog open={openRename} onClose={() => setOpenRename(false)}>
        <DialogTitle>{t('hec.renameTitle', 'Переименовать файл')}</DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRename(false)}>{t('hec.cancel', 'Отмена')}</Button>
          <Button onClick={handleRenameConfirm} variant="contained">
            {t('hec.save', 'Сохранить')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно для шаринга */}
      <Dialog open={openShare} onClose={handleCloseShare} maxWidth="sm" fullWidth>
        <DialogTitle>{t('hec.shareTitle', 'Поделиться проектом')}</DialogTitle>
        <DialogContent>
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
                    ? t('hec.add', 'Добавить')
                    : shareProject.has_password 
                    ? t('hec.removePassword', 'Удалить пароль')
                    : t('hec.add', 'Добавить')}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShare}>{t('hec.cancel', 'Отмена')}</Button>
        </DialogActions>
      </Dialog>

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
      <Dialog open={openProperties} onClose={() => setOpenProperties(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('hec.propertiesTitle', 'Свойства файла')}</DialogTitle>
        <DialogContent>
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
                  secondary={(() => {
                    const date = new Date(propertiesData.created_at);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
                  })()}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProperties(false)}>{t('hec.cancel', 'Отмена')}</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
