import type { ToastState } from "../types";

type StatusToastProps = {
  state: ToastState;
};

export const StatusToast = ({ state }: StatusToastProps) => {
  if (state.kind === "hidden") {
    return null;
  }

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
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className={`toast ${state.kind}`}>
      {renderIcon()}
      <span>{state.message}</span>
    </aside>
  );
};
