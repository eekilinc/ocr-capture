import { useRef, useState, useEffect, useCallback } from "react";
import type { Rect } from "../types";

type SnippingAreaProps = {
  imageSrc: string | null;
  selection: Rect | null;
  onSelectionChange: (rect: Rect | null) => void;
  onSelectionComplete?: (rect: Rect) => void;
  isSnippingMode?: boolean;
  currentShortcut?: string;
  onFileOcr?: (dataUrl: string) => void;
};

// "Control+Shift+F9" → ["Ctrl", "Shift", "F9"]
function shortcutToKeys(shortcut: string): string[] {
  return shortcut.split("+").map((k) => {
    if (k === "Control") return "Ctrl";
    if (k === "Alt") return "Alt";
    if (k === "Shift") return "Shift";
    if (k === "Meta") return "Win";
    return k;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const SnippingArea = ({
  imageSrc,
  selection,
  onSelectionChange,
  onSelectionComplete,
  isSnippingMode = false,
  currentShortcut = "Control+Shift+F9",
  onFileOcr,
}: SnippingAreaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  // Reset selection when image changes
  useEffect(() => {
    onSelectionChange(null);
  }, [imageSrc]);

  const handleFileDrop = useCallback(async (file: File) => {
    if (!onFileOcr) return;
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    onFileOcr(dataUrl);
  }, [onFileOcr]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFileDrop(file);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileDrop(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  if (!imageSrc) {
    return (
      <div
        className={`capture-empty-state ${isDragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        <div className="capture-empty-icon">
          {isDragOver ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          )}
        </div>

        <h3 className="capture-empty-title">
          {isDragOver ? "Bırakın, OCR başlasın!" : "Yakalamaya Hazır"}
        </h3>
        <p className="capture-empty-desc">
          {isDragOver
            ? "Görüntü dosyasını bırakın."
            : "Ekranı yakala ya da bir görüntü dosyasını buraya sürükle."}
        </p>

        <div className="capture-steps">
          <div className="capture-step">
            <span className="step-number">1</span>
            <span className="step-label">Yeni Yakalama'ya bas</span>
          </div>
          <div className="capture-step-arrow">→</div>
          <div className="capture-step">
            <span className="step-number">2</span>
            <span className="step-label">Alanı sürükleyerek seç</span>
          </div>
          <div className="capture-step-arrow">→</div>
          <div className="capture-step">
            <span className="step-number">3</span>
            <span className="step-label">Metni al</span>
          </div>
        </div>

        <div className="capture-shortcut-hint">
          <span className="shortcut-label">Kısayol</span>
          <div className="kbd-group">
            {shortcutToKeys(currentShortcut).map((key, i, arr) => (
              <span key={i} style={{ display: "contents" }}>
                <kbd>{key}</kbd>
                {i < arr.length - 1 && <span className="kbd-sep">+</span>}
              </span>
            ))}
          </div>
        </div>

        {onFileOcr && (
          <button
            className="btn btn-secondary file-ocr-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{ marginTop: "1rem" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Dosyadan Aç
          </button>
        )}
      </div>
    );
  }

  const getRelativePos = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // object-fit: contain durumunda görüntünün container içindeki gerçek
  // render alanını (boyut + offset) hesapla.
  const getImageRenderRect = (img: HTMLImageElement) => {
    const containerW = img.clientWidth;
    const containerH = img.clientHeight;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const containerRatio = containerW / containerH;
    const imageRatio = natW / natH;

    let renderW: number;
    let renderH: number;

    if (imageRatio > containerRatio) {
      // Genişlik kısıtlı — yatay dolduruyor, dikey letterbox
      renderW = containerW;
      renderH = containerW / imageRatio;
    } else {
      // Yükseklik kısıtlı — dikey dolduruyor, yatay letterbox
      renderH = containerH;
      renderW = containerH * imageRatio;
    }

    // Görüntü container'da ortalanıyor (object-fit: contain davranışı)
    const offsetX = (containerW - renderW) / 2;
    const offsetY = (containerH - renderH) / 2;

    return { renderW, renderH, offsetX, offsetY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getRelativePos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDragging(true);
    onSelectionChange(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const pos = getRelativePos(e);
    setCurrentPos(pos);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width > 5 && height > 5) {
      const img = containerRef.current?.querySelector("img");
      if (img) {
        const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);

        // Mouse koordinatları container'a göre — görüntünün render alanına göre ayarla
        const imgX = x - offsetX;
        const imgY = y - offsetY;

        // Görüntü sınırlarının dışına çıkmasını engelle
        const clampedX = Math.max(0, imgX);
        const clampedY = Math.max(0, imgY);
        const clampedW = Math.min(imgX + width, renderW) - clampedX;
        const clampedH = Math.min(imgY + height, renderH) - clampedY;

        if (clampedW > 5 && clampedH > 5) {
          // Render koordinatlarından doğal piksel koordinatlarına çevir
          const scaleX = img.naturalWidth / renderW;
          const scaleY = img.naturalHeight / renderH;

          const finalRect = {
            x: clampedX * scaleX,
            y: clampedY * scaleY,
            width: clampedW * scaleX,
            height: clampedH * scaleY,
          };

          onSelectionChange(finalRect);

          if (isSnippingMode && onSelectionComplete) {
            onSelectionComplete(finalRect);
          }
        }
      }
    }
  };

  const renderSelection = () => {
    if (isDragging) {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);
      return <div className="selection-box" style={{ left: x, top: y, width, height }} />;
    }

    if (selection && containerRef.current) {
      const img = containerRef.current.querySelector("img");
      if (!img) return null;

      const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);
      const scaleX = renderW / img.naturalWidth;
      const scaleY = renderH / img.naturalHeight;

      return (
        <div
          className="selection-box"
          style={{
            left: selection.x * scaleX + offsetX,
            top: selection.y * scaleY + offsetY,
            width: selection.width * scaleX,
            height: selection.height * scaleY,
          }}
        />
      );
    }
    return null;
  };
  
  const renderResolutionHint = () => {
    if (!isDragging) return null;
    const width = Math.round(Math.abs(currentPos.x - startPos.x));
    const height = Math.round(Math.abs(currentPos.y - startPos.y));
    if (width < 10 && height < 10) return null;

    return (
      <div 
        className="resolution-hint"
        style={{ 
          left: currentPos.x + 10, 
          top: currentPos.y + 20 
        }}
      >
        {width} × {height}
      </div>
    );
  };

  const renderFloatingToolbar = () => {
    if (isDragging || !selection || isSnippingMode) return null;

    const img = containerRef.current?.querySelector("img");
    if (!img) return null;

    const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);
    const scaleX = renderW / img.naturalWidth;
    const scaleY = renderH / img.naturalHeight;

    const top = selection.y * scaleY + offsetY;
    const left = selection.x * scaleX + offsetX;
    const width = selection.width * scaleX;
    const height = selection.height * scaleY;

    // Toolbar position logic (prefer below, then above)
    let toolbarTop = top + height + 8;
    if (toolbarTop + 40 > renderH + offsetY) {
        toolbarTop = top - 45;
    }

    return (
      <div 
        className="floating-selection-toolbar"
        style={{ 
          top: toolbarTop,
          left: left + width / 2,
          transform: 'translateX(-50%)' 
        }}
        onMouseDown={e => e.stopPropagation()} // Prevent deselection
      >
        <button className="toolbar-btn" onClick={() => onSelectionComplete?.(selection)} title="Metni Çıkar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 11l5 5 5-5M12 4v12M21 21H3"/></svg>
          Çıkar
        </button>
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={() => onSelectionChange(null)} title="Seçimi İptal Et">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    );
  };

  return (
    <div
      className={`capture-container ${imageSrc ? "has-image" : ""} ${isSnippingMode ? "snipping-mode-container" : ""}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img src={imageSrc} alt="Capture" className="capture-image" draggable={false} />
      <div className="selection-overlay">{renderSelection()}</div>
      {renderResolutionHint()}
      {renderFloatingToolbar()}

      {isSnippingMode && (
        <div className="snipping-hint">Alan seçmek için sürükleyip bırakın (ESC iptal)</div>
      )}
    </div>
  );
};
