import { useTranslationContext } from "../i18n/TranslationContext";

export const useTranslation = () => {
  const { t, lang, setLang } = useTranslationContext();
  return { t, lang, setLang };
};
