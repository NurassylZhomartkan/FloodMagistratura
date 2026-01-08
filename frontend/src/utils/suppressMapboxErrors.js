// Утилита для подавления ошибок от заблокированных запросов Mapbox аналитики
// Этот файл должен импортироваться раньше всех компонентов, использующих Mapbox

if (typeof window !== 'undefined' && !window.__mapboxErrorHandlerInstalled) {
  window.__mapboxErrorHandlerInstalled = true;

  // Перехватываем fetch для блокировки запросов к events.mapbox.com
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('events.mapbox.com')) {
      // Возвращаем отклоненный промис, который будет тихо проигнорирован
      return Promise.reject(new Error('Blocked: events.mapbox.com'));
    }
    // Проверяем Request объект
    if (url && typeof url === 'object' && url.url && url.url.includes('events.mapbox.com')) {
      return Promise.reject(new Error('Blocked: events.mapbox.com'));
    }
    try {
      return originalFetch.apply(this, args);
    } catch (e) {
      // Игнорируем ошибки от заблокированных запросов
      if (e.message && e.message.includes('events.mapbox.com')) {
        return Promise.reject(new Error('Blocked: events.mapbox.com'));
      }
      throw e;
    }
  };

  // Перехватываем XMLHttpRequest для блокировки запросов к events.mapbox.com
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (typeof url === 'string' && url.includes('events.mapbox.com')) {
      // Блокируем запрос, устанавливая флаг
      this._mapboxBlocked = true;
      // Вызываем оригинальный open с пустым URL, чтобы избежать ошибок
      try {
        return originalXHROpen.call(this, method, 'about:blank', ...rest);
      } catch {
        // Игнорируем ошибки
        return;
      }
    }
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._mapboxBlocked) {
      // Тихо игнорируем заблокированные запросы, не вызывая оригинальный send
      // Симулируем успешный ответ для избежания ошибок в коде Mapbox
      try {
        Object.defineProperty(this, 'status', { value: 200, writable: false, configurable: true });
        Object.defineProperty(this, 'readyState', { value: 4, writable: false, configurable: true });
        Object.defineProperty(this, 'responseText', { value: '{}', writable: false, configurable: true });
        if (typeof this.onreadystatechange === 'function') {
          setTimeout(() => {
            try {
              this.onreadystatechange();
            } catch {
              // Игнорируем ошибки в обработчиках
            }
          }, 0);
        }
      } catch {
        // Игнорируем ошибки при установке свойств
      }
      return;
    }
    try {
      return originalXHRSend.apply(this, args);
    } catch (e) {
      // Игнорируем ошибки от заблокированных запросов
      const errorMsg = e && e.message ? String(e.message) : String(e);
      if (errorMsg.includes('events.mapbox.com')) {
        return;
      }
      throw e;
    }
  };

  // Подавление ошибок промисов
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error) {
      const errorMessage = error.message || error.toString() || '';
      const errorStack = error.stack || '';
      if (errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
          errorMessage.includes('events.mapbox.com') ||
          errorMessage.includes('Blocked: events.mapbox.com') ||
          errorMessage.includes('errorCb') ||
          errorStack.includes('errorCb')) {
        event.preventDefault();
        return;
      }
    }
  });

  // Подавление ошибок через window.onerror
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (message && typeof message === 'string') {
      if (message.includes('ERR_BLOCKED_BY_CLIENT') ||
          message.includes('events.mapbox.com') ||
          message.includes('Terrain and hillshade are disabled') ||
          message.includes('Canvas2D limitations') ||
          message.includes('fingerprinting protection')) {
        return true; // Подавляем ошибку
      }
    }
    if (error && error.message) {
      if (error.message.includes('ERR_BLOCKED_BY_CLIENT') ||
          error.message.includes('events.mapbox.com') ||
          error.message.includes('Terrain and hillshade are disabled') ||
          error.message.includes('Canvas2D limitations') ||
          error.message.includes('fingerprinting protection')) {
        return true; // Подавляем ошибку
      }
    }
    // Вызываем оригинальный обработчик для других ошибок
    if (originalOnError) {
      return originalOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  // Безопасная сериализация для логов (режет Mapbox-объекты, DOM, циклы)
  function safeStringifyForLogs(value, space = 0) {
    const seen = new WeakSet();

    try {
      return JSON.stringify(
        value,
        (k, v) => {
          // функции
          if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;

          // примитивы
          if (v === null || typeof v !== 'object') return v;

          // циклы
          if (seen.has(v)) return '[Circular]';
          seen.add(v);

          // Mapbox GL / Draw / Geocoder / Leaflet-подобные признаки
          const ctor = v?.constructor?.name;
          if (
            ctor === 'Map' ||
            ctor === 'LngLat' ||
            ctor === 'LngLatBounds' ||
            v._map ||
            v._controls ||
            v._mapbox_id ||
            v._leaflet_id
          ) {
            return `[${ctor || 'MapObject'}]`;
          }

          // DOM
          if (typeof Element !== 'undefined' && v instanceof Element) {
            return `[DOM ${v.tagName}]`;
          }

          return v;
        },
        space
      );
    } catch (e) {
      return String(value);
    }
  }

  // Подавление сообщений в консоли через перехват всех методов console
  const suppressMapboxErrors = (...args) => {
    // Проверяем все аргументы на наличие признаков ошибок Mapbox
    for (const arg of args) {
      let msgStr = '';
      if (typeof arg === 'string') {
        msgStr = arg;
      } else if (arg && typeof arg === 'object') {
        // Проверяем свойство message у объектов ошибок
        if (arg.message) {
          msgStr = String(arg.message);
        } else if (arg.stack) {
          msgStr = String(arg.stack);
        } else {
          // Используем безопасную сериализацию вместо JSON.stringify
          try {
            msgStr = safeStringifyForLogs(arg);
          } catch {
            msgStr = String(arg);
          }
        }
      } else {
        msgStr = String(arg);
      }
      
      if (msgStr.includes('ERR_BLOCKED_BY_CLIENT') ||
          (msgStr.includes('events.mapbox.com') && 
           (msgStr.includes('POST') || msgStr.includes('net::') || msgStr.includes('Failed to fetch'))) ||
          msgStr.includes('Terrain and hillshade are disabled') ||
          msgStr.includes('Canvas2D limitations') ||
          msgStr.includes('fingerprinting protection') ||
          msgStr.includes('private browsing mode')) {
        return true;
      }
    }
    return false;
  };

  const originalConsoleError = console.error;
  console.error = function(...args) {
    if (suppressMapboxErrors(...args)) {
      return; // Подавляем сообщение
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    if (suppressMapboxErrors(...args)) {
      return; // Подавляем сообщение
    }
    originalConsoleWarn.apply(console, args);
  };

  // Также перехватываем console.log на случай, если ошибки выводятся через него
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    if (suppressMapboxErrors(...args)) {
      return; // Подавляем сообщение
    }
    originalConsoleLog.apply(console, args);
  };
}

