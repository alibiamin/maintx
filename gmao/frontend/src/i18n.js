import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import de from './locales/de.json';

const STORAGE_KEY = 'xmaint_lang';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  ar: { translation: ar },
  es: { translation: es },
  pt: { translation: pt },
  de: { translation: de }
};

const savedLang = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const lng = savedLang && resources[savedLang] ? savedLang : 'fr';

// Réduire le message console "i18next is maintained with support from Locize"
if (typeof i18n.logger !== 'undefined') {
  const orig = i18n.logger;
  i18n.logger = {
    log: (...args) => {
      const msg = args.join(' ');
      if (msg.includes('Locize') || msg.includes('i18next is maintained')) return;
      if (orig && orig.log) orig.log(...args);
    },
    warn: orig?.warn ? (...a) => orig.warn(...a) : () => {},
    error: orig?.error ? (...a) => orig.error(...a) : () => {},
  };
}

i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  debug: false,
});

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
    document.documentElement.lang = lng === 'ar' ? 'ar' : lng;
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  }
});

// Set initial dir/lang
if (typeof document !== 'undefined') {
  document.documentElement.lang = lng === 'ar' ? 'ar' : lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
}

export default i18n;
