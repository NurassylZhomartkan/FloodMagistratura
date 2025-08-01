import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Paper,
  Table, TableHead, TableBody,
  TableRow, TableCell, Dialog, DialogActions,
  DialogContent, DialogTitle, TextField
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const API_URL = '/api/hec-ras/'

export default function HecRasProjects() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  
  // Состояния для модального окна
  const [open, setOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')

  // Загрузка списка проектов
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    fetch(API_URL, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => setProjects(data))
      .catch(err => console.error('Fetch list error:', err))
  }, [])

  // Функции для управления модальным окном
  const handleClickOpen = () => {
    setOpen(true)
  };

  const handleClose = () => {
    setOpen(false)
    // Сбрасываем значения при закрытии
    setNewProjectName('')
    setSelectedFile(null)
    setUploadError('')
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null)
  };

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
          // Для FormData 'Content-Type' устанавливается браузером автоматически
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Ошибка при загрузке проекта')
      }

      const newProject = await res.json()
      // Добавляем новый проект в список без перезагрузки страницы
      setProjects(prevProjects => [...prevProjects, newProject])
      handleClose() // Закрываем окно при успехе

    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(err.message)
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        {t('hec.title')}
      </Typography>

      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('hec.table.name','Название')}</TableCell>
              <TableCell>{t('hec.table.created','Дата создания')}</TableCell>
              <TableCell align="right">{t('hec.table.actions','Действия')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map(proj => (
              <TableRow key={proj.id}>
                <TableCell>{proj.name}</TableCell>
                <TableCell>
                  {new Date(proj.created_at).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => navigate(`${proj.id}`)}
                  >
                    {t('hec.view','Посмотреть')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Кнопка теперь открывает модальное окно */}
      <Button
        variant="contained"
        onClick={handleClickOpen}
      >
        {t('hec.add')}
      </Button>

      {/* Модальное окно для добавления проекта */}
      <Dialog open={open} onClose={handleClose} PaperProps={{ component: 'form' }}>
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
          <Button onClick={handleClose}>{t('hec.cancel', 'Отмена')}</Button>
          {/* Кнопка "Сохранить" теперь вызывает функцию загрузки */}
          <Button type="button" onClick={handleUpload}>{t('hec.save', 'Сохранить')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
