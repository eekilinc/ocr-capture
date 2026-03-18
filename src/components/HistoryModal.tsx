import { useState, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchCopySuccess, setIsBatchCopySuccess] = useState(false);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter((item) => item.text.toLowerCase().includes(q));
  }, [history, searchQuery]);

  const handleCopy = (id: string, text: string) => {
    onCopy(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBatchCopy = () => {
    const selectedText = filteredHistory
        .filter(item => selectedIds.has(item.id))
        .map(item => item.text)
        .join('\n\n---\n\n');
    
    if (selectedText) {
        onCopy(selectedText);
        setIsBatchCopySuccess(true);
        setTimeout(() => setIsBatchCopySuccess(false), 2000);
    }
  };

  const toggleSelect = (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredHistory.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredHistory.map(i => i.id)));
      }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Geçmiş ({filteredHistory.length}/{history.length})</h3>
          <div className="header-actions">
            {history.length > 0 && selectedIds.size > 0 && (
              <button 
                className={`btn-sm ${isBatchCopySuccess ? 'success' : 'primary'}`} 
                onClick={handleBatchCopy}
                style={{ marginRight: '0.5rem' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: 4}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {isBatchCopySuccess ? "Kopyalandı!" : `${selectedIds.size} Öğeyi Kopyala`}
              </button>
            )}
            {history.length > 0 && (
              <button className="btn-text-danger" onClick={onClear} style={{ marginRight: '0.5rem' }}>
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

        {history.length > 0 && (
          <div className="history-search-bar">
            {/* Search items... */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              className="history-search-input"
              type="text"
              placeholder="Metinlerde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="history-batch-actions">
                <button className="btn-text-sm" onClick={toggleSelectAll}>
                    {selectedIds.size === filteredHistory.length ? "Seçimi Kaldır" : "Tümünü Seç"}
                </button>
            </div>
          </div>
        )}

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
          ) : filteredHistory.length === 0 ? (
            <div className="history-empty-state">
              <div className="history-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <p className="history-empty-title">Sonuç bulunamadı</p>
              <p className="history-empty-desc">"{searchQuery}" için eşleşen kayıt yok.</p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className={`history-item ${selectedIds.has(item.id) ? 'selected' : ''}`}
                onClick={() => toggleSelect(item.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="history-checkbox" onClick={(e) => e.stopPropagation()}>
                    <input 
                        type="checkbox" 
                        checked={selectedIds.has(item.id)} 
                        onChange={() => toggleSelect(item.id)} 
                    />
                </div>
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
