// Утилиты для работы с языком и cookies

/**
 * Устанавливает язык в cookie
 * @param {string} lang - Код языка (ru, en, kz)
 * @param {number} days - Количество дней до истечения cookie (по умолчанию 365)
 */
export function setLanguageCookie(lang, days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `selectedLanguage=${lang};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Получает язык из cookie
 * @returns {string|null} - Код языка или null, если не найден
 */
export function getLanguageCookie() {
  const name = 'selectedLanguage=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

/**
 * Проверяет, был ли уже выбран язык (есть ли cookie)
 * @returns {boolean}
 */
export function hasLanguageBeenSelected() {
  return getLanguageCookie() !== null;
}
















