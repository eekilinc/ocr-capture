import { useRef, useState, useEffect, useCallback } from "react";
import type { Rect } from "../types";

type SnippingAreaProps = {
  imageSrc: string | null;
  selections: Rect[];
  onSelectionsChange: (rects: Rect[]) => void;
  onSelectionComplete?: (rect: Rect) => void;
  onBatchOcr?: (rects: Rect[]) => void;
  isSnippingMode?: boolean;
  currentShortcut?: string;
  onFileOcr?: (dataUrl: string) => void;
};

const MAGNIFIER_SIZE = 120;
const ZOOM_LEVEL = 2.5;

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
  selections,
  onSelectionsChange,
  onSelectionComplete,
  onBatchOcr,
  isSnippingMode = false,
  currentShortcut = "Control+Shift+F9",
  onFileOcr,
}: SnippingAreaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);

  const updateMagnifier = (pos: { x: number, y: number }) => {
    if (!isSnippingMode || !imageSrc || !magnifierCanvasRef.current) return;
    
    const canvas = magnifierCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = containerRef.current?.querySelector("img");
    if (!ctx || !img || !img.naturalWidth) return;

    const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);
    
    // Resim uzerindeki koordinati bul
    const imgX = pos.x - offsetX;
    const imgY = pos.y - offsetY;
    
    const naturalX = (imgX / renderW) * img.naturalWidth;
    const naturalY = (imgY / renderH) * img.naturalHeight;

    ctx.imageSmoothingEnabled = false; // Piksel piksel gorunsun diye
    ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    
    const sourceSize = MAGNIFIER_SIZE / ZOOM_LEVEL;
    
    ctx.drawImage(
      img,
      naturalX - sourceSize / 2,
      naturalY - sourceSize / 2,
      sourceSize,
      sourceSize,
      0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE
    );

    // Crosshair
    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MAGNIFIER_SIZE/2, 0); ctx.lineTo(MAGNIFIER_SIZE/2, MAGNIFIER_SIZE);
    ctx.moveTo(0, MAGNIFIER_SIZE/2); ctx.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE/2);
    ctx.stroke();
    
    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.strokeRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  // Reset selections when image changes
  useEffect(() => {
    onSelectionsChange([]);
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

        <div className="capture-empty-icon pulse">
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
    
    // Shift basılı değilse mevcut seçimleri temizle
    if (!e.shiftKey) {
        onSelectionsChange([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const pos = getRelativePos(e);
    setCurrentPos(pos);
    updateMagnifier(pos);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width > 5 && height > 0) {
      const img = containerRef.current?.querySelector("img");
      if (img) {
        const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);
        const imgX = x - offsetX;
        const imgY = y - offsetY;
        const clampedX = Math.max(0, imgX);
        const clampedY = Math.max(0, imgY);
        const clampedW = Math.min(imgX + width, renderW) - clampedX;
        const clampedH = Math.min(imgY + height, renderH) - clampedY;

        if (clampedW > 5 && clampedH > 5) {
          const scaleX = img.naturalWidth / renderW;
          const scaleY = img.naturalHeight / renderH;

          const finalRect = {
            x: clampedX * scaleX,
            y: clampedY * scaleY,
            width: clampedW * scaleX,
            height: clampedH * scaleY,
          };

          const newSelections = e.shiftKey ? [...selections, finalRect] : [finalRect];
          onSelectionsChange(newSelections);

          // Snipping modunda tek seçim yeterli (varsayılan davranış)
          if (isSnippingMode && onSelectionComplete && !e.shiftKey) {
            onSelectionComplete(finalRect);
          }
        }
      }
    }
  };

  const renderSelections = () => {
    const img = containerRef.current?.querySelector("img");
    if (!img) return null;

    const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);
    const scaleX = renderW / img.naturalWidth;
    const scaleY = renderH / img.naturalHeight;

    const draggingBox = isDragging && (
        <div 
          className="selection-box dragging" 
          style={{ 
            left: Math.min(startPos.x, currentPos.x), 
            top: Math.min(startPos.y, currentPos.y), 
            width: Math.abs(currentPos.x - startPos.x), 
            height: Math.abs(currentPos.y - startPos.y) 
          }} 
        />
    );

    return (
        <>
          {selections.map((rect, i) => (
              <div 
                key={i}
                className="selection-box"
                style={{
                    left: rect.x * scaleX + offsetX,
                    top: rect.y * scaleY + offsetY,
                    width: rect.width * scaleX,
                    height: rect.height * scaleY
                }}
              />
          ))}
          {draggingBox}
        </>
    );
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
    if (isDragging || selections.length === 0 || isSnippingMode) return null;

    const img = containerRef.current?.querySelector("img");
    if (!img) return null;

    const { renderW, renderH, offsetX, offsetY } = getImageRenderRect(img);
    const scaleX = renderW / img.naturalWidth;
    const scaleY = renderH / img.naturalHeight;

    // En son eklenen kutunun üzerine toolbar koyalım
    const lastRect = selections[selections.length - 1];
    const top = lastRect.y * scaleY + offsetY;
    const left = lastRect.x * scaleX + offsetX;
    const width = lastRect.width * scaleX;
    const height = lastRect.height * scaleY;

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
        onMouseDown={e => e.stopPropagation()} 
      >
        {selections.length > 1 ? (
             <button className="toolbar-btn primary" onClick={() => onBatchOcr?.(selections)}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 11l5 5 5-5M12 4v12M21 21H3"/></svg>
               Hepsini Oku ({selections.length})
             </button>
        ) : (
            <button className="toolbar-btn" onClick={() => onSelectionComplete?.(selections[0])}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 11l5 5 5-5M12 4v12M21 21H3"/></svg>
              Çıkar
            </button>
        )}
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={() => onSelectionsChange([])} title="Tümünü Temizle">
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <img src={imageSrc} alt="Capture" className="capture-image" draggable={false} crossOrigin="anonymous" />
      <div className="selection-overlay">{renderSelections()}</div>
      {renderResolutionHint()}
      {renderFloatingToolbar()}

      {isSnippingMode && (
        <>
            <div className="snipping-hint">
                {selections.length > 0 ? "Shift + Sürükle ile daha fazla alan seçebilirsiniz" : "Alan seçmek için sürükleyip bırakın (ESC iptal)"}
            </div>
            {isDragging && (
                <div 
                    className="magnifier-container"
                    style={{
                        left: currentPos.x + 20,
                        top: currentPos.y + 20,
                        width: MAGNIFIER_SIZE,
                        height: MAGNIFIER_SIZE
                    }}
                >
                    <canvas 
                        ref={magnifierCanvasRef}
                        width={MAGNIFIER_SIZE}
                        height={MAGNIFIER_SIZE}
                    />
                </div>
            )}
        </>
      )}
    </div>
  );
};
