import { useRef, useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import type { Rect } from "../types";

interface SnippingAreaProps {
  imageSrc: string | null;
  onSelectionComplete: (selections: Rect[]) => void;
  onImageSelect?: (path: string) => void;
  isSnippingMode: boolean;
  loading: boolean;
}

export const SnippingArea = ({
  imageSrc,
  onSelectionComplete,
  onImageSelect,
  isSnippingMode,
  loading,
}: SnippingAreaProps) => {
  const { t } = useTranslation();
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [localSelections, setLocalSelections] = useState<Rect[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPos = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSnippingMode || !imageSrc || loading) return;
    const pos = getPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startPos) return;
    setCurrentPos(getPos(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!startPos || !currentPos) return;

    const newRect: Rect = {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y),
    };

    if (newRect.width > 5 && newRect.height > 5) {
      const updated = e.shiftKey ? [...localSelections, newRect] : [newRect];
      setLocalSelections(updated);
      onSelectionComplete(updated);
    }

    setStartPos(null);
    setCurrentPos(null);
  };

  // Reset selections when new image loaded
  useEffect(() => {
    setLocalSelections([]);
  }, [imageSrc]);

  const handleFileOpen = async () => {
    try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
            multiple: false,
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
        });
        if (selected && !Array.isArray(selected)) {
           onImageSelect?.(selected);
        }
    } catch (err) {
        console.error("Failed to open file:", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Simple drop handling for file paths if browser supports it or handled via Tauri
    // In Tauri, drop events can be handled at window level too, but let's try local.
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        // Note: Browsers usually don't give full paths for security.
        // For Tauri, we should use the window event listener for drops to get actual paths.
        // But if user drags a file from OS to here, we might need a different approach.
    }
  };

  if (!imageSrc && !loading) {
    return (
      <div 
        className={`capture-empty-state ${isDragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="capture-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <h3 className="capture-empty-title">{t("hintReady")}</h3>
        <p className="capture-empty-desc">{t("hintMainDesc")}</p>
        
        <div className="capture-steps">
          <div className="capture-step">
            <span className="step-number">1</span>
            <span className="step-label">{t("step1")}</span>
          </div>
          <div className="capture-step-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <div className="capture-step">
            <span className="step-number">2</span>
            <span className="step-label">{t("step2")}</span>
          </div>
          <div className="capture-step-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <div className="capture-step">
            <span className="step-number">3</span>
            <span className="step-label">{t("step3")}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={handleFileOpen}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {t("hintDropFile")}
            </button>
        </div>

        <div className="capture-shortcut-hint">
            <span className="shortcut-label">{t("btnNewCapture")}</span>
            <div className="kbd-group">
                <kbd>Ctrl</kbd>
                <span className="kbd-sep">+</span>
                <kbd>Shift</kbd>
                <span className="kbd-sep">+</span>
                <kbd>F9</kbd>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`capture-container ${isSnippingMode ? "snipping" : ""} ${isDragOver ? "drag-over" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <img className="capture-image" src={imageSrc || ""} alt="capture" draggable={false} />
      
      {loading && (
        <div className="capture-loading-overlay">
            <div className="loader-pill">
              <span className="loader-dot"></span>
              <span>{t("analyzing")}</span>
            </div>
        </div>
      )}
      
      <div className="selection-overlay">
        {localSelections.map((rect, i) => (
            <div
            key={i}
            className="selection-box"
            style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                boxShadow: 'none'
            }}
            />
        ))}

        {startPos && currentPos && (
            <div
            className="selection-box"
            style={{
                left: Math.min(startPos.x, currentPos.x),
                top: Math.min(startPos.y, currentPos.y),
                width: Math.abs(currentPos.x - startPos.x),
                height: Math.abs(currentPos.y - startPos.y),
            }}
            />
        )}
      </div>


    </div>
  );
};
