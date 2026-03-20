import type { MonitorInfo } from "../types";
import { useTranslation } from "../hooks/useTranslation";

type HeaderBarProps = {
  isCaptureBusy: boolean;
  isOcrBusy: boolean;
  canExtract: boolean;
  onCapture: () => void;
  onExtract: () => void;
  onSettingsClick: () => void;
  onHistoryClick: () => void;
  onClear: () => void;
  onClipboardOcr: () => void;
  monitors: MonitorInfo[];
  selectedMonitor: number | null;
  onMonitorSelect: (monitorId: number | null) => void;
  appVersion: string;
};

export const HeaderBar = ({
  isCaptureBusy,
  isOcrBusy,
  canExtract,
  onCapture,
  onExtract,
  onSettingsClick,
  onHistoryClick,
  onClear,
  onClipboardOcr,
  monitors,
  selectedMonitor,
  onMonitorSelect,
  appVersion,
}: HeaderBarProps) => {
  const { t } = useTranslation();

  return (
    <header className="header-panel">
      <div className="brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1>{t("appName")}</h1>
            <span className="version-badge-sm">v{appVersion}</span>
        </div>
        <p>{t("appDesc")}</p>
      </div>

      <div className="header-controls">
        <select
          className="monitor-select"
          value={selectedMonitor ?? -1}
          onChange={(e) => {
            const val = Number(e.target.value);
            onMonitorSelect(val === -1 ? null : val);
          }}
          disabled={isCaptureBusy}
        >
          <option value={-1}>{t("allScreens")}</option>
          {monitors.map((monitor) => (
            <option key={monitor.id} value={monitor.id}>
              {monitor.name} {monitor.isPrimary ? t("primaryScreen") : `(${monitor.id + 1}${t("screenSuffix")})`} - {monitor.width}x{monitor.height}
            </option>
          ))}
        </select>

        <button
          className="btn btn-secondary btn-icon"
          onClick={onClipboardOcr}
          disabled={isCaptureBusy || isOcrBusy}
          title={t("btnClipboard")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
        </button>
        
        <button 
            className="btn btn-secondary btn-icon" 
            onClick={onHistoryClick} 
            title={t("btnHistory")}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3m6-3a9 9 0 1 1-9-9 9 9 0 0 1 9 9z"></path>
            </svg>
        </button>

        <button 
            className="btn btn-secondary btn-icon" 
            onClick={onSettingsClick} 
            title={t("btnSettings")}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        </button>

        <button 
            className="btn btn-primary" 
            onClick={onCapture} 
            disabled={isCaptureBusy}
        >
          {isCaptureBusy ? (
             <>
               <span className="spinner-sm"></span> {t("btnCapturing")}
             </>
          ) : (
             <>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
               {t("btnNewCapture")}
             </>
          )}
        </button>
        
        {canExtract && (
            <>
                <button 
                    className="btn btn-secondary btn-icon" 
                    onClick={onClear} 
                    disabled={isOcrBusy}
                    title={t("btnClear")}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <button 
                    className="btn btn-secondary" 
                    onClick={onExtract} 
                    disabled={isOcrBusy}
                    style={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
                >
                 {isOcrBusy ? t("btnExtracting") : t("btnExtract")}
                </button>
            </>
        )}
      </div>
    </header>
  );
};
