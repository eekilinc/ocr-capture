import { useState } from "react";
import { HistoryItem } from "../types";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onCopy: (text: string) => void;
}

export const HistoryModal = ({
  isOpen,
  onClose,
  history,
  onDelete,
  onClear,
  onCopy,
}: HistoryModalProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    onCopy(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Geçmiş ({history.length})</h3>
          <div className="header-actions">
            {history.length > 0 && (
              <button className="btn-text-danger" onClick={onClear}>
                Tümünü Temizle
              </button>
            )}
            <button className="btn-icon-sm" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body history-list">
          {history.length === 0 ? (
            <div className="history-empty-state">
              <div className="history-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <p className="history-empty-title">Geçmiş boş</p>
              <p className="history-empty-desc">Ekrandan metin yakaladıkça sonuçlar burada görünecek.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-image">
                  <img src={item.imageBase64} alt="Capture" />
                </div>
                <div className="history-content">
                  <div className="history-meta">
                    <span className="date">{new Date(item.date).toLocaleString()}</span>
                    <button 
                        className="btn-icon-sm danger"
                        onClick={() => onDelete(item.id)}
                        title="Sil"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                  </div>
                  <div className="history-text">
                    <p>{item.text || "(Metin bulunamadı)"}</p>
                  </div>
                  <button 
                    className={`btn-sm ${copiedId === item.id ? "success" : "secondary"}`}
                    onClick={() => handleCopy(item.id, item.text)}
                    disabled={!item.text}
                  >
                    {copiedId === item.id ? "Kopyalandı!" : "Metni Kopyala"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
