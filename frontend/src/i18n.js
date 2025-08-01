// src/i18n.js

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Импортируем JSON с переводами
import translationRu from './locales/ru/translation.json';
// import translationEn from './locales/en/translation.json';
import translationKz from './locales/kz/translation.json';

i18n
  .use(LanguageDetector)       // автоматически определяет язык браузера
  .use(initReactI18next)       // передаём i18next в React
  .init({
    resources: {
      ru: { translation: translationRu },
      // en: { translation: translationEn },
      kz: { translation: translationKz },
    },
    fallbackLng: 'ru',         // если язык не найден, будет использоваться 'ru'
    interpolation: {
      escapeValue: false       // для React не нужно экранирование
    }
  });

export default i18n;
