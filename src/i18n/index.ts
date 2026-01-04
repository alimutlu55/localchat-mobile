/**
 * i18n Configuration
 *
 * Sets up internationalization with i18next for React Native.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

// Import translations
import en from './locales/en.json';

// Available languages
const resources = {
  en: { translation: en },
};

// Get device language
const getDeviceLanguage = (): string => {
  try {
    const locales = getLocales();
    if (locales && locales.length > 0) {
      const languageCode = locales[0].languageCode;
      if (languageCode && Object.keys(resources).includes(languageCode)) {
        return languageCode;
      }
    }
  } catch (error) {
    // Could not get device language, using default
  }
  return 'en';
};

/**
 * Initialize i18n
 */
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
