/**
 * Утилиты для работы с авторизацией
 */

/**
 * Обрабатывает ответ от API и проверяет статус авторизации
 * Если получен 401, очищает токен и перенаправляет на страницу входа
 * @param {Response} response - Ответ от fetch запроса
 * @param {Function} navigate - Функция навигации из react-router-dom
 * @param {boolean} autoRedirect - Автоматически перенаправлять на логин при 401 (по умолчанию true)
 * @returns {boolean} - true, если ответ успешный, false если была ошибка авторизации
 */
export function handleAuthResponse(response, navigate = null, autoRedirect = true) {
  if (response.status === 401) {
    // Токен истек или невалидный - очищаем
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('rememberMe');
    
    // Перенаправляем только если autoRedirect = true
    if (autoRedirect) {
      if (navigate) {
        navigate('/login');
      } else {
        // Если navigate не передан, используем window.location
        window.location.href = '/login';
      }
    }
    return false;
  }
  return true;
}

/**
 * Выполняет fetch запрос с автоматической обработкой ошибок авторизации
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch (headers, method, body и т.д.)
 * @param {Function} navigate - Функция навигации из react-router-dom (опционально)
 * @param {boolean} autoRedirect - Автоматически перенаправлять на логин при 401 (по умолчанию true)
 * @returns {Promise<Response>} - Промис с ответом
 */
export async function authenticatedFetch(url, options = {}, navigate = null, autoRedirect = true) {
  const token = localStorage.getItem('token');
  
  // Убеждаемся, что Authorization заголовок всегда устанавливается правильно
  // Если в options.headers уже есть Authorization, используем его, иначе добавляем наш
  const headers = { ...options.headers };
  if (token) {
    // Всегда устанавливаем Authorization с Bearer префиксом
    headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('authenticatedFetch: токен не найден в localStorage');
  }
  
  // Отладочное логирование
  console.log('authenticatedFetch:', {
    url,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
    hasAuthHeader: !!headers.Authorization,
    authHeaderValue: headers.Authorization ? headers.Authorization.substring(0, 30) + '...' : 'none',
    allHeaders: Object.keys(headers)
  });
  
  // Проверяем, что Authorization заголовок точно установлен
  if (!headers.Authorization && token) {
    console.error('ОШИБКА: Authorization заголовок не установлен, хотя токен есть!');
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Логируем ответ для отладки
  console.log('authenticatedFetch response:', {
    url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries())
  });
  
  // Если получили 401, проверяем заголовки ответа
  if (response.status === 401) {
    const wwwAuthenticate = response.headers.get('WWW-Authenticate');
    console.error('401 Unauthorized детали:', {
      url,
      wwwAuthenticate,
      hasToken: !!token,
      authHeader: headers.Authorization ? headers.Authorization.substring(0, 50) + '...' : 'none'
    });
  }
  
  // Проверяем статус авторизации (не перенаправляем автоматически, если autoRedirect = false)
  if (!handleAuthResponse(response, navigate, autoRedirect)) {
    console.error('authenticatedFetch: получен 401 Unauthorized', {
      url,
      hasToken: !!token,
      responseStatus: response.status
    });
    throw new Error('Unauthorized');
  }
  
  return response;
}



