import { useState, useEffect, useRef, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { Store } from "@tauri-apps/plugin-store";
import { HeaderBar } from "./components/HeaderBar";
import { SnippingArea } from "./components/SnippingArea";
import { ResultPanel } from "./components/ResultPanel";
import { StatusToast } from "./components/StatusToast";
import { SettingsModal } from "./components/SettingsModal";
import { HistoryModal } from "./components/HistoryModal";
import { cropImageToBase64, createThumbnail } from "./lib/image";
import { scanQrCode } from "./lib/qr";
import { useTheme } from "./hooks/useTheme";
import { useTranslation } from "./hooks/useTranslation";
import type { CaptureResponse, OcrResponse, OcrWord, Rect, ToastState, MonitorInfo, HistoryItem } from "./types";

export default function App() {
  const [theme, setTheme] = useTheme();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);
  
  const [currentShortcut, setCurrentShortcut] = useState("Control+Shift+F9");
  const [ocrLanguages, setOcrLanguages] = useState("tur+eng");
  const { lang: appLang } = useTranslation();

  const [captureImage, setCaptureImage] = useState<string | null>(null);
  const [selections, setSelections] = useState<Rect[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [ocrEngine, setOcrEngine] = useState("");
  const [ocrWords, setOcrWords] = useState<OcrWord[]>([]);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "hidden", message: "" });
  
  const [isSnippingMode, setIsSnippingMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoCopy, setAutoCopy] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const storeRef = useRef<Store | null>(null);

  // Initialize App Settings
  useEffect(() => {
    const initSettings = async () => {
        try {
            const store = await Store.load("settings.json");
            storeRef.current = store;
            const setupDone = await store.get<boolean>("setup-done");

            // Load Monitors
            try {
               const mons = await invoke<MonitorInfo[]>("get_monitors");
               setMonitors(mons);
            } catch {}

            if (!setupDone) {
                try {
                    const auto = await isEnabled();
                    if (!auto) await enable();
                } catch {}
                await store.set("minimize-to-tray", true);
                await store.set("setup-done", true);
                await store.save();
            } else {
                const savedShortcut = await store.get<string>("global-shortcut");
                if (savedShortcut) setCurrentShortcut(savedShortcut);

                const savedLangs = await store.get<string>("ocr-languages");
                if (savedLangs) setOcrLanguages(savedLangs);
                
                const savedHistory = await store.get<HistoryItem[]>("history");
                if (savedHistory) setHistory(savedHistory);

                const savedAutoCopy = await store.get<boolean>("auto-copy");
                if (savedAutoCopy !== undefined) setAutoCopy(savedAutoCopy);

                const savedAlwaysOnTop = await store.get<boolean>("always-on-top");
                if (savedAlwaysOnTop !== undefined) {
                    setAlwaysOnTop(savedAlwaysOnTop);
                    getCurrentWindow().setAlwaysOnTop(savedAlwaysOnTop).catch(() => {});
                }

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
                } catch {}
            }
        } catch {}
    };
    initSettings();
  }, []);

  const showToast = useCallback((kind: "success" | "error" | "info", message: string, duration = 3000) => {
    setToast({ kind, message });
    setTimeout(() => setToast({ kind: "hidden", message: "" }), duration);
  }, []);

  const handleNewCapture = useCallback(async () => {
    if (captureBusy) return;
    setCaptureBusy(true);
    setQrResult(null);
    setLastError("");
    try {
      const resp = await invoke<CaptureResponse>("capture_screen", { monitorId: selectedMonitor });
      setCaptureImage(convertFileSrc(resp.imagePath));
      setIsSnippingMode(true);
      setSelections([]);
      setOcrText("");
      showToast("success", "toastCaptured");
    } catch (e) {
      setLastError(String(e));
      showToast("error", "toastOcrError");
    } finally {
      setCaptureBusy(false);
    }
  }, [captureBusy, selectedMonitor, showToast]);

  const handleOcr = useCallback(async (rects: Rect[]) => {
    if (!captureImage || rects.length === 0 || ocrBusy) return;
    setOcrBusy(true);
    setLastError("");
    try {
      const croppedBase64 = await cropImageToBase64(captureImage, rects[0]);
      const resp = await invoke<OcrResponse>("run_ocr", { 
        input: {
          imageBase64: croppedBase64.split(",")[1], 
          languages: ocrLanguages 
        }
      });
      
      setOcrText(resp.text);
      setOcrEngine(resp.engine);
      setOcrWords(resp.words);
      
      const qr = await scanQrCode(croppedBase64);
      setQrResult(qr);

      if (autoCopy && resp.text) {
        await invoke("copy_to_clipboard", { text: resp.text });
        showToast("success", "toastTextCopied");
      }

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        imageBase64: await createThumbnail(croppedBase64),
        text: resp.text,
        date: new Date().toISOString(),
      };
      
      const newHistory = [newItem, ...history].slice(0, 50);
      setHistory(newHistory);
      if (storeRef.current) {
        await storeRef.current.set("history", newHistory);
        await storeRef.current.save();
      }
    } catch (e) {
      setLastError(String(e));
      showToast("error", "toastOcrError");
    } finally {
      setOcrBusy(false);
      setIsSnippingMode(false);
    }
  }, [autoCopy, captureImage, history, ocrBusy, ocrLanguages, showToast]);

  const handleClipboardOcr = useCallback(async () => {
    if (ocrBusy) return;
    setOcrBusy(true);
    setLastError("");
    try {
      const imageBase64 = await invoke<string>("read_clipboard_image");
      if (!imageBase64) {
        showToast("error", "toastClipboardEmpty");
        return;
      }

      const resp = await invoke<OcrResponse>("run_ocr", { 
        input: {
          imageBase64, 
          languages: ocrLanguages 
        }
      });

      setOcrText(resp.text);
      setOcrEngine(resp.engine);
      setOcrWords(resp.words);
      setCaptureImage(`data:image/png;base64,${imageBase64}`);
      setSelections([]);
      setQrResult(null);

      if (autoCopy && resp.text) {
        await invoke("copy_to_clipboard", { text: resp.text });
        showToast("success", "toastTextCopied");
      }

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        imageBase64: await createThumbnail(`data:image/png;base64,${imageBase64}`),
        text: resp.text,
        date: new Date().toISOString(),
      };
      
      const newHistory = [newItem, ...history].slice(0, 50);
      setHistory(newHistory);
      if (storeRef.current) {
        await storeRef.current.set("history", newHistory);
        await storeRef.current.save();
      }
    } catch (e) {
      setLastError(String(e));
      showToast("error", "toastOcrError");
    } finally {
      setOcrBusy(false);
    }
  }, [autoCopy, history, ocrBusy, ocrLanguages, showToast]);

  // Shortcut Management
  useEffect(() => {
    const setupShortcuts = async () => {
      try {
        const registered = await isRegistered(currentShortcut);
        if (registered) await unregister(currentShortcut);
        
        await register(currentShortcut, (event) => {
          if (event.state === "Pressed") {
            handleNewCapture();
          }
        });
      } catch {}
    };
    setupShortcuts();
    return () => { unregister(currentShortcut).catch(() => {}); };
  }, [currentShortcut, handleNewCapture]);

  const handleImageSelect = useCallback((path: string) => {
    setCaptureImage(convertFileSrc(path));
    setIsSnippingMode(true);
    setSelections([]);
    setOcrText("");
  }, []);

  const handleClear = useCallback(() => {
    setCaptureImage(null);
    setSelections([]);
    setOcrText("");
    setOcrWords([]);
    setQrResult(null);
    setLastError("");
  }, []);

  const handleCopy = useCallback((formattedText: string) => {
    if (!formattedText) return;
    invoke("copy_to_clipboard", { text: formattedText });
    showToast("success", "toastTextCopied");
  }, [showToast]);

  const handleDeleteHistory = useCallback(async (id: string) => {
    setHistory(prev => {
        const next = prev.filter(item => item.id !== id);
        if (storeRef.current) {
            storeRef.current.set("history", next).then(() => storeRef.current?.save());
        }
        return next;
    });
  }, []);

  const handleClearHistory = useCallback(async () => {
    setHistory([]);
    if (storeRef.current) {
        await storeRef.current.set("history", []);
        await storeRef.current.save();
    }
    showToast("success", "toastHistoryCleared");
  }, [showToast]);

  const handleShortcutUpdate = useCallback(async (newShortcut: string) => {
    try {
      await unregister(currentShortcut);
      await register(newShortcut, (event) => {
        if (event.state === "Pressed") handleNewCapture();
      });
      setCurrentShortcut(newShortcut);
      if (storeRef.current) {
        await storeRef.current.set("global-shortcut", newShortcut);
        await storeRef.current.save();
      }
      showToast("success", "toastShortcutUpdated");
    } catch {
      showToast("error", "toastOcrError");
    }
  }, [currentShortcut, handleNewCapture, showToast]);

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <HeaderBar 
        isCaptureBusy={captureBusy}
        isOcrBusy={ocrBusy}
        canExtract={!!captureImage && selections.length > 0}
        onCapture={handleNewCapture}
        onExtract={() => handleOcr(selections)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onHistoryClick={() => setIsHistoryOpen(true)}
        onClear={handleClear}
        onClipboardOcr={handleClipboardOcr}
        monitors={monitors}
        selectedMonitor={selectedMonitor}
        onMonitorSelect={setSelectedMonitor}
        appVersion="1.3.5"
      />

      <main className="workspace-grid">
        <section className="panel capture-panel">
          <SnippingArea 
            imageSrc={captureImage}
            onSelectionComplete={(rects) => {
              setSelections(rects);
              handleOcr(rects);
            }}
            onImageSelect={handleImageSelect}
            isSnippingMode={isSnippingMode}
            loading={ocrBusy}
          />
        </section>

        <ResultPanel 
          text={ocrText}
          loading={ocrBusy}
          onCopy={handleCopy}
          engine={ocrEngine}
          error={lastError}
          words={ocrWords}
          captureImage={captureImage}
          selections={selections}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          qrResult={qrResult}
        />
      </main>

      <HistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onDelete={handleDeleteHistory}
        onClear={handleClearHistory}
        onCopy={handleCopy}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        appVersion="1.3.4"
        currentShortcut={currentShortcut}
        onShortcutUpdate={handleShortcutUpdate}
        ocrLanguages={ocrLanguages.split("+")}
        onOcrLanguagesUpdate={async (langs) => {
          const joined = langs.join("+");
          setOcrLanguages(joined);
          if (storeRef.current) {
            await storeRef.current.set("ocr-languages", joined);
            await storeRef.current.save();
          }
        }}
        autoCopy={autoCopy}
        onAutoCopyUpdate={async (val) => {
          setAutoCopy(val);
          if (storeRef.current) {
            await storeRef.current.set("auto-copy", val);
            await storeRef.current.save();
          }
        }}
        alwaysOnTop={alwaysOnTop}
        onAlwaysOnTopUpdate={async (val) => {
          setAlwaysOnTop(val);
          await getCurrentWindow().setAlwaysOnTop(val);
          if (storeRef.current) {
            await storeRef.current.set("always-on-top", val);
            await storeRef.current.save();
          }
        }}
        appLang={appLang}
      />

      <StatusToast state={toast} />
    </div>
  );
}
