import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
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
import { scanQrCode } from "./lib/qr";
import { useTheme } from "./hooks/useTheme";
import type { CaptureResponse, OcrResponse, OcrWord, Rect, ToastState, MonitorInfo, HistoryItem, ImageFilters } from "./types";

const DEFAULT_TOAST: ToastState = { kind: "hidden", message: "" };

function App() {
  const [theme, setTheme] = useTheme();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);
  
  const [currentShortcut, setCurrentShortcut] = useState("Control+Shift+F9");
  const [ocrLanguages, setOcrLanguages] = useState("tur+eng");

  const [captureImage, setCaptureImage] = useState<string | null>(null);
  const [captureSize, setCaptureSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<Rect | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrEngine, setOcrEngine] = useState("");
  const [ocrWords, setOcrWords] = useState<OcrWord[]>([]);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(DEFAULT_TOAST);
  
  const [isSnippingMode, setIsSnippingMode] = useState(false);
  const [capturePhase, setCapturePhase] = useState<'idle' | 'capturing' | 'selecting' | 'ocr'>('idle');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoCopy, setAutoCopy] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<ImageFilters>({ invert: false, contrast: 1.0 });
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

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

                // Load OCR languages
                const savedLangs = await store.get<string>("ocr-languages");
                if (savedLangs) {
                    setOcrLanguages(savedLangs);
                }
                
                // Load History
                const savedHistory = await store.get<HistoryItem[]>("history");
                if (savedHistory) {
                    setHistory(savedHistory);
                }

                // Load Auto-Copy
                const savedAutoCopy = await store.get<boolean>("auto-copy");
                if (savedAutoCopy !== undefined) {
                    setAutoCopy(savedAutoCopy);
                }

                // Load Always-On-Top
                const savedAlwaysOnTop = await store.get<boolean>("always-on-top");
                if (savedAlwaysOnTop !== undefined) {
                    setAlwaysOnTop(savedAlwaysOnTop);
                    getCurrentWindow().setAlwaysOnTop(savedAlwaysOnTop).catch(() => {});
                }

                // Pencere boyutu ve konumunu geri yükle
                try {
                    const savedW = await store.get<number>("window-width");
                    const savedH = await store.get<number>("window-height");
                    const savedX = await store.get<number>("window-x");
                    const savedY = await store.get<number>("window-y");
                    const appWindow = getCurrentWindow();
                    if (savedW && savedH && savedW > 200 && savedH > 100) {
                        await appWindow.setSize(new PhysicalSize(savedW, savedH));
                    }
                    if (savedX !== null && savedY !== null && savedX !== undefined && savedY !== undefined) {
                        await appWindow.setPosition(new PhysicalPosition(savedX, savedY));
                    }
                } catch (e) {
                    console.error("Pencere konumu geri yüklenemedi:", e);
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

  // Pencere boyutu ve konumunu kaydet (debounced)
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const saveWindowState = async () => {
      try {
        const [size, pos] = await Promise.all([
          appWindow.outerSize(),
          appWindow.outerPosition(),
        ]);
        const store = await Store.load("settings.json");
        await store.set("window-width", size.width);
        await store.set("window-height", size.height);
        await store.set("window-x", pos.x);
        await store.set("window-y", pos.y);
        await store.save();
      } catch {}
    };

    const schedule = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveWindowState, 600);
    };

    const unlistenResize = appWindow.onResized(schedule);
    const unlistenMove = appWindow.onMoved(schedule);

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      unlistenResize.then((fn) => fn());
      unlistenMove.then((fn) => fn());
    };
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

  const handleNewCaptureRef = useRef<() => Promise<void>>(async () => {});
  const previousShortcutRef = useRef<string>("");

  // Handle Global Shortcut — unregister old, register new on every change.
  // NOTE: useEffect cleanup runs AFTER the new effect fires, so we cannot rely
  // on it to unregister the previous shortcut. We track the previous value in a
  // ref and handle the full transition (unregister-old → unregister-new-if-stale
  // → register-new) in a single async sequence inside the effect itself.
  useEffect(() => {
    if (!currentShortcut) return;

    const previousShortcut = previousShortcutRef.current;
    previousShortcutRef.current = currentShortcut;

    let cancelled = false;

    const setupShortcut = async () => {
      // 1. Unregister the previous shortcut if different (shortcut changed)
      if (previousShortcut && previousShortcut !== currentShortcut) {
        try {
          await unregister(previousShortcut);
        } catch {
          // ignore — may not have been registered yet
        }
      }

      // 2. Unregister the current shortcut if already registered (hot-reload / StrictMode guard)
      try {
        if (await isRegistered(currentShortcut)) {
          await unregister(currentShortcut);
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      // 3. Register the new shortcut
      try {
        await register(currentShortcut, async (event) => {
          if (event.state === "Pressed" && !captureBusyRef.current) {
            handleNewCaptureRef.current();
          }
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        showToast("error", `Kısayol kaydedilemedi: ${msg}`);
      }
    };

    setupShortcut();

    return () => {
      cancelled = true;
      unregister(currentShortcut).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShortcut]);

  const handleNewCapture = async () => {
    if (captureBusy) return;
    setCaptureBusy(true);
    setCapturePhase('capturing');
    
    // 1. Önce DOM'u şeffaf yap (görsel flash azaltma)
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.1s ease';

    // 2. Pencereyi gizle
    const appWindow = getCurrentWindow();
    try {
        await appWindow.hide();
    } catch (err) {
        console.error("Pencere gizlenemedi:", err);
    }

    // 3. Kisa bir sure bekle (pencere animasyonu bitsin)
    setTimeout(async () => {
      try {
        // 4. Ekrani yakala
        const payload = await invoke<CaptureResponse>("capture_screen", {
          monitorId: selectedMonitor,
        });
        
        setCaptureImage(`data:image/png;base64,${payload.imageBase64}`);
        setCaptureSize({ width: payload.width, height: payload.height });
        setSelection(null);
        setOcrText("");
        setOcrEngine("");
        setOcrWords([]);
        setLastError("");

        // 5. Snipping modunu ac ve pencereyi tam ekran goster
        setIsSnippingMode(true);
        setCapturePhase('selecting');
        await appWindow.setFullscreen(true);
        
        // Eger spesifik bir monitor secildiyse pencereyi oraya tasi
        if (selectedMonitor !== null) {
             const monitor = monitors.find(m => m.id === selectedMonitor);
             if (monitor) {
                 await appWindow.setFullscreen(false);
                 await appWindow.setPosition(new PhysicalPosition(monitor.x, monitor.y));
                 await appWindow.setFullscreen(true);
             }
        }

        await appWindow.show();
        await appWindow.setFocus();

        // DOM'u geri görünür yap
        requestAnimationFrame(() => {
          document.body.style.opacity = '1';
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `Yakalama başarısız: ${message}`);
        setCaptureBusy(false);
        setCapturePhase('idle');
        await appWindow.show();
        document.body.style.opacity = '1';
      }
    }, 250); // 250ms — opacity trick sayesinde daha kısa
  };

  useEffect(() => {
      handleNewCaptureRef.current = handleNewCapture;
  }, [handleNewCapture]);

  const handleSelectionComplete = async (rect: Rect) => {
    // Secim tamamlandiginda otomatik olarak kirpma ve OCR baslat
    setIsSnippingMode(false);
    setCapturePhase('ocr');
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
    setQrResult(null); // Reset QR on new scan

    try {
      const croppedDataUrl = await cropImageToBase64(captureImage, target, filters);
      
      // Attempt QR Scan
      const qrRes = await scanQrCode(croppedDataUrl);
      if (qrRes) setQrResult(qrRes);
      // OCR icin sadece base64 kismi lazimsa split yapalim
      const base64Data = croppedDataUrl.split(",")[1];
      
      const result = await invoke<OcrResponse>("run_ocr", {
        input: {
          imageBase64: base64Data,
          languages: ocrLanguages,
        },
      });
      setOcrText(result.text);
      setOcrEngine(result.engine);
      setOcrWords(result.words ?? []);
      setLastError("");
      if (!result.text.trim()) {
        showToast("error", "OCR tamamlandı ancak metin bulunamadı.");
      } else {
        showToast("success", "OCR tamamlandı.");
      }

      // Auto-copy if enabled
      if (autoCopy && result.text.trim()) {
          navigator.clipboard.writeText(result.text.trim()).catch(() => {});
      }

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
      setCapturePhase('idle');
    }
  };

  const handleCopy = async (formattedText?: string) => {
    const textToCopy = formattedText ?? ocrText;
    if (!textToCopy.trim()) {
      showToast("error", "Kopyalanacak metin yok.");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
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
            setCapturePhase('idle');
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
    setOcrWords([]);
    setLastError("");
    setSelection(null);
  };

  // Panodan görüntü oku ve OCR'a gönder
  const handleClipboardOcr = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        showToast("error", "Tarayıcı pano okuma desteği yok.");
        return;
      }
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((res, rej) => {
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
          found = true;
          await handleImageOcr(dataUrl);
          break;
        }
      }
      if (!found) {
        showToast("error", "Panoda görüntü bulunamadı.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("error", `Pano okunamadı: ${msg}`);
    }
  };

  // Dosyadan veya panodan gelen görüntüyü direkt OCR'a gönder
  const handleImageOcr = async (dataUrl: string) => {
    if (captureBusy || ocrBusy) return;
    setCaptureBusy(true);
    setOcrBusy(true);
    setQrResult(null); // Reset QR
    setCapturePhase('ocr');

    // Görseli ekrana yükle (geçmiş için thumbnail)
    setCaptureImage(dataUrl);
    setOcrText("");
    setOcrEngine("");
    setLastError("");

    try {
      // Görüntü zaten hazır — sadece 2.5x büyütme + grayscale uygula
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      
      // Metadata set to state
      setCaptureSize({ width: img.naturalWidth, height: img.naturalHeight });
      const scaleFactor = 2.5;
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(img.naturalWidth * scaleFactor);
      canvas.height = Math.floor(img.naturalHeight * scaleFactor);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        d[i] = d[i + 1] = d[i + 2] = avg;
      }
      ctx.putImageData(imageData, 0, 0);
      const processedBase64 = canvas.toDataURL("image/png");
      
      // Attempt QR Scan
      const qrRes = await scanQrCode(processedBase64);
      if (qrRes) setQrResult(qrRes);

      const base64Only = processedBase64.split(",")[1];
      // Note: handleImageOcr currently does its own scaling/grayscale. 
      // To keep it simple, I'll update it to use cropImageToBase64 for the full image if filters are active.
      // But for now, I'll just apply the same logic as handleExtractText for consistency.
      
      const result = await invoke<OcrResponse>("run_ocr", {
        input: { imageBase64: base64Only, languages: ocrLanguages },
      });

      setOcrText(result.text);
      setOcrEngine(result.engine);
      setOcrWords(result.words ?? []);
      if (!result.text.trim()) {
        showToast("error", "OCR tamamlandı ancak metin bulunamadı.");
      } else {
        showToast("success", "OCR tamamlandı.");
      }

      // Auto-copy if enabled
      if (autoCopy && result.text.trim()) {
          navigator.clipboard.writeText(result.text.trim()).catch(() => {});
      }

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        imageBase64: dataUrl,
        text: result.text,
        date: new Date().toISOString(),
      };
      const newHistory = [newItem, ...history].slice(0, 50);
      setHistory(newHistory);
      try {
        const store = await Store.load("settings.json");
        await store.set("history", newHistory);
        await store.save();
      } catch {}
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastError(message);
      showToast("error", `OCR hatası: ${message}`);
    } finally {
      setOcrBusy(false);
      setCaptureBusy(false);
      setCapturePhase('idle');
    }
  };

  return (
    <main className={`app-shell ${isSnippingMode ? 'snipping-active' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {!isSnippingMode && (
          <HeaderBar
            isCaptureBusy={captureBusy}
            isOcrBusy={ocrBusy}
            onCapture={handleNewCapture}
            onExtract={() => handleExtractText()}
            onSettingsClick={() => setIsSettingsOpen(true)}
            onHistoryClick={() => setIsHistoryOpen(true)}
            onClear={handleClearWorkspace}
            onClipboardOcr={handleClipboardOcr}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {capturePhase !== 'idle' && (
                      <div className="progress-steps">
                        <div className={`progress-step ${capturePhase === 'capturing' ? 'active' : (capturePhase === 'selecting' || capturePhase === 'ocr') ? 'done' : ''}`}>
                          <span className="progress-step-dot"></span>
                          <span className="progress-step-label">Yakalama</span>
                        </div>
                        <div className="progress-step-line"></div>
                        <div className={`progress-step ${capturePhase === 'selecting' ? 'active' : capturePhase === 'ocr' ? 'done' : ''}`}>
                          <span className="progress-step-dot"></span>
                          <span className="progress-step-label">Seçim</span>
                        </div>
                        <div className="progress-step-line"></div>
                        <div className={`progress-step ${capturePhase === 'ocr' ? 'active' : ''}`}>
                          <span className="progress-step-dot"></span>
                          <span className="progress-step-label">OCR</span>
                        </div>
                      </div>
                    )}
                    {selection && capturePhase === 'idle' && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                        {Math.round(selection.width)} x {Math.round(selection.height)} px
                      </span>
                    )}
                  </div>
               </div>
           )}
           
           <div className="panel-content" style={{ padding: 0, background: isSnippingMode ? '#000' : 'var(--panel-bg)', height: isSnippingMode ? '100%' : 'auto' }}>
               <CaptureCanvas
                 imageSrc={captureImage}
                 naturalSize={captureSize}
                 selection={selection}
                 onSelectionChange={setSelection}
                 loading={captureBusy && !captureImage}
                 isSnippingMode={isSnippingMode}
                 onSelectionComplete={handleSelectionComplete}
                 currentShortcut={currentShortcut}
                 onFileOcr={handleImageOcr}
                 filters={filters}
                 onFiltersChange={setFilters}
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
                words={ocrWords}
                captureImage={captureImage}
                selection={selection}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                qrResult={qrResult}
            />
        )}
      </section>

      <StatusToast state={toast} />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        appVersion="1.1.7"
        currentShortcut={currentShortcut}
        onShortcutUpdate={(newShortcut) => setCurrentShortcut(newShortcut)}
        ocrLanguages={ocrLanguages}
        onOcrLanguagesUpdate={async (langs) => {
          setOcrLanguages(langs);
          try {
            const store = await Store.load("settings.json");
            await store.set("ocr-languages", langs);
            await store.save();
          } catch {}
        }}
        autoCopy={autoCopy}
        onAutoCopyUpdate={async (val) => {
            setAutoCopy(val);
            try {
                const store = await Store.load("settings.json");
                await store.set("auto-copy", val);
                await store.save();
            } catch {}
        }}
        alwaysOnTop={alwaysOnTop}
        onAlwaysOnTopUpdate={async (val: boolean) => {
            setAlwaysOnTop(val);
            try {
                getCurrentWindow().setAlwaysOnTop(val).catch(() => {});
                const store = await Store.load("settings.json");
                await store.set("always-on-top", val);
                await store.save();
            } catch {}
        }}
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
