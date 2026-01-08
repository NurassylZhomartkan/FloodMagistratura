import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Хук для установки заголовка страницы (document.title)
 * @param {string} translationKey - Ключ перевода для заголовка страницы (например, 'pageTitles.dashboard')
 * @param {string} siteName - Название сайта (по умолчанию 'FloodSite')
 */
export const usePageTitle = (translationKey, siteName = 'FloodSite') => {
  const { t } = useTranslation();

  useEffect(() => {
    const pageTitle = t(translationKey);
    document.title = `${pageTitle} - ${siteName}`;
    
    // Очистка при размонтировании (опционально, можно вернуть базовое название)
    return () => {
      document.title = siteName;
    };
  }, [translationKey, siteName, t]);
};















