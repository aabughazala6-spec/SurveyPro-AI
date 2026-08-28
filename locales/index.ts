import { ar, type TranslationDictionary } from './ar';
import { en } from './en';

export type Language = 'ar' | 'en';
export type LocaleKey = keyof TranslationDictionary;

export const dictionaries: Record<Language, TranslationDictionary> = {
  ar,
  en,
};

export const locales = dictionaries;

/**
 * Get nested translation string safely by path e.g. "common.save" or "dashboard.heroTitle"
 */
export function getTranslation(
  lang: Language,
  path: string,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[lang] || dictionaries.ar;
  const parts = path.split('.');
  
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback to Arabic if missing in English, or return path
      let fallback: any = dictionaries.ar;
      for (const p of parts) {
        if (fallback && typeof fallback === 'object' && p in fallback) {
          fallback = fallback[p];
        } else {
          fallback = undefined;
          break;
        }
      }
      current = fallback || path;
      break;
    }
  }

  if (typeof current !== 'string') {
    return path;
  }

  if (params) {
    return Object.entries(params).reduce((str, [k, v]) => {
      return str.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }, current);
  }

  return current;
}

/**
 * Verify 100% exact key parity between Arabic and English dictionaries
 */
export interface ParityReport {
  isParity: boolean;
  totalArKeys: number;
  totalEnKeys: number;
  missingInEn: string[];
  missingInAr: string[];
}

export function assertTranslationParity(
  dictA: any = ar,
  dictB: any = en,
  prefix = ''
): ParityReport {
  const missingInB: string[] = [];
  const missingInA: string[] = [];
  let totalA = 0;
  let totalB = 0;

  function collectKeys(obj: any, currentPrefix = '', keySet = new Set<string>()): Set<string> {
    for (const key of Object.keys(obj)) {
      const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        collectKeys(obj[key], fullKey, keySet);
      } else {
        keySet.add(fullKey);
      }
    }
    return keySet;
  }

  const keysA = collectKeys(dictA, prefix);
  const keysB = collectKeys(dictB, prefix);

  totalA = keysA.size;
  totalB = keysB.size;

  for (const k of keysA) {
    if (!keysB.has(k)) {
      missingInB.push(k);
    }
  }

  for (const k of keysB) {
    if (!keysA.has(k)) {
      missingInA.push(k);
    }
  }

  return {
    isParity: missingInB.length === 0 && missingInA.length === 0,
    totalArKeys: totalA,
    totalEnKeys: totalB,
    missingInEn: missingInB,
    missingInAr: missingInA,
  };
}

export { ar, en };
export type { TranslationDictionary };
