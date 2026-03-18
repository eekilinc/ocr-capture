// Fix App.tsx to use SnippingArea and remove old classes
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { Store } from "@tauri-apps/plugin-store";
import { CaptureCanvas } from "./components/CaptureCanvas";
import { HeaderBar } from "./components/HeaderBar";
import { ResultPanel } from "./components/ResultPanel";
import { StatusToast } from "./components/StatusToast";
import { SettingsModal } from "./components/SettingsModal";
import { HistoryModal } from "./components/HistoryModal";
import { cropImageToBase64 } from "./lib/image";
import { useTheme } from "./hooks/useTheme";
import type { CaptureResponse, OcrResponse, Rect, ToastState, MonitorInfo, HistoryItem } from "./types";

const DEFAULT_TOAST: ToastState = { kind: "hidden", message: "" };

function App() {
  const [theme, setTheme] = useTheme();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);
  
  // Default shortcut updated to avoid system conflicts (O for OCR)
  const [currentShortcut, setCurrentShortcut] = useState("Control+Alt+Shift+O");

  const [captureImage, setCaptureImage] = useState<string | null>(null);
  const [captureSize, setCaptureSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<Rect | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrEngine, setOcrEngine] = useState("");
  const [lastError, setLastError] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(DEFAULT_TOAST);
  
  // Yeni: Snipping Modu
  const [isSnippingMode, setIsSnippingMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Initialize App Settings (Defaults)
  useEffect(() => {
    const initSettings = async () => {
        try {
            const store = await Store.load("settings.json");
            const setupDone = await store.get<boolean>("setup-done");

            if (!setupDone) {
                // First Run: Enable defaults
                console.log("First run setup: Enabling autostart and tray minimize");
                
                // 1. Enable Autostart
                try {
                    const auto = await isEnabled();
                    if (!auto) {
                        await enable();
                    }
                } catch (e) {
                    console.error("Autostart enable failed:", e);
                }

                // 2. Set Minimize to Tray
                await store.set("minimize-to-tray", true);
                
                // 3. Mark setup as done
                await store.set("setup-done", true);
                await store.save();
            } else {
                // Not first run, load saved shortcut
                const savedShortcut = await store.get<string>("global-shortcut");
                if (savedShortcut) {
                    setCurrentShortcut(savedShortcut);
                }
                
                // Load History
                const savedHistory = await store.get<HistoryItem[]>("history");
                if (savedHistory) {
                    setHistory(savedHistory);
                }
            }
        } catch (e) {
            console.error("Setup init failed:", e);
        }
    };
    initSettings();
  }, []);

  // Handle window close request (Minimize to Tray)
  useEffect(() => {
    const initCloseHandler = async () => {
        const appWindow = getCurrentWindow();
        try {
            const store = await Store.load("settings.json");
            
            await appWindow.onCloseRequested(async (event) => {
                try {
                    // Default to TRUE if setting is missing
                    const val = await store.get<boolean>("minimize-to-tray");
                    const minimizeToTray = val ?? true; 
                    
                    if (minimizeToTray) {
                        event.preventDefault();
                        await appWindow.hide();
                    }
                } catch (err) {
                    console.error("Error checking minimize-to-tray setting:", err);
                }
            });
        } catch (err) {
            console.error("Failed to load store for close handler:", err);
        }
    };
    
    initCloseHandler();
  }, []);

  useEffect(() => {
    invoke<MonitorInfo[]>("get_monitors")
      .then(setMonitors)
      .catch((err) => console.error("Monitorler yuklenemedi:", err));
  }, []);

  const showToast = (kind: ToastState["kind"], message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(DEFAULT_TOAST), 2600);
  };

  const captureBusyRef = useRef(captureBusy);
  const selectedMonitorRef = useRef(selectedMonitor);

  useEffect(() => {
      captureBusyRef.current = captureBusy;
  }, [captureBusy]);

  useEffect(() => {
      selectedMonitorRef.current = selectedMonitor;
  }, [selectedMonitor]);

  // Handle Global Shortcut
  useEffect(() => {
    let unregisterFn: (() => void) | undefined;

    const setupShortcut = async () => {
        try {
            // Unregister first if needed
            try {
                const registered = await isRegistered(currentShortcut);
                if (registered) {
                    await unregister(currentShortcut);
                }
            } catch (e) {
                console.warn("Unregister warning:", e);
            }

            await register(currentShortcut, async (event) => {
                if (event.state === "Pressed") {
                    console.log("Shortcut triggered:", currentShortcut);
                    // Force run inside React context
                    if (!captureBusyRef.current) {
                        handleNewCaptureRef.current();
                    }
                }
            });
            console.log("Registered shortcut:", currentShortcut);

            unregisterFn = () => {
                unregister(currentShortcut).catch(e => console.error("Failed to unregister", e));
            };
        } catch (err) {
            console.error("Shortcut registration failed:", err);
            const msg = err instanceof Error ? err.message : String(err);
            showToast("error", `Kısayol hatası: ${msg}`);
        }
    };

    if (currentShortcut) {
        setupShortcut();
    }

    return () => {
        if (unregisterFn) unregisterFn();
    };
  }, [currentShortcut]);

  const handleNewCaptureRef = useRef<() => Promise<void>>(async () => {});

  const handleNewCapture = async () => {
    if (captureBusy) return;
    setCaptureBusy(true);
    
    // 1. Pencereyi gizle
    const appWindow = getCurrentWindow();
    try {
        await appWindow.hide();
    } catch (err) {
        console.error("Pencere gizlenemedi:", err);
        // Devam et, belki gizlenmeden de calisabilir (debug modu vs)
    }

    // 2. Kisa bir sure bekle (pencere animasyonu bitsin)
    setTimeout(async () => {
      try {
        // 3. Ekrani yakala
        const payload = await invoke<CaptureResponse>("capture_screen", {
          monitorId: selectedMonitor,
        });
        
        setCaptureImage(`data:image/png;base64,${payload.imageBase64}`);
        setCaptureSize({ width: payload.width, height: payload.height });
        setSelection(null);
        setOcrText("");
        setOcrEngine("");
        setLastError("");

        // 4. Snipping modunu ac ve pencereyi tam ekran goster
        setIsSnippingMode(true);
        await appWindow.setFullscreen(true);
        
        // Eger spesifik bir monitor secildiyse pencereyi oraya tasi
        if (selectedMonitor !== null) {
             const monitor = monitors.find(m => m.id === selectedMonitor);
             if (monitor) {
                 await appWindow.setFullscreen(false); // Pozisyon degistirmek icin once fullscreen'den cik
                 await appWindow.setPosition(new PhysicalPosition(monitor.x, monitor.y));
                 await appWindow.setFullscreen(true); // Tekrar fullscreen yap
             }
        }

        await appWindow.show();
        await appWindow.setFocus();

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `Yakalama başarısız: ${message}`);
        setCaptureBusy(false);
        await appWindow.show(); // Hata olsa bile goster
      }
    }, 350); // 350ms bekleme
  };

  useEffect(() => {
      handleNewCaptureRef.current = handleNewCapture;
  }, [handleNewCapture]);

  const handleSelectionComplete = async (rect: Rect) => {
    // Secim tamamlandiginda otomatik olarak kirpma ve OCR baslat
    setIsSnippingMode(false);
    const appWindow = getCurrentWindow();
    await appWindow.setFullscreen(false);
    
    // Kucuk bir bekleme, UI duzelsin
    setTimeout(() => {
        handleExtractText(rect);
    }, 100);
  };

  const handleExtractText = async (overrideSelection?: Rect) => {
    const target = overrideSelection ?? selection;

    if (!captureImage || !target) {
      if (!overrideSelection) showToast("error", "Önce bir alan seçmelisiniz.");
      setCaptureBusy(false); 
      return;
    }

    setOcrBusy(true);

    try {
      const croppedDataUrl = await cropImageToBase64(captureImage, target);
      // OCR icin sadece base64 kismi lazimsa split yapalim
      const base64Data = croppedDataUrl.split(",")[1];
      
      const result = await invoke<OcrResponse>("run_ocr", {
        input: {
          imageBase64: base64Data,
          languages: "tur+eng",
        },
      });
      setOcrText(result.text);
      setOcrEngine(result.engine);
      setLastError("");
      showToast("success", "OCR tamamlandı.");

      // Save to History
      const newItem: HistoryItem = {
          id: Date.now().toString(),
          imageBase64: croppedDataUrl, // Data URI formatinda sakla
          text: result.text,
          date: new Date().toISOString()
      };
      
      const newHistory = [newItem, ...history].slice(0, 50);
      setHistory(newHistory);
      
      try {
          const store = await Store.load("settings.json");
          await store.set("history", newHistory);
          await store.save();
      } catch (e) {
          console.error("Failed to save history:", e);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("OCR Hatasi:", error);
      setLastError(message);
      showToast("error", `OCR hatası: ${message}`);
    } finally {
      setOcrBusy(false);
      setCaptureBusy(false); // Yakalama sureci burada tam bitiyor
    }
  };

  const handleCopy = async () => {
    if (!ocrText.trim()) {
      showToast("error", "Kopyalanacak metin yok.");
      return;
    }

    try {
      await navigator.clipboard.writeText(ocrText);
      showToast("success", "Metin panoya kopyalandı.");
    } catch {
      showToast("error", "Kopyalama başarısız.");
    }
  };

  // ESC ile snipping iptali
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
        if (e.key === "Escape" && isSnippingMode) {
            setIsSnippingMode(false);
            const appWindow = getCurrentWindow();
            await appWindow.setFullscreen(false);
            setCaptureBusy(false);
        }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSnippingMode]);

  const handleHistoryDelete = async (id: string) => {
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      try {
          const store = await Store.load("settings.json");
          await store.set("history", newHistory);
          await store.save();
      } catch (e) {
          console.error("Failed to delete history item:", e);
      }
  };

  const handleHistoryClear = async () => {
      setHistory([]);
      try {
          const store = await Store.load("settings.json");
          await store.set("history", []);
          await store.save();
      } catch (e) {
          console.error("Failed to clear history:", e);
      }
  };

  const handleClearWorkspace = () => {
    setCaptureImage(null);
    setOcrText("");
    setOcrEngine("");
    setLastError("");
    setSelection(null);
  };

  return (
    <main className={`app-shell ${isSnippingMode ? 'snipping-active' : ''}`}>
      {!isSnippingMode && (
          <HeaderBar
            isCaptureBusy={captureBusy}
            isOcrBusy={ocrBusy}
            onCapture={handleNewCapture}
            onExtract={() => handleExtractText()}
            onSettingsClick={() => setIsSettingsOpen(true)}
            onHistoryClick={() => setIsHistoryOpen(true)}
            onClear={handleClearWorkspace}
            canExtract={Boolean(captureImage)}
            monitors={monitors}
            selectedMonitor={selectedMonitor}
            onMonitorSelect={setSelectedMonitor}
          />
      )}

      <section className="workspace-grid" style={isSnippingMode ? { display: 'block', height: '100vh', width: '100vw', margin: 0, padding: 0 } : {}}>
        <article className="panel" style={isSnippingMode ? { border: 0, borderRadius: 0, height: '100%', background: 'black' } : {}}>
           {!isSnippingMode && (
               <div className="panel-header">
                  <h2 className="panel-title">Yakalama Alanı</h2>
                  {selection && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      {Math.round(selection.width)} x {Math.round(selection.height)} px
                    </span>
                  )}
               </div>
           )}
           
           <div className="panel-content" style={{ padding: 0, background: isSnippingMode ? '#000' : 'var(--panel-bg)', height: isSnippingMode ? '100%' : 'auto' }}>
              <CaptureCanvas
                imageSrc={captureImage}
                naturalSize={captureSize}
                selection={selection}
                onSelectionChange={setSelection}
                loading={captureBusy && !captureImage} // Image geldiyse loading degildir
                isSnippingMode={isSnippingMode}
                onSelectionComplete={handleSelectionComplete}
              />
           </div>
        </article>

        {!isSnippingMode && (
            <ResultPanel 
                text={ocrText} 
                loading={ocrBusy} 
                onCopy={handleCopy} 
                engine={ocrEngine} 
                error={lastError} 
            />
        )}
      </section>

      <StatusToast state={toast} />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        appVersion="0.1.0"
        onShortcutUpdate={(newShortcut) => setCurrentShortcut(newShortcut)}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onDelete={handleHistoryDelete}
        onClear={handleHistoryClear}
        onCopy={(text) => {
            navigator.clipboard.writeText(text);
            showToast("success", "Geçmiş metni kopyalandı.");
        }}
      />
    </main>
  );
}

export default App;
