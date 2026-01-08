// Утилита для подавления ошибок от расширений Chrome, пытающихся загрузить ресурсы
// Эти ошибки возникают, когда расширения пытаются загрузить шрифты или другие ресурсы
// без указания их в web_accessible_resources манифеста

// Немедленно устанавливаем обработчик в самом начале, до всех других операций
(function() {
  'use strict';
  if (typeof window === 'undefined') return;
  
  // Минимальный обработчик для немедленной установки
  const quickHandler = function(event) {
    if (!event || !event.reason) return;
    try {
      const reason = event.reason;
      const msg = typeof reason === 'string' 
        ? reason 
        : (reason instanceof Error ? (reason.message || reason.toString()) : String(reason || ''));
      const msgLower = (msg || '').toLowerCase();
      if (msgLower.includes('could not establish connection') ||
          msgLower.includes('receiving end does not exist') ||
          msgLower.includes('chrome-extension://') ||
          msgLower.includes('extension context invalidated') ||
          msgLower.includes('message port closed') ||
          (msgLower.includes('uncaught') && (msgLower.includes('could not establish connection') || msgLower.includes('receiving end does not exist')))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  };
  
  // Устанавливаем немедленно с максимальным приоритетом
  if (window.addEventListener) {
    window.addEventListener('unhandledrejection', quickHandler, { capture: true, passive: false });
  }
  if (document && document.addEventListener) {
    document.addEventListener('unhandledrejection', quickHandler, { capture: true, passive: false });
  }
})();

// Устанавливаем обработчик unhandledrejection как можно раньше, до других операций
if (typeof window !== 'undefined') {
  // Быстрая функция для проверки ошибок расширений
  const isChromeExtensionErrorQuick = (msg) => {
    if (!msg || typeof msg !== 'string') return false;
    const msgLower = msg.toLowerCase();
    return msgLower.includes('could not establish connection') ||
           msgLower.includes('receiving end does not exist') ||
           msgLower.includes('chrome-extension://') ||
           msgLower.includes('extension context invalidated') ||
           msgLower.includes('message port closed') ||
           (msgLower.includes('uncaught') && (msgLower.includes('could not establish connection') || msgLower.includes('receiving end does not exist')));
  };

  // Устанавливаем ранний обработчик unhandledrejection
  if (!window.__earlyUnhandledRejectionHandler) {
    window.__earlyUnhandledRejectionHandler = function(event) {
      if (!event) return;
      
      try {
        const reason = event.reason;
        if (!reason) return;
        
        let msg = '';
        
        // Более тщательная проверка всех возможных вариантов
        if (typeof reason === 'string') {
          msg = reason;
        } else if (reason instanceof Error) {
          msg = reason.message || '';
          if (reason.stack) {
            msg += ' ' + reason.stack;
          }
        } else if (reason && typeof reason === 'object') {
          msg = reason.message || reason.error?.message || reason.toString() || '';
          if (reason.stack && !msg.includes(reason.stack)) {
            msg += ' ' + reason.stack;
          }
          if (reason.error?.stack && !msg.includes(reason.error.stack)) {
            msg += ' ' + reason.error.stack;
          }
        } else {
          msg = String(reason);
        }
        
        // Проверяем на ошибки расширений Chrome
        if (isChromeExtensionErrorQuick(msg)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      } catch (e) {
        // Игнорируем ошибки в самом обработчике
      }
    };
    
    // Устанавливаем с максимальным приоритетом и в capture фазе
    // Используем once: false, чтобы обработчик работал постоянно
    window.addEventListener('unhandledrejection', window.__earlyUnhandledRejectionHandler, { 
      capture: true, 
      passive: false 
    });
    
    // Также устанавливаем через document для максимального покрытия
    if (document && document.addEventListener) {
      document.addEventListener('unhandledrejection', window.__earlyUnhandledRejectionHandler, { 
        capture: true, 
        passive: false 
      });
    }
  }
}

if (typeof window !== 'undefined' && !window.__chromeExtensionErrorHandlerInstalled) {
  window.__chromeExtensionErrorHandlerInstalled = true;

  // Функция для проверки, является ли сообщение ошибкой расширения Chrome
  const isChromeExtensionError = (...args) => {
    for (const arg of args) {
      let msgStr = '';
      if (typeof arg === 'string') {
        msgStr = arg;
      } else if (arg && typeof arg === 'object') {
        if (arg.message) {
          msgStr = String(arg.message);
        } else if (arg.stack) {
          msgStr = String(arg.stack);
        } else if (arg.toString) {
          msgStr = String(arg.toString());
        } else {
          try {
            msgStr = JSON.stringify(arg);
          } catch {
            msgStr = String(arg);
          }
        }
      } else {
        msgStr = String(arg);
      }
      
      // Приводим к нижнему регистру для более надежной проверки
      const msgLower = msgStr.toLowerCase();
      
      // Проверяем на ошибки расширений Chrome
      if (msgLower.includes('chrome-extension://') ||
          msgLower.includes('could not establish connection') ||
          msgLower.includes('receiving end does not exist') ||
          msgLower.includes('extension context invalidated') ||
          msgLower.includes('message port closed') ||
          msgLower.includes('the message port closed') ||
          msgLower.includes('message port closed before a response was received')) {
        return true;
      }
      
      if (msgLower.includes('chrome-extension://') &&
          (msgLower.includes('denying load') ||
           msgLower.includes('web_accessible_resources') ||
           msgLower.includes('resources must be listed'))) {
        return true;
      }
    }
    return false;
  };

  // Перехватываем console.error для подавления ошибок расширений
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Проверяем все аргументы на наличие ошибок расширений
    if (isChromeExtensionError(...args)) {
      return; // Подавляем сообщение
    }
    originalConsoleError.apply(console, args);
  };

  // Перехватываем console.warn для подавления предупреждений расширений
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    // Проверяем все аргументы на наличие ошибок расширений
    if (isChromeExtensionError(...args)) {
      return; // Подавляем сообщение
    }
    originalConsoleWarn.apply(console, args);
  };

  // Также перехватываем console.log на случай, если ошибки выводятся через него
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    // Проверяем все аргументы на наличие ошибок расширений
    if (isChromeExtensionError(...args)) {
      return; // Подавляем сообщение
    }
    originalConsoleLog.apply(console, args);
  };

  // Подавление ошибок через window.onerror
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const checkError = (msg) => {
      if (!msg || typeof msg !== 'string') return false;
      const msgLower = msg.toLowerCase();
      return msgLower.includes('chrome-extension://') ||
             msgLower.includes('could not establish connection') ||
             msgLower.includes('receiving end does not exist') ||
             msgLower.includes('extension context invalidated') ||
             msgLower.includes('message port closed') ||
             msgLower.includes('uncaught (in promise)') && (
               msgLower.includes('could not establish connection') ||
               msgLower.includes('receiving end does not exist')
             );
    };
    
    if (message && checkError(message)) {
      return true; // Подавляем ошибку
    }
    if (error && error.message && checkError(error.message)) {
      return true; // Подавляем ошибку
    }
    if (error && error.stack && checkError(error.stack)) {
      return true; // Подавляем ошибку
    }
    
    // Вызываем оригинальный обработчик для других ошибок
    if (originalOnError) {
      return originalOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  // Подавление необработанных отклонений промисов (unhandled promise rejections)
  // Используем addEventListener для лучшей совместимости
  const handleUnhandledRejection = function(event) {
    if (!event) return;
    
    try {
      const reason = event.reason;
      if (!reason) return;
      
      let errorMessage = '';
      
      // Обрабатываем разные типы причин отклонения
      if (typeof reason === 'string') {
        errorMessage = reason;
      } else if (reason instanceof Error) {
        // Если это объект Error, проверяем message и stack
        errorMessage = reason.message || '';
        if (reason.stack) {
          errorMessage += ' ' + reason.stack;
        }
      } else if (reason && typeof reason === 'object') {
        // Для других объектов проверяем различные поля
        errorMessage = reason.message || reason.error?.message || reason.toString() || '';
        if (reason.stack && !errorMessage.includes(reason.stack)) {
          errorMessage += ' ' + reason.stack;
        }
        if (reason.error?.stack && !errorMessage.includes(reason.error.stack)) {
          errorMessage += ' ' + reason.error.stack;
        }
        // Также проверяем другие возможные поля
        if (reason.name && !errorMessage.includes(reason.name)) {
          errorMessage += ' ' + reason.name;
        }
      } else {
        errorMessage = String(reason);
      }
      
      // Приводим к нижнему регистру для более надежной проверки
      const msgLower = errorMessage.toLowerCase();
      
      // Подавляем ошибки от расширений Chrome (расширенный список)
      if (msgLower.includes('could not establish connection') ||
          msgLower.includes('receiving end does not exist') ||
          msgLower.includes('chrome-extension://') ||
          msgLower.includes('extension context invalidated') ||
          msgLower.includes('message port closed') ||
          msgLower.includes('the message port closed') ||
          msgLower.includes('message port closed before a response was received') ||
          msgLower.includes('extension has been disabled') ||
          msgLower.includes('extension context invalidated') ||
          msgLower.includes('could not connect') ||
          msgLower.includes('connection closed') ||
          (msgLower.includes('uncaught') && (msgLower.includes('could not establish connection') || msgLower.includes('receiving end does not exist')))) {
        event.preventDefault(); // Подавляем ошибку
        event.stopPropagation(); // Останавливаем распространение
        event.stopImmediatePropagation(); // Останавливаем немедленное распространение
        return false;
      }
    } catch (e) {
      // Игнорируем ошибки в самом обработчике
    }
  };
  
  // Добавляем обработчик с максимальным приоритетом и capture фазой
  // Используем несколько способов для максимальной совместимости
  if (window.addEventListener) {
    window.addEventListener('unhandledrejection', handleUnhandledRejection, { capture: true, passive: false });
  }
  
  // Также устанавливаем на document для максимального покрытия
  if (document && document.addEventListener) {
    document.addEventListener('unhandledrejection', handleUnhandledRejection, { capture: true, passive: false });
  }
  
  // Также устанавливаем обработчик через window.onunhandledrejection для совместимости
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    // Сохраняем состояние до вызова handleUnhandledRejection
    const wasDefaultPrevented = event?.defaultPrevented;
    handleUnhandledRejection(event);
    // Если defaultPrevented изменился, значит ошибка была подавлена
    if (event?.defaultPrevented && !wasDefaultPrevented) {
      return; // Ошибка была подавлена
    }
    // Вызываем оригинальный обработчик, если он был установлен
    if (originalOnUnhandledRejection) {
      return originalOnUnhandledRejection.call(this, event);
    }
  };
}

