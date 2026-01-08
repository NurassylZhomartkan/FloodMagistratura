// Service Worker для кэширования тайлов карты
const CACHE_NAME = 'map-tiles-cache-v1';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 дней

// URL паттерны для кэширования
const TILE_PATTERNS = [
  /\/api\/map\/tiles\//,
  /\/api\/tiles\//,
  /\/api\/map\/tiles\/shared\//,
];

// Устанавливаем Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker установлен');
  self.skipWaiting(); // Активируем сразу
});

// Активируем Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Удаляем старый кэш:', name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// Проверяем, нужно ли кэшировать URL
function shouldCache(url) {
  const urlString = url.toString();
  return TILE_PATTERNS.some((pattern) => pattern.test(urlString));
}

// Очистка старых записей из кэша
async function cleanOldCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const now = Date.now();
  
  // Подсчитываем общий размер кэша
  let totalSize = 0;
  const entries = [];
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      const size = blob.size;
      const dateHeader = response.headers.get('date');
      const age = dateHeader ? now - new Date(dateHeader).getTime() : 0;
      
      entries.push({
        request,
        size,
        age,
      });
      totalSize += size;
    }
  }
  
  // Если размер превышает лимит, удаляем самые старые записи
  if (totalSize > MAX_CACHE_SIZE) {
    entries.sort((a, b) => b.age - a.age); // Сортируем по возрасту (старые первыми)
    
    for (const entry of entries) {
      if (totalSize <= MAX_CACHE_SIZE) break;
      await cache.delete(entry.request);
      totalSize -= entry.size;
      console.log('[SW] Удален старый тайл из кэша:', entry.request.url);
    }
  }
  
  // Удаляем записи старше MAX_CACHE_AGE
  for (const entry of entries) {
    if (entry.age > MAX_CACHE_AGE) {
      await cache.delete(entry.request);
      console.log('[SW] Удален устаревший тайл из кэша:', entry.request.url);
    }
  }
}

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Кэшируем только GET запросы для тайлов
  if (request.method !== 'GET' || !shouldCache(request.url)) {
    return; // Пропускаем запрос без обработки
  }
  
  event.respondWith(
    (async () => {
      try {
        // Сначала проверяем кэш
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
          // Проверяем возраст кэшированного ответа
          const dateHeader = cachedResponse.headers.get('date');
          if (dateHeader) {
            const age = Date.now() - new Date(dateHeader).getTime();
            // Если кэш свежий (меньше 1 часа), используем его
            if (age < 60 * 60 * 1000) {
              console.log('[SW] Используем кэш для:', request.url);
              return cachedResponse;
            }
          } else {
            // Если нет даты, используем кэш (может быть старым форматом)
            console.log('[SW] Используем кэш (без даты) для:', request.url);
            return cachedResponse;
          }
        }
        
        // Если нет в кэше или кэш устарел, загружаем с сети
        console.log('[SW] Загружаем с сети:', request.url);
        const networkResponse = await fetch(request);
        
        // Кэшируем только успешные ответы
        if (networkResponse && networkResponse.status === 200) {
          // Клонируем ответ для кэширования
          const responseToCache = networkResponse.clone();
          
          // Добавляем заголовок даты, если его нет
          if (!responseToCache.headers.get('date')) {
            const headers = new Headers(responseToCache.headers);
            headers.set('date', new Date().toUTCString());
            const modifiedResponse = new Response(responseToCache.body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: headers,
            });
            
            await cache.put(request, modifiedResponse);
          } else {
            await cache.put(request, responseToCache);
          }
          
          // Периодически очищаем старый кэш
          if (Math.random() < 0.1) { // 10% вероятность очистки при каждом запросе
            cleanOldCache().catch((err) => {
              console.error('[SW] Ошибка при очистке кэша:', err);
            });
          }
        }
        
        return networkResponse;
      } catch (error) {
        console.error('[SW] Ошибка при обработке запроса:', error);
        
        // Если сеть недоступна, пытаемся вернуть из кэша
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          console.log('[SW] Сеть недоступна, используем кэш:', request.url);
          return cachedResponse;
        }
        
        // Если нет в кэше, возвращаем ошибку
        throw error;
      }
    })()
  );
});

// Сообщения от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Кэш очищен по запросу клиента');
        event.ports[0].postMessage({ success: true });
      })
    );
  } else if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        let totalSize = 0;
        
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
        
        event.ports[0].postMessage({ size: totalSize });
      })()
    );
  }
});







