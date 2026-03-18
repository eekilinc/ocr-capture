// Remove separate CaptureCanvas component and inline it for better control over the "Snipping Tool" feel
// We will integrate the canvas logic directly into the main App or a new simplified component structure.
// For now, let's update the existing components to match the new CSS class names and structure.

import { useRef, useState, useEffect } from "react";
import type { Rect } from "../types";

type SnippingAreaProps = {
  imageSrc: string | null;
  selection: Rect | null;
  onSelectionChange: (rect: Rect | null) => void;
  onSelectionComplete?: (rect: Rect) => void; // Yeni özellik: Secim bitince tetiklenir
  isSnippingMode?: boolean; // Yeni ozellik: Tam ekran modu icin stil ayari
};

export const SnippingArea = ({ 
    imageSrc, 
    selection, 
    onSelectionChange, 
    onSelectionComplete,
    isSnippingMode = false 
}: SnippingAreaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  // Reset selection when image changes
  useEffect(() => {
    onSelectionChange(null);
  }, [imageSrc]);

  if (!imageSrc) {
    return (
      <div className="capture-empty-state">
        <div className="capture-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </div>

        <h3 className="capture-empty-title">Yakalamaya Hazır</h3>
        <p className="capture-empty-desc">
          Metni çıkarmak istediğiniz ekran alanını seçmek için aşağıdaki butona tıklayın ya da kısayolu kullanın.
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
            <kbd>Ctrl</kbd>
            <span className="kbd-sep">+</span>
            <kbd>Alt</kbd>
            <span className="kbd-sep">+</span>
            <kbd>Shift</kbd>
            <span className="kbd-sep">+</span>
            <kbd>O</kbd>
          </div>
        </div>
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
         const scaleX = img.naturalWidth / img.clientWidth;
         const scaleY = img.naturalHeight / img.clientHeight;
         
         const finalRect = {
             x: x * scaleX,
             y: y * scaleY,
             width: width * scaleX,
             height: height * scaleY
         };

         onSelectionChange(finalRect);

         // Eger snipping modundaysak, secim biter bitmez islemi tamamla
         if (isSnippingMode && onSelectionComplete) {
             onSelectionComplete(finalRect);
         }
      }
    }
  };

  // Render selection box
  const renderSelection = () => {
    if (isDragging) {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);
      return (
        <div
          className="selection-box"
          style={{ left: x, top: y, width, height }}
        />
      );
    }
    
    if (selection && containerRef.current) {
       const img = containerRef.current.querySelector("img");
       if (!img) return null;
       
       const scaleX = img.clientWidth / img.naturalWidth;
       const scaleY = img.clientHeight / img.naturalHeight;

       return (
        <div
          className="selection-box"
          style={{ 
              left: selection.x * scaleX, 
              top: selection.y * scaleY, 
              width: selection.width * scaleX, 
              height: selection.height * scaleY 
          }}
        />
       );
    }
    return null;
  };

  return (
    <div 
      className={`capture-container ${imageSrc ? 'has-image' : ''} ${isSnippingMode ? 'snipping-mode-container' : ''}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img src={imageSrc} alt="Capture" className="capture-image" draggable={false} />
      <div className="selection-overlay">
        {renderSelection()}
      </div>
      
      {isSnippingMode && (
          <div className="snipping-hint">
              Alan seçmek için sürükleyip bırakın (ESC iptal)
          </div>
      )}
    </div>
  );
};
