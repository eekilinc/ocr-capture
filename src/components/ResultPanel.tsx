// Replacing ResultPanel with new styled version
import { useState, useEffect } from "react";

type ResultPanelProps = {
  text: string;
  loading: boolean;
  onCopy: () => void;
  engine: string;
  error: string;
};

export const ResultPanel = ({
  text,
  loading,
  onCopy,
  engine,
  error,
}: ResultPanelProps) => {
  const [copyLabel, setCopyLabel] = useState("Kopyala");

  useEffect(() => {
    if (copyLabel === "Kopyalandı!") {
      const timer = setTimeout(() => setCopyLabel("Kopyala"), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyLabel]);

  const handleCopyClick = () => {
    onCopy();
    setCopyLabel("Kopyalandı!");
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <h2 className="panel-title">OCR Sonucu</h2>
        {engine && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", opacity: 0.7 }}>
            {engine.split(' ')[0]}
          </span>
        )}
      </div>
      
      <div className="panel-content">
        {loading ? (
          <div className="shimmer" style={{ width: "100%", height: "100%", minHeight: "200px", borderRadius: "8px" }}></div>
        ) : error ? (
          <div style={{ color: "var(--danger-color)", padding: "1rem", textAlign: "center" }}>
            <p>Bir hata oluştu:</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>
          </div>
        ) : text ? (
          <textarea
            className="result-textarea"
            value={text}
            readOnly
            spellCheck={false}
          />
        ) : (
          <div className="empty-state" style={{ margin: "auto" }}>
            <p>Henüz metin çıkarılmadı.</p>
          </div>
        )}

        {text && !loading && !error && (
          <div className="copy-btn-wrapper" style={{position: 'absolute', bottom: '1.5rem', right: '1.5rem'}}>
            <button className="btn btn-primary" onClick={handleCopyClick}>
              {copyLabel === "Kopyalandı!" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              )}
              {copyLabel}
            </button>
          </div>
        )}
      </div>
    </article>
  );
};
