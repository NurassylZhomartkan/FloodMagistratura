// src/config/i18n.js

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getLanguageCookie } from '../utils/languageUtils';
import { defaultLanguage as defaultLang, isLanguageSupported } from './languages';

// Импортируем JSON с переводами
import translationRu from '../locales/ru/translation.json';
import translationEn from '../locales/en/translation.json';
import translationKz from '../locales/kz/translation.json';

// Получаем язык из cookie перед инициализацией
const cookieLang = getLanguageCookie();
const defaultLanguage = (cookieLang && isLanguageSupported(cookieLang)) 
  ? cookieLang 
  : undefined;

i18n
  .use(LanguageDetector)       // автоматически определяет язык браузера
  .use(initReactI18next)       // передаём i18next в React
  .init({
    resources: {
      ru: { translation: translationRu },
      en: { translation: translationEn },
      kz: { translation: translationKz },
    },
    lng: defaultLanguage,      // устанавливаем язык из cookie, если есть
    fallbackLng: defaultLang,  // если язык не найден, будет использоваться язык по умолчанию
    interpolation: {
      escapeValue: false       // для React не нужно экранирование
    },
    detection: {
      order: ['localStorage', 'navigator'], // порядок определения языка
      caches: ['localStorage'],              // кэширование в localStorage
    }
  });

export default i18n;

