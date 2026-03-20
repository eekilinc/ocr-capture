import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { translations, Language, TranslationKeys, interpolate } from './translations';
import { Store } from "@tauri-apps/plugin-store";

interface TranslationContextType {
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
  lang: Language;
  setLang: (newLang: Language) => Promise<void>;
  isLoaded: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>("tr");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadLang = async () => {
      try {
        const store = await Store.load("settings.json");
        const savedLang = await store.get<Language>("app-lang");
        if (savedLang) {
          setLangState(savedLang);
        }
      } catch (e) {
        console.error("Failed to load language:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadLang();
  }, []);

  const t = useCallback(
    (key: TranslationKeys, params?: Record<string, string | number>): string => {
      const translation = translations[lang][key] || key;
      if (params) {
        return interpolate(translation, params);
      }
      return translation;
    },
    [lang]
  );

  const setLang = async (newLang: Language) => {
    setLangState(newLang);
    try {
      const store = await Store.load("settings.json");
      await store.set("app-lang", newLang);
      await store.save();
    } catch (e) {
      console.error("Failed to save language:", e);
    }
  };

  return (
    <TranslationContext.Provider value={{ t, lang, setLang, isLoaded }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslationContext must be used within a TranslationProvider');
  }
  return context;
};
