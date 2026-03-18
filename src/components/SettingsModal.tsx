import { useState, useEffect, useRef, Fragment } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";

type Tab = "general" | "shortcut" | "about";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  appVersion: string;
  currentShortcut: string;
  onShortcutUpdate?: (newShortcut: string) => void;
  ocrLanguages: string;
  onOcrLanguagesUpdate: (langs: string) => void;
  autoCopy: boolean;
  onAutoCopyUpdate: (val: boolean) => void;
  alwaysOnTop: boolean;
  onAlwaysOnTopUpdate: (val: boolean) => void;
}

// Convert Tauri shortcut string -> display segments, e.g. "Control+Shift+F9" -> ["Ctrl","Shift","F9"]
function shortcutToKeys(shortcut: string): string[] {
  return shortcut.split("+").map((k) => {
    if (k === "Control") return "Ctrl";
    if (k === "Meta" || k === "Command" || k === "Super") return "⌘";
    if (k === "Option") return "⌥";
    return k;
  });
}

export const SettingsModal = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  appVersion,
  currentShortcut,
  onShortcutUpdate,
  ocrLanguages,
  onOcrLanguagesUpdate,
  autoCopy,
  onAutoCopyUpdate,
  alwaysOnTop,
  onAlwaysOnTopUpdate,
}: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [store, setStore] = useState<Store | null>(null);

  // Language selection state
  const [availableLangs, setAvailableLangs] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(() => ocrLanguages.split("+").filter(Boolean));

  // Shortcut recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [recordError, setRecordError] = useState<string>("");
  const recordingRef = useRef(false);
  recordingRef.current = isRecording;

  // Load settings when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const loadStore = async () => {
      try {
        const _store = await Store.load("settings.json");
        setStore(_store);
        const val = await _store.get<boolean>("minimize-to-tray");
        setMinimizeToTray(val ?? true);
        const auto = await isEnabled();
        setAutostartEnabled(auto);
      } catch (e) {
        console.error("Store load failed:", e);
      }
    };
    const loadLangs = async () => {
      try {
        const langs = await invoke<string[]>("list_ocr_languages");
        setAvailableLangs(langs);
      } catch {
        // Tesseract may not be installed yet — silently ignore
      }
    };
    loadStore();
    loadLangs();
  }, [isOpen]);

  // Reset recording state when tab changes or modal closes
  useEffect(() => {
    setIsRecording(false);
    setRecordedKeys([]);
    setRecordError("");
  }, [activeTab, isOpen]);

  // Shortcut recording keyboard handler
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;

      // ESC cancels
      if (e.key === "Escape") {
        setIsRecording(false);
        setRecordedKeys([]);
        setRecordError("");
        return;
      }

      const modifierKeys = ["Control", "Alt", "Shift", "Meta", "OS"];
      const isMod = modifierKeys.includes(e.key);

      // Build modifier list (live display while holding)
      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Control");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Meta");

      if (isMod) {
        // Still waiting for a real key — show current mods as hint
        setRecordedKeys(mods.map((m) => (m === "Control" ? "Ctrl" : m)));
        return;
      }

      // Map key to Tauri-compatible format
      let key = e.key;
      if (key === " ") key = "Space";
      else if (key.length === 1) key = key.toUpperCase();

      const shortcutParts = [...mods, key];
      const shortcutString = shortcutParts.join("+");

      // Require at least one modifier
      if (mods.length === 0) {
        setRecordError("En az bir modifier (Ctrl, Alt, Shift) gerekli.");
        setRecordedKeys([key]);
        return;
      }

      // Warn about Ctrl+Alt combos on Windows (AltGr collision)
      if (e.ctrlKey && e.altKey) {
        setRecordError(
          "Ctrl+Alt kombinasyonu Windows'ta AltGr ile çakışabilir."
        );
      } else {
        setRecordError("");
      }

      setRecordedKeys(shortcutParts.map((k) => (k === "Control" ? "Ctrl" : k)));
      setIsRecording(false);

      // Save
      if (store) {
        await store.set("global-shortcut", shortcutString);
        await store.save();
      }
      if (onShortcutUpdate) {
        onShortcutUpdate(shortcutString);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording, store, onShortcutUpdate]);

  // Sync selectedLangs when parent ocrLanguages prop changes
  useEffect(() => {
    setSelectedLangs(ocrLanguages.split("+").filter(Boolean));
  }, [ocrLanguages]);

  const toggleLang = (lang: string) => {
    const next = selectedLangs.includes(lang)
      ? selectedLangs.filter((l) => l !== lang)
      : [...selectedLangs, lang];
    // Always keep at least one language selected
    if (next.length === 0) return;
    setSelectedLangs(next);
    onOcrLanguagesUpdate(next.join("+"));
  };

  const startRecording = () => {
    setRecordedKeys([]);
    setRecordError("");
    setIsRecording(true);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    setRecordedKeys([]);
    setRecordError("");
  };

  const toggleAutostart = async () => {
    try {
      if (autostartEnabled) {
        await disable();
        setAutostartEnabled(false);
      } else {
        await enable();
        setAutostartEnabled(true);
      }
    } catch (err) {
      console.error("Autostart toggle error:", err);
    }
  };

  const toggleMinimizeToTray = async () => {
    if (!store) return;
    const newValue = !minimizeToTray;
    setMinimizeToTray(newValue);
    await store.set("minimize-to-tray", newValue);
    await store.save();
  };

  if (!isOpen) return null;

  const displayKeys = isRecording && recordedKeys.length > 0
    ? recordedKeys
    : shortcutToKeys(currentShortcut);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "general",
      label: "Genel",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      id: "shortcut",
      label: "Kısayol",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="13" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
        </svg>
      ),
    },
    {
      id: "about",
      label: "Hakkında",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-brand">
            <div className="settings-modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span>Ayarlar</span>
          </div>
          <button className="btn-icon-sm" onClick={onClose} title="Kapat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Sidebar */}
          <div className="sidebar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`sidebar-item ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <div className="settings-group">
                {/* Theme */}
                <div className="setting-item">
                  <div className="setting-label">
                    <div className="setting-label-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    </div>
                    <div>
                      <span>Görünüm Teması</span>
                      <small>Açık veya koyu modu seçin</small>
                    </div>
                  </div>
                  <div className="theme-toggle-group">
                    <button
                      className={`theme-btn ${theme === "light" ? "active" : ""}`}
                      onClick={() => onThemeChange("light")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      Açık
                    </button>
                    <button
                      className={`theme-btn ${theme === "dark" ? "active" : ""}`}
                      onClick={() => onThemeChange("dark")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                      Koyu
                    </button>
                  </div>
                </div>

                {/* Autostart */}
                <div className="setting-item">
                  <div className="setting-label">
                    <div className="setting-label-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <div>
                      <span>Windows ile Başlat</span>
                      <small>Bilgisayar açıldığında uygulamayı başlat</small>
                    </div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={autostartEnabled} onChange={toggleAutostart} />
                    <span className="slider round"></span>
                  </label>
                </div>

                {/* Minimize to tray */}
                <div className="setting-item">
                  <div className="setting-label">
                    <div className="setting-label-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <div>
                      <span>Tepsiye Küçült</span>
                      <small>Kapatıldığında sistem tepsisine gizle</small>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={minimizeToTray}
                      onChange={toggleMinimizeToTray}
                      disabled={!store}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {/* Auto Copy */}
                <div className="setting-item">
                  <div className="setting-label">
                    <div className="setting-label-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </div>
                    <div>
                      <span>Otomatik Kopyala</span>
                      <small>OCR sonrası metni panoya otomatik kopyala</small>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={autoCopy}
                      onChange={(e) => onAutoCopyUpdate(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {/* Always On Top */}
                <div className="setting-item">
                  <div className="setting-label">
                    <div className="setting-label-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                      </svg>
                    </div>
                    <div>
                      <span>Her Zaman Üstte</span>
                      <small>Pencereyi diğer uygulamaların üzerinde tut</small>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={alwaysOnTop}
                      onChange={(e) => onAlwaysOnTopUpdate(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {/* OCR Languages */}
                <div className="setting-item" style={{ borderBottom: "none", flexDirection: "column", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div className="setting-label">
                    <div className="setting-label-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
                      </svg>
                    </div>
                    <div>
                      <span>OCR Dilleri</span>
                      <small>Tesseract'ın kullanacağı dilleri seçin</small>
                    </div>
                  </div>
                  <div className="lang-chips">
                    {availableLangs.length === 0 ? (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>Tesseract kurulu değil veya dil paketi bulunamadı.</span>
                    ) : (
                      availableLangs.map((lang) => (
                        <button
                          key={lang}
                          className={`lang-chip ${selectedLangs.includes(lang) ? "active" : ""}`}
                          onClick={() => toggleLang(lang)}
                          title={lang}
                        >
                          {lang}
                        </button>
                      ))
                    )}
                  </div>
                  {selectedLangs.length > 0 && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      Aktif: <code style={{ fontFamily: "var(--font-mono)" }}>{selectedLangs.join("+")}</code>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* SHORTCUT TAB */}
            {activeTab === "shortcut" && (
              <div className="shortcut-tab-content">
                <div className="shortcut-tab-header">
                  <h3>Global Kısayol</h3>
                  <p>
                    Uygulama arka planda çalışırken bile bu kombinasyona basarak
                    ekran yakalamayı tetikleyebilirsiniz.
                  </p>
                </div>

                {/* Current shortcut display */}
                <div className="shortcut-display-card">
                  <span className="shortcut-display-label">Mevcut Kısayol</span>
                  <div className="kbd-group">
                    {displayKeys.map((key, i) => (
                      <Fragment key={i}>
                        <kbd className={isRecording ? "kbd-recording" : ""}>{key}</kbd>
                        {i < displayKeys.length - 1 && (
                          <span className="kbd-sep">+</span>
                        )}
                      </Fragment>
                    ))}
                  </div>
                  {isRecording && (
                    <span className="shortcut-recording-badge">kayıt yapılıyor</span>
                  )}
                </div>

                {recordError && (
                  <div className="shortcut-warning">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {recordError}
                  </div>
                )}

                <div className="shortcut-actions">
                  {!isRecording ? (
                    <button className="btn btn-primary shortcut-record-btn" onClick={startRecording}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="20" height="13" rx="2" />
                        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
                      </svg>
                      Yeni Kısayol Ata
                    </button>
                  ) : (
                    <button className="btn btn-secondary shortcut-record-btn" onClick={cancelRecording}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      İptal Et
                    </button>
                  )}
                </div>

                <div className="shortcut-tips">
                  <div className="shortcut-tip-item">
                    <kbd>Esc</kbd>
                    <span>Kaydı iptal eder</span>
                  </div>
                  <div className="shortcut-tip-item">
                    <span className="tip-dot"></span>
                    <span>En az bir modifier (Ctrl, Alt, Shift) gereklidir</span>
                  </div>
                  <div className="shortcut-tip-item">
                    <span className="tip-dot"></span>
                    <span>Ctrl+Alt Windows'ta AltGr ile çakışabilir</span>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT TAB */}
            {activeTab === "about" && (
              <div className="about-content-premium">
                {/* App logo */}
                <div className="about-logo-wrap">
                  <div className="about-logo-ring about-logo-ring-outer"></div>
                  <div className="about-logo-ring about-logo-ring-mid"></div>
                  <div className="about-logo-core">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                </div>

                <h2 className="about-app-name">Metin Yakalayıcı</h2>
                <div className="about-version-badge">v{appVersion}</div>
                <p className="about-desc">
                  Ekranınızdaki metni anında yakalayan, hızlı, modern ve çevrimdışı çalışabilen OCR aracı.
                </p>

                {/* Stats row */}
                <div className="about-stats">
                  <div className="about-stat">
                    <span className="about-stat-value">%100</span>
                    <span className="about-stat-label">Çevrimdışı</span>
                  </div>
                  <div className="about-stat-divider"></div>
                  <div className="about-stat">
                    <span className="about-stat-value">&lt;1s</span>
                    <span className="about-stat-label">OCR Hızı</span>
                  </div>
                  <div className="about-stat-divider"></div>
                  <div className="about-stat">
                    <span className="about-stat-value">2+</span>
                    <span className="about-stat-label">Dil</span>
                  </div>
                </div>

                {/* Tech stack */}
                <div className="tech-stack-section">
                  <h4>Teknoloji Yığını</h4>
                  <div className="tech-grid-premium">
                    <div className="tech-card">
                      <div className="tech-icon" style={{ backgroundColor: "#FFC131", boxShadow: "0 0 10px rgba(255,193,49,0.4)" }}></div>
                      <div className="tech-info">
                        <span className="tech-name">Tauri v2</span>
                        <span className="tech-role">Uygulama Çatısı</span>
                      </div>
                    </div>
                    <div className="tech-card">
                      <div className="tech-icon" style={{ backgroundColor: "#DEA584", boxShadow: "0 0 10px rgba(222,165,132,0.4)" }}></div>
                      <div className="tech-info">
                        <span className="tech-name">Rust</span>
                        <span className="tech-role">Yüksek Performans</span>
                      </div>
                    </div>
                    <div className="tech-card">
                      <div className="tech-icon" style={{ backgroundColor: "#61DAFB", boxShadow: "0 0 10px rgba(97,218,251,0.4)" }}></div>
                      <div className="tech-info">
                        <span className="tech-name">React 19</span>
                        <span className="tech-role">Kullanıcı Arayüzü</span>
                      </div>
                    </div>
                    <div className="tech-card">
                      <div className="tech-icon" style={{ backgroundColor: "#3178C6", boxShadow: "0 0 10px rgba(49,120,198,0.4)" }}></div>
                      <div className="tech-info">
                        <span className="tech-name">TypeScript</span>
                        <span className="tech-role">Tip Güvenliği</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="about-footer">
                  <a
                    href="https://github.com/eekilinc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-github-link"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    @eekilinc
                  </a>
                  <span className="about-footer-dot">·</span>
                  <span>© 2026</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
