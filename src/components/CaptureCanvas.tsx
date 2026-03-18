import { SnippingArea } from "./SnippingArea";
import type { Rect } from "../types";

type CaptureCanvasProps = {
  imageSrc: string | null;
  naturalSize: { width: number; height: number }; 
  selection: Rect | null;
  onSelectionChange: (rect: Rect | null) => void;
  loading: boolean;
  isSnippingMode?: boolean;
  onSelectionComplete?: (rect: Rect) => void;
  currentShortcut?: string;
};

// Wrapper to adapt old props to new SnippingArea
export const CaptureCanvas = ({ 
    imageSrc, 
    selection, 
    onSelectionChange,
    isSnippingMode,
    onSelectionComplete,
    currentShortcut
}: CaptureCanvasProps) => {
  return (
    <SnippingArea 
        imageSrc={imageSrc} 
        selection={selection} 
        onSelectionChange={onSelectionChange}
        isSnippingMode={isSnippingMode}
        onSelectionComplete={onSelectionComplete}
        currentShortcut={currentShortcut}
    />
  );
};
