// Централизованная конфигурация поддерживаемых языков

export const languages = [
  { code: 'ru', name: 'Русский', nativeName: 'Русский' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'kz', name: 'Қазақша', nativeName: 'Қазақша' },
];

// Массив кодов языков для валидации
export const languageCodes = languages.map(lang => lang.code);

// Язык по умолчанию
export const defaultLanguage = 'ru';

// Проверка, поддерживается ли язык
export function isLanguageSupported(code) {
  return languageCodes.includes(code);
}















