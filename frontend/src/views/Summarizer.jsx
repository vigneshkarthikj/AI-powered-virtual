import React, { useState, useEffect } from 'react';

function Summarizer({ user, headers }) {
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [detailLevel, setDetailLevel] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = () => {
    fetch('/api/files', { headers })
      .then(res => res.json())
      .then(data => {
        setFiles(data);
        if (data.length > 0 && !selectedFileId) {
          setSelectedFileId(data[0].id.toString());
        }
      })
      .catch(err => console.error("Error fetching files:", err));
  };

  const handleSummarize = (e) => {
    e.preventDefault();
    if (!selectedFileId) {
      alert("Please upload and select a PDF file first.");
      return;
    }

    setLoading(true);
    setSummary('');

    fetch('/api/summarize', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file_id: parseInt(selectedFileId),
        detail_level: detailLevel
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Summarization failed');
        }
        return data;
      })
      .then((data) => {
        setSummary(data.summary);
        setLoading(false);
      })
      .catch((err) => {
        alert("Failed to summarize notes: " + err.message);
        setLoading(false);
      });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    alert("Summary copied to clipboard!");
  };

  const handleDownload = () => {
    const file = files.find(f => f.id.toString() === selectedFileId);
    const docName = file ? file.file_name.replace('.pdf', '') : 'notes';
    const element = document.createElement("a");
    const fileContent = new Blob([summary], { type: 'text/plain' });
    element.href = URL.createObjectURL(fileContent);
    element.download = `${docName}_summary.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Custom simple markdown formatter
  const formatMarkdown = (text) => {
    if (!text) return '';
    let clean = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    clean = clean.replace(/```(\w*)\n([\s\S]*?)```/gm, '<pre style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); padding: 12px; border-radius: 8px; font-family: monospace; overflow-x: auto; margin: 12px 0; color: #38bdf8;"><code>$2</code></pre>');
    clean = clean.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #f472b6;">$1</code>');
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: white; font-weight: 700;">$1</strong>');
    clean = clean.replace(/^### (.*$)/gim, '<h4 style="margin-top: 16px; margin-bottom: 8px; color: var(--accent); font-weight: 700;">$1</h4>');
    clean = clean.replace(/^## (.*$)/gim, '<h3 style="margin-top: 20px; margin-bottom: 8px; color: var(--secondary); font-weight: 700;">$1</h3>');
    clean = clean.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--primary); background: rgba(99, 102, 241, 0.05); padding: 8px 12px; margin: 12px 0; border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>');
    clean = clean.replace(/\n/g, '<br />');
    return clean;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: 'calc(100vh - 64px)' }}>
      {/* Settings Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Summarizer</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Distill large, complex reference textbooks or class notes PDFs into clean, digestible takeaways.
        </p>

        <form onSubmit={handleSummarize} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Select Document
            </label>
            {files.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--danger)', fontStyle: 'italic' }}>
                Please upload a PDF file first in PDF QA mode.
              </p>
            ) : (
              <select
                className="input-glass"
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {files.map(f => (
                  <option key={f.id} value={f.id}>📄 {f.file_name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Summary detail level
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'short', title: 'High-Level (Short)', desc: 'Bullet points, under 300 words.' },
                { id: 'medium', title: 'Standard (Medium)', desc: 'Core takeaways, under 800 words.' },
                { id: 'detailed', title: 'Comprehensive (Deep)', desc: 'Full outlines, formula listings, ASCII mind maps.' }
              ].map(lvl => (
                <label key={lvl.id} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: detailLevel === lvl.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  background: detailLevel === lvl.id ? 'rgba(99,102,241,0.05)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>
                  <input
                    type="radio"
                    name="detail"
                    checked={detailLevel === lvl.id}
                    onChange={() => setDetailLevel(lvl.id)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-main)' }}>{lvl.title}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{lvl.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            disabled={loading || files.length === 0}
          >
            ⚡ Generate Summary
          </button>
        </form>
      </div>

      {/* Output Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {summary ? (
          <>
            {/* Header controls */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Summary Output</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Format: Markdown File (.md)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCopy} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                  📋 Copy Text
                </button>
                <button onClick={handleDownload} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                  ⬇️ Download Summary
                </button>
              </div>
            </div>

            {/* Content Display */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '32px', lineHeight: '1.6' }} className="markdown-content">
              <div 
                dangerouslySetInnerHTML={{ __html: formatMarkdown(summary) }} 
                style={{ color: '#e2e8f0' }}
              />
            </div>
          </>
        ) : (
          <div style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            gap: '16px'
          }}>
            {loading ? (
              <>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '5px solid rgba(6, 182, 212, 0.1)',
                  borderTopColor: '#06b6d4',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#9ca3af', fontFamily: 'Outfit, sans-serif' }}>
                  Reading pages and parsing content...
                </p>
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}} />
              </>
            ) : (
              <>
                <span style={{ fontSize: '64px' }}>⚡</span>
                <div>
                  <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>Notes Summary Console</h3>
                  <p style={{ maxWidth: '400px', fontSize: '14px' }}>
                    Select a textbook, configure the detail level, and let Gemini compile summaries, formulas, and visual outline blocks.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Summarizer;
