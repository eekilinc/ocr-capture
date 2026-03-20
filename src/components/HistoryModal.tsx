import { useState, useMemo } from "react";
import type { HistoryItem } from "../types";
import { useTranslation } from "../hooks/useTranslation";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onCopy: (text: string) => void;
}

function getRelativeTime(dateStr: string, currentLang: string) {
  const langTag = currentLang === 'tr' ? 'tr-TR' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(langTag, { numeric: 'auto' });
  const date = new Date(dateStr);
  
  const diffInDays = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(diffInDays) > 7) {
     return date.toLocaleDateString(langTag, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (Math.abs(diffInDays) >= 1) {
     return rtf.format(Math.round(diffInDays), 'day');
  }
  const diffInHours = (date.getTime() - Date.now()) / (1000 * 60 * 60);
  if (Math.abs(diffInHours) >= 1) {
     return rtf.format(Math.round(diffInHours), 'hour');
  }
  const diffInMinutes = (date.getTime() - Date.now()) / (1000 * 60);
  if (Math.abs(diffInMinutes) >= 1) {
     return rtf.format(Math.round(diffInMinutes), 'minute');
  }
  return rtf.format(Math.round((date.getTime() - Date.now()) / 1000), 'second');
}

export const HistoryModal = ({
  isOpen,
  onClose,
  history,
  onDelete,
  onClear,
  onCopy,
}: HistoryModalProps) => {
  const { t, lang } = useTranslation();
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
          <h3>{t("history")} ({filteredHistory.length}/{history.length})</h3>
          <div className="header-actions">
            {history.length > 0 && selectedIds.size > 0 && (
              <button 
                className={`btn btn-secondary btn-sm ${isBatchCopySuccess ? "success" : ""}`} 
                onClick={handleBatchCopy}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: 4}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {isBatchCopySuccess ? t("btnCopied") : t("copyNItems", { count: selectedIds.size })}
              </button>
            )}
            {history.length > 0 && (
              <button className="btn-text-danger" onClick={onClear}>
                {t("clearAll")}
              </button>
            )}
            <button className="btn-icon-sm" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--modal-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-color)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--modal-border)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                type="text"
                placeholder={t("searchInTexts")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={toggleSelectAll}>
                {selectedIds.size === filteredHistory.length ? t("deselectAll") : t("selectAll")}
            </button>
          </div>
        )}

        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty-state">
              <div className="history-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <p className="history-empty-title">{t("historyEmptyTitle")}</p>
              <p className="history-empty-desc">{t("historyEmptyDesc")}</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="history-empty-state">
              <div className="history-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <p className="history-empty-title">{t("noResultsFoundTitle")}</p>
              <p className="history-empty-desc">{t("noResultsFoundDesc", { query: searchQuery })}</p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className={`history-item ${selectedIds.has(item.id) ? 'selected' : ''}`}
                onClick={() => toggleSelect(item.id)}
              >
                <div className="history-checkbox" onClick={(e) => e.stopPropagation()}>
                    <input 
                        type="checkbox" 
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        checked={selectedIds.has(item.id)} 
                        onChange={() => toggleSelect(item.id)} 
                    />
                </div>
                <div className="history-image">
                  <img src={item.imageBase64} alt="capture" />
                </div>
                <div className="history-content">
                  <div className="history-meta">
                    <span className="date" title={new Date(item.date).toLocaleString()}>
                      {getRelativeTime(item.date, lang)}
                    </span>
                    <button className="btn-icon-sm danger" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} title={t("btnDelete")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                  <div className="history-text">
                    <p>{item.text || t("noTextFound")}</p>
                  </div>
                  <div className="history-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`btn-sm ${copiedId === item.id ? "success" : "secondary"}`} onClick={(e) => { e.stopPropagation(); handleCopy(item.id, item.text); }} disabled={!item.text}>
                      {copiedId === item.id ? t("btnCopied") : t("btnCopyText")}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
