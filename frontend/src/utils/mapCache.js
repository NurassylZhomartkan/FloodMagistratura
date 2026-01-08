// Утилиты для управления кэшем карты

/**
 * Регистрирует Service Worker для кэширования тайлов
 */
export async function registerMapCacheServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      console.log('[MapCache] Service Worker зарегистрирован:', registration.scope);
      
      // Проверяем обновления Service Worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[MapCache] Новый Service Worker установлен, перезагрузите страницу для применения');
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('[MapCache] Ошибка регистрации Service Worker:', error);
      return null;
    }
  } else {
    console.warn('[MapCache] Service Worker не поддерживается в этом браузере');
    return null;
  }
}

/**
 * Очищает кэш тайлов
 */
export async function clearMapCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log('[MapCache] Кэш очищен');
          resolve(true);
        } else {
          reject(new Error('Не удалось очистить кэш'));
        }
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
      
      // Таймаут на случай, если Service Worker не отвечает
      setTimeout(() => {
        reject(new Error('Таймаут при очистке кэша'));
      }, 5000);
    });
  } else {
    // Если Service Worker не доступен, очищаем кэш напрямую
    return caches.delete('map-tiles-cache-v1').then(() => {
      console.log('[MapCache] Кэш очищен напрямую');
      return true;
    });
  }
}

/**
 * Получает размер кэша тайлов
 */
export async function getMapCacheSize() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.size || 0);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      );
      
      // Таймаут
      setTimeout(() => {
        resolve(0);
      }, 2000);
    });
  } else {
    // Если Service Worker не доступен, получаем размер напрямую
    return caches.open('map-tiles-cache-v1').then(async (cache) => {
      const keys = await cache.keys();
      let totalSize = 0;
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
      
      return totalSize;
    });
  }
}

/**
 * Форматирует размер в читаемый формат
 */
export function formatCacheSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}







