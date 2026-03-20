import { SnippingArea } from "./SnippingArea";
import type { Rect, ImageFilters } from "../types";

type CaptureCanvasProps = {
  imageSrc: string | null;
  naturalSize: { width: number; height: number }; 
  selections: Rect[];
  onSelectionsChange: (rects: Rect[]) => void;
  loading: boolean;
  isSnippingMode?: boolean;
  onSelectionComplete?: (rect: Rect) => void;
  onBatchOcr?: (rects: Rect[]) => void;
  currentShortcut?: string;
  onFileOcr?: (dataUrl: string) => void;
  filters: ImageFilters;
  onFiltersChange: (filters: ImageFilters) => void;
};

// Wrapper to adapt old props to new SnippingArea
export const CaptureCanvas = ({ 
    imageSrc, 
    selections, 
    onSelectionsChange,
    isSnippingMode,
    onSelectionComplete,
    onBatchOcr,
    currentShortcut,
    onFileOcr,
    filters,
    onFiltersChange,
}: CaptureCanvasProps) => {
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <SnippingArea 
            imageSrc={imageSrc} 
            selections={selections} 
            onSelectionsChange={onSelectionsChange}
            isSnippingMode={isSnippingMode}
            onSelectionComplete={onSelectionComplete}
            onBatchOcr={onBatchOcr}
            currentShortcut={currentShortcut}
            onFileOcr={onFileOcr}
        />
        
        {imageSrc && !isSnippingMode && (
          <div className="filter-bar">
            <button 
                className={`filter-btn ${filters.invert ? 'active' : ''}`} 
                onClick={() => onFiltersChange({ ...filters, invert: !filters.invert })}
                title="Renkleri Ters Çevir (Invert)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M12 2a10 10 0 0 0 0 20"></path>
              </svg>
            </button>
            <button 
                className={`filter-btn ${filters.contrast > 1 ? 'active' : ''}`} 
                onClick={() => onFiltersChange({ ...filters, contrast: filters.contrast > 1 ? 1.0 : 1.5 })}
                title="Yüksek Kontrast"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2v20"></path>
                <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"></path>
              </svg>
            </button>
          </div>
        )}
    </div>
  );
};
