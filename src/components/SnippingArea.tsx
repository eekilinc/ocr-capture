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
      <div className="capture-container empty-state" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          background: 'var(--modal-sidebar-bg)',
          border: '2px dashed var(--panel-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-tertiary)'
      }}>
        <div style={{ 
            background: 'rgba(99, 102, 241, 0.1)', 
            padding: '1.5rem', 
            borderRadius: '50%',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
            </svg>
        </div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 600 }}>Yakalamaya Hazır</h3>
        <p style={{ margin: 0, opacity: 0.7, maxWidth: '280px', lineHeight: '1.6' }}>
            Ekran görüntüsü almak için <strong style={{ color: 'var(--primary-color)' }}>Yeni Yakalama</strong> butonuna basın veya kısayolu kullanın.
        </p>
        <div style={{ 
            marginTop: '2rem', 
            padding: '0.5rem 1rem', 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: '8px', 
            border: '1px solid var(--panel-border)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)'
        }}>
            Kısayol: <span style={{ color: 'var(--text-primary)' }}>CTRL + ALT + SHIFT + C</span>
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
