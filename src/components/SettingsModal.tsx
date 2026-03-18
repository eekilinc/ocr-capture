import { useState, useEffect } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Store } from "@tauri-apps/plugin-store";

type Tab = "general" | "about";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  appVersion: string;
  onShortcutUpdate?: (newShortcut: string) => void;
}

export const SettingsModal = ({ 
  isOpen, 
  onClose, 
  theme, 
  onThemeChange,
  appVersion,
  onShortcutUpdate
}: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [currentShortcut, setCurrentShortcut] = useState("Control+Alt+Shift+O");
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Store yukleme
    const loadStore = async () => {
        try {
            const _store = await Store.load("settings.json");
            setStore(_store);
            
            if (isOpen) {
                const val = await _store.get<boolean>("minimize-to-tray");
                setMinimizeToTray(val ?? true); // Default to true
                
                const auto = await isEnabled();
                setAutostartEnabled(auto);

                const shortcut = await _store.get<string>("global-shortcut");
                if (shortcut) {
                    setCurrentShortcut(shortcut);
                }
            }
        } catch (e) {
            console.error("Store load failed:", e);
        }
    };
    loadStore();
  }, [isOpen]);

  // ... (autostart and minimize toggles)

  // Shortcut Recording Logic
  useEffect(() => {
      const handleKeyDown = async (e: KeyboardEvent) => {
          if (!isRecording) return;
          e.preventDefault();
          e.stopPropagation();

          if (e.repeat) return; // Ignore key repeats

          const isMac = navigator.userAgent.includes("Mac");

          const modifiers = [];
          // Standardize modifier order: Ctrl -> Alt -> Shift -> Meta
          if (e.ctrlKey) modifiers.push("Control");
          if (e.altKey) modifiers.push(isMac ? "Option" : "Alt");
          if (e.shiftKey) modifiers.push("Shift");
          if (e.metaKey) modifiers.push(isMac ? "Command" : "Super");

          let key = e.key;
          
          // Ignore if the pressed key is just a modifier
          if (["Control", "Alt", "Shift", "Meta", "Command", "Option", "Super"].includes(key)) return;

          // Map special keys to Tauri format
          if (key === " ") key = "Space";
          else if (key.length === 1) key = key.toUpperCase();
          else if (key.startsWith("Arrow")) key = key; // Keep ArrowUp, ArrowDown as is
          else if (key === "Escape") {
             setIsRecording(false); // Cancel recording
             return;
          }

          const shortcutString = [...modifiers, key].join("+");
          
          if (shortcutString.length > 0) {
              console.log("Recorded shortcut:", shortcutString);
              setCurrentShortcut(shortcutString);
              setIsRecording(false);
              
              if (store) {
                  await store.set("global-shortcut", shortcutString);
                  await store.save();
                  
                  if (onShortcutUpdate) {
                    onShortcutUpdate(shortcutString);
                  }
              }
          }
      };
      
      if (isRecording) {
          window.addEventListener("keydown", handleKeyDown);
      }

      return () => {
          window.removeEventListener("keydown", handleKeyDown);
      };
  }, [isRecording, store]);

  const startRecording = () => {
      setIsRecording(true);
  };

  // ... UI rendering ...


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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ayarlar</h3>
          <button className="btn-icon-sm" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="sidebar">
            <button 
              className={`sidebar-item ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Genel
            </button>
            <button 
              className={`sidebar-item ${activeTab === "about" ? "active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Hakkında
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "general" && (
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-label">
                    <span>Görünüm Teması</span>
                    <small>Uygulamanın açık veya koyu modunu seçin.</small>
                  </div>
                  <div className="theme-toggle-group">
                    <button 
                      className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => onThemeChange('light')}
                    >
                      ☀️ Açık
                    </button>
                    <button 
                      className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => onThemeChange('dark')}
                    >
                      🌙 Koyu
                    </button>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-label">
                    <span>Windows ile Başlat</span>
                    <small>Bilgisayar açıldığında uygulamayı otomatik başlat.</small>
                  </div>
                  <label className="switch">
                    <input 
                        type="checkbox" 
                        checked={autostartEnabled} 
                        onChange={toggleAutostart} 
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-label">
                    <span>Global Kısayol</span>
                    <small>Ekran görüntüsü almak için kullanılacak kısayol.</small>
                  </div>
                  <div className="shortcut-recorder">
                      <button 
                        className={`shortcut-btn ${isRecording ? "recording" : ""}`}
                        onClick={startRecording}
                      >
                          {isRecording ? "Tuşlara Basın..." : currentShortcut}
                      </button>
                      {isRecording && (
                          <div className="recording-overlay">
                              <p>Yeni kısayolu tuşlayın...</p>
                          </div>
                      )}
                  </div>
                </div>

                <div className="setting-item" style={{ borderBottom: 'none' }}>
                  <div className="setting-label">
                    <span>Tepsiye Küçült</span>
                    <small>Kapatıldığında saatin yanına gizle.</small>
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
              </div>
            )}

            {activeTab === "about" && (
              <div className="about-content">
                <div className="app-logo-large">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                    <line x1="16" x2="22" y1="5" y2="5" />
                    <line x1="19" x2="19" y1="2" y2="8" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
                <h2>Metin Yakalayıcı</h2>
                <p className="version">v{appVersion}</p>
                <p className="description">
                  Hızlı, modern ve çevrimdışı çalışabilen ekran görüntüsü ve metin yakalama aracı.
                </p>
                
                <div className="tech-stack-section">
                    <h4>Teknoloji Yığını</h4>
                    <div className="tech-grid-premium">
                        <a href="https://tauri.app" target="_blank" rel="noopener noreferrer" className="tech-card">
                            <div className="tech-icon" style={{ backgroundColor: "#FFC131", boxShadow: "0 0 10px rgba(255, 193, 49, 0.4)" }}></div>
                            <div className="tech-info">
                                <span className="tech-name">Tauri v2</span>
                                <span className="tech-role">Uygulama Çatısı</span>
                            </div>
                        </a>
                        <a href="https://www.rust-lang.org" target="_blank" rel="noopener noreferrer" className="tech-card">
                            <div className="tech-icon" style={{ backgroundColor: "#DEA584", boxShadow: "0 0 10px rgba(222, 165, 132, 0.4)" }}></div>
                            <div className="tech-info">
                                <span className="tech-name">Rust</span>
                                <span className="tech-role">Yüksek Performans</span>
                            </div>
                        </a>
                        <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="tech-card">
                            <div className="tech-icon" style={{ backgroundColor: "#61DAFB", boxShadow: "0 0 10px rgba(97, 218, 251, 0.4)" }}></div>
                            <div className="tech-info">
                                <span className="tech-name">React 19</span>
                                <span className="tech-role">Kullanıcı Arayüzü</span>
                            </div>
                        </a>
                        <a href="https://www.typescriptlang.org" target="_blank" rel="noopener noreferrer" className="tech-card">
                            <div className="tech-icon" style={{ backgroundColor: "#3178C6", boxShadow: "0 0 10px rgba(49, 120, 198, 0.4)" }}></div>
                            <div className="tech-info">
                                <span className="tech-name">TypeScript</span>
                                <span className="tech-role">Tip Güvenliği</span>
                            </div>
                        </a>
                    </div>
                </div>

                <div className="credits">
                  <p>Geliştirici: <strong>Ekrem</strong></p>
                  <p>© 2026 Tüm Hakları Saklıdır.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
