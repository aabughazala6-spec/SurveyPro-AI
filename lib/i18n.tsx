'use client';

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAppStore, type SupportedLanguage } from '@/lib/stores/app-store';
import { getTranslation, dictionaries, type TranslationDictionary } from '@/locales';
import { engFormat } from '@/lib/engineering-formatter';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  isRtl: boolean;
  dir: 'rtl' | 'ltr';
  t: (path: string, params?: Record<string, string | number>) => string;
  f: typeof engFormat;
  dict: TranslationDictionary;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useAppStore((state) => state.language) || 'ar';
  const setLanguage = useAppStore((state) => state.setLanguage);

  const isRtl = language === 'ar';
  const dir: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';

  // Synchronize document direction and lang attributes on change
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
      if (language === 'ar') {
        document.documentElement.classList.add('font-cairo');
      }
    }
  }, [language, dir]);

  const t = useMemo(() => {
    return (path: string, params?: Record<string, string | number>) => {
      return getTranslation(language, path, params);
    };
  }, [language]);

  const dict = useMemo(() => {
    return dictionaries[language] || dictionaries.ar;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      isRtl,
      dir,
      t,
      f: engFormat,
      dict,
    }),
    [language, setLanguage, isRtl, dir, t, dict]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook for using translations, RTL/LTR state, and engineering number formatter
 */
export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if accessed outside provider
    const lang = 'ar';
    return {
      language: lang as SupportedLanguage,
      setLanguage: () => {},
      isRtl: true,
      dir: 'rtl' as const,
      t: (path: string, params?: Record<string, string | number>) => getTranslation(lang, path, params),
      f: engFormat,
      dict: dictionaries.ar,
    };
  }
  return context;
}

export { engFormat };
