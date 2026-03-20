import { useTranslation } from "../hooks/useTranslation";
import { TranslationKeys } from "../i18n/translations";
import type { ToastState } from "../types";

export const StatusToast = ({ state }: { state: ToastState }) => {
  const { t } = useTranslation();
  
  if (state.kind === "hidden" || !state.message) return null;

  const renderIcon = () => {
    switch (state.kind) {
      case "success":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case "error":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className={`toast ${state.kind}`}>
      {renderIcon()}
      <span>{t(state.message as TranslationKeys)}</span>
    </aside>
  );
};
