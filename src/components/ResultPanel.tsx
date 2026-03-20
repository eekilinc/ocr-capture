import { useState, useEffect, useRef } from "react";
import type { OcrWord, Rect } from "../types";
import { useTranslation } from "../hooks/useTranslation";

type CopyFormat = "plain" | "markdown" | "single";

type ResultPanelProps = {
  text: string;
  loading: boolean;
  onCopy: (formattedText: string) => void;
  engine: string;
  error: string;
  words: OcrWord[];
  captureImage: string | null;
  selections: Rect[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  qrResult: string | null;
};

function formatText(text: string, format: CopyFormat): string {
  switch (format) {
    case "markdown":
      return text
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n");
    case "single":
      return text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ");
    case "plain":
    default:
      return text;
  }
}

export const ResultPanel = ({
  text,
  loading,
  onCopy,
  engine,
  error,
  words,
  captureImage,
  selections,
  isCollapsed,
  onToggleCollapse,
  qrResult,
}: ResultPanelProps) => {
  const { t } = useTranslation();
  const [copyLabel, setCopyLabel] = useState("");
  const [copyFormat, setCopyFormat] = useState<CopyFormat>("plain");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showWordMap, setShowWordMap] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setCopyLabel(t("btnCopy"));
  }, [t]);

  useEffect(() => {
    if (copyLabel === t("btnCopied")) {
      const timer = setTimeout(() => setCopyLabel(t("btnCopy")), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyLabel, t]);

  useEffect(() => {
    if (!showWordMap || !imgRef.current) return;
    const obs = new ResizeObserver(() => {
      if (imgRef.current) {
        setImgDisplaySize({
          w: imgRef.current.clientWidth,
          h: imgRef.current.clientHeight,
        });
      }
    });
    obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [showWordMap]);

  const handleCopyClick = () => {
    onCopy(formatText(text, copyFormat));
    setCopyLabel(t("btnCopied"));
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    if (text.match(/[şŞıİçÇöÖüÜğĞ]/)) {
        utterance.lang = "tr-TR";
    } else {
        utterance.lang = "en-US";
    }
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const SCALE = 2.5;
  const currentRect = selections[selections.length - 1];
  const origW = currentRect ? currentRect.width : 0;
  const origH = currentRect ? currentRect.height : 0;
  const hasWords = words.length > 0;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="result-empty-state">
          <div className="result-empty-icon pulse">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <p className="result-empty-title">{t("analyzing")}</p>
          <p className="result-empty-desc">{t("pleaseWait")}</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="result-empty-state" style={{ color: "var(--danger-color)" }}>
           <div className="result-empty-icon" style={{ borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
           </div>
           <p className="result-empty-title">{t("toastOcrError")}</p>
           <p className="result-empty-desc">{error}</p>
        </div>
      );
    }

    if (showWordMap && captureImage) {
      return (
        <div className="word-map-container">
          <div className="word-map-image-wrapper">
            <img
              ref={imgRef}
              src={captureImage}
              alt="OCR"
              className="word-map-image"
              onLoad={() => {
                if (imgRef.current) {
                  setImgDisplaySize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
                }
              }}
            />
            {imgDisplaySize.w > 0 && origW > 0 &&
              words.map((word, i) => {
                const nx = (word.x / SCALE) / origW;
                const ny = (word.y / SCALE) / origH;
                const nw = (word.width / SCALE) / origW;
                const nh = (word.height / SCALE) / origH;
                const px = nx * imgDisplaySize.w;
                const py = ny * imgDisplaySize.h;
                const pw = nw * imgDisplaySize.w;
                const ph = nh * imgDisplaySize.h;
                const isHovered = hoveredWord === `${i}`;
                return (
                  <div
                    key={i}
                    className={`word-highlight ${isHovered ? "hovered" : ""} ${word.conf < 60 ? "low-conf" : ""}`}
                    style={{ left: px, top: py, width: pw, height: ph }}
                    onMouseEnter={() => setHoveredWord(`${i}`)}
                    onMouseLeave={() => setHoveredWord(null)}
                    title={`${word.text} (${Math.round(word.conf)}%)`}
                  />
                );
              })
            }
          </div>
        </div>
      );
    }

    return (
      <div className="panel-body-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        {qrResult && (
          <div className="qr-result-card">
            <div className="qr-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>{t("qrDetected")}</span>
            </div>
            <div className="qr-body">
              <p>{qrResult}</p>
              <button className="btn-icon-sm" onClick={() => { navigator.clipboard.writeText(qrResult); setCopyLabel(t("btnCopied")); }} title={t("btnCopyQr")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
        )}
        
        {text ? (
          <textarea className="result-textarea" value={text} readOnly spellCheck={false} placeholder={t("waitingResult")} />
        ) : (
          <div className="result-empty-state">
            <div className="result-empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <p className="result-empty-title">{engine ? t("noTextFound") : t("waitingResult")}</p>
            <p className="result-empty-desc">{engine ? t("noTextDesc") : t("waitingDesc")}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <article 
      className={`panel ${isCollapsed ? 'collapsed-clickable' : ''}`}
      onClick={() => {
        if (isCollapsed) onToggleCollapse();
      }}
    >
      <div className="panel-header">
        <h2 className="panel-title">{isCollapsed ? "" : t("panelTitle")}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {!isCollapsed && hasWords && !loading && !error && captureImage && (
            <button
              className={`btn btn-secondary btn-icon-sm ${showWordMap ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setShowWordMap((v) => !v); }}
              title={t("btnWordMap")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
            </button>
          )}
          {engine && !isCollapsed && <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", opacity: 0.6, fontWeight: 600 }}>{engine.split(' ')[0]}</span>}
          <button className="btn-icon-sm" onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }} title={isCollapsed ? t("btnExpand") : t("btnCollapse")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={isCollapsed ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}></polyline></svg>
          </button>
        </div>
      </div>

      <div className="panel-content">
        {renderContent()}

        {text && !loading && !error && !showWordMap && !isCollapsed && (
          <div className="copy-btn-wrapper" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select className="monitor-select" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }} value={copyFormat} onChange={(e) => setCopyFormat(e.target.value as CopyFormat)}>
              <option value="plain">{t("formatPlain")}</option>
              <option value="markdown">{t("formatMarkdown")}</option>
              <option value="single">{t("formatSingle")}</option>
            </select>
            <button className="btn btn-secondary btn-icon-sm" onClick={handleSpeak} title={isSpeaking ? t("btnStop") : t("btnSpeak")}>
              {isSpeaking ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              )}
            </button>
            <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={handleCopyClick}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>{copyLabel}</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
};
