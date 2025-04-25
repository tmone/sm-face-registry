'use client';

import { useState, useEffect, useCallback } from 'react';
import translations from '@/locales/translations.json';

type Language = 'en' | 'vi';
type TranslationKey = keyof typeof translations['en']; // Assume 'en' has all keys

const DEFAULT_LANGUAGE: Language = 'en';
const LANGUAGE_STORAGE_KEY = 'faceRegistry_language';

export function useTranslation() {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  // Load language preference from localStorage on initial load
  useEffect(() => {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'vi')) {
      setLanguage(storedLanguage);
    } else {
      // Optional: Detect browser language preference
      // const browserLang = navigator.language.split('-')[0];
      // if (browserLang === 'vi') setLanguage('vi');
    }
  }, []);

  const changeLanguage = useCallback((newLanguage: Language) => {
    if (newLanguage !== language) {
        setLanguage(newLanguage);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
         // Force a re-render or notify components if necessary
         // This state change should trigger re-renders in components using the hook
    }
  }, [language]);

  const t = useCallback((key: TranslationKey, fallback?: string): string => {
      // Check if key exists for the current language
      if (translations[language] && key in translations[language]) {
        // Type assertion needed here because TypeScript can't guarantee the key exists
        // for the *specific* language index type without more complex setup.
        return (translations[language] as Record<TranslationKey, string>)[key];
      }
      // Fallback to English if key not found in current language
      if (translations['en'] && key in translations['en']) {
        return translations['en'][key];
      }
      // Fallback to provided text or the key itself
      return fallback ?? key;
  }, [language]);


  return { language, changeLanguage, t };
}
