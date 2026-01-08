import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

/**
 * Компонент для защиты приватных маршрутов.
 * При загрузке страницы первым делом проверяет авторизацию через API.
 * Если пользователь не авторизован или токен невалидный, перенаправляет на страницу входа.
 */
export default function PrivateRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      // Если токена нет, сразу перенаправляем
      if (!token) {
        setIsChecking(false);
        setIsAuthorized(false);
        return;
      }

      try {
        // Проверяем валидность токена через API
        const response = await fetch('/auth/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          // Токен валидный, пользователь авторизован
          setIsAuthorized(true);
        } else {
          // Токен невалидный или истек - очищаем и перенаправляем
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('rememberMe');
          setIsAuthorized(false);
        }
      } catch (error) {
        // Ошибка при проверке - считаем неавторизованным
        // Проверяем, не является ли это ошибкой расширения Chrome
        const errorMessage = error?.message || error?.toString() || '';
        const isChromeExtensionError = errorMessage.toLowerCase().includes('could not establish connection') ||
                                       errorMessage.toLowerCase().includes('receiving end does not exist') ||
                                       errorMessage.toLowerCase().includes('chrome-extension://');
        
        // Логируем только если это не ошибка расширения Chrome
        if (!isChromeExtensionError) {
          console.error('Error checking authorization:', error);
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rememberMe');
        setIsAuthorized(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, []);

  // Пока проверяем авторизацию, показываем индикатор загрузки
  if (isChecking) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Если не авторизован, перенаправляем на страницу входа
  if (!isAuthorized) {
    // Сохраняем URL, на который пользователь пытался зайти, для редиректа после входа
    const currentPath = window.location.pathname;
    if (currentPath !== '/login') {
      sessionStorage.setItem('redirectAfterLogin', currentPath);
    }
    return <Navigate to="/login" replace />;
  }

  // Пользователь авторизован, показываем содержимое
  return children;
}

