import React, { useState, useEffect, useRef } from 'react';

function PdfQa({ user, headers }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = () => {
    fetch('/api/files', { headers })
      .then(res => res.json())
      .then(data => {
        setFiles(data);
        if (data.length > 0 && !selectedFile) {
          selectFile(data[0]);
        }
      })
      .catch(err => console.error("Error fetching files:", err));
  };

  const selectFile = (file) => {
    setSelectedFile(file);
    setMessages([
      {
        role: 'assistant',
        text: `I have successfully parsed and indexed **${file.file_name}**. Ask me any specific question about its contents!`
      }
    ]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadPdf(file);
  };

  const uploadPdf = (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert("Only PDF documents are supported.");
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading PDF to backend...');

    const formData = new FormData();
    formData.append('file', file);

    // Fetch does not automatically use JSON headers here since boundary is set by browser
    const uploadHeaders = {
      'Authorization': headers['Authorization']
    };

    fetch('/api/files/upload', {
      method: 'POST',
      headers: uploadHeaders,
      body: formData
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Upload failed');
        }
        return data;
      })
      .then((newFile) => {
        setUploadProgress('Indexing text & generating vector embeddings...');
        // Refresh lists and select the uploaded file
        fetchFiles();
        selectFile(newFile);
        setUploading(false);
        setUploadProgress('');
      })
      .catch((err) => {
        alert("Upload failed: " + err.message);
        setUploading(false);
        setUploadProgress('');
      });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!question.trim() || loading || !selectedFile) return;

    const userQuestion = question;
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: userQuestion }]);
    setLoading(true);

    fetch('/api/files/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file_id: selectedFile.id,
        question: userQuestion
      })
    })
      .then(res => res.json())
      .then(data => {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
        setLoading(false);
      })
      .catch(err => {
        console.error("RAG query error:", err);
        setMessages(prev => [...prev, { role: 'assistant', text: "⚠️ Error querying document vector index." }]);
        setLoading(false);
      });
  };

  const handleDeleteFile = (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this file? This will remove its search index.")) {
      fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers
      })
        .then(res => res.json())
        .then(() => {
          if (selectedFile && selectedFile.id === id) {
            setSelectedFile(null);
            setMessages([]);
          }
          fetchFiles();
        })
        .catch(err => console.error("Error deleting file:", err));
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simple Markdown parser
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
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', height: 'calc(100vh - 64px)' }}>
      {/* File Tray Side-Panel */}
      <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', paddingLeft: '4px' }}>Document Storage</h3>
        
        {/* Upload Button */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          accept=".pdf"
        />
        <button 
          onClick={handleUploadClick} 
          className="btn-primary" 
          style={{ padding: '12px', fontSize: '13px', width: '100%' }}
          disabled={uploading}
        >
          {uploading ? 'Processing PDF...' : '➕ Upload Textbook'}
        </button>

        {uploading && (
          <div style={{
            fontSize: '11px',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: '8px',
            padding: '10px',
            color: 'var(--accent)',
            textAlign: 'center'
          }} className="pulse-glow">
            {uploadProgress}
          </div>
        )}

        {/* File List */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px', paddingLeft: '4px' }}>
            Available Books
          </p>
          {files.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '4px', fontStyle: 'italic' }}>
              No PDFs uploaded yet.
            </span>
          ) : (
            files.map(f => (
              <div
                key={f.id}
                onClick={() => selectFile(f)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedFile?.id === f.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: selectedFile?.id === f.id ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <div style={{
                  fontSize: '12px',
                  color: selectedFile?.id === f.id ? 'var(--text-main)' : 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexGrow: 1,
                  marginRight: '8px'
                }}>
                  📄 {f.file_name}
                </div>
                <button
                  onClick={(e) => handleDeleteFile(f.id, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '14px',
                    cursor: 'pointer',
                    opacity: selectedFile?.id === f.id ? 1 : 0.4
                  }}
                  title="Delete file"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat frame targeting document */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {selectedFile ? (
          <>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>
                  Chat: <span className="text-gradient-cyan">{selectedFile.file_name}</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Retrieval-Augmented Generation (RAG) Mode
                </p>
              </div>
              <span style={{
                fontSize: '12px',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                color: 'var(--accent)',
                border: '1px solid rgba(6, 182, 212, 0.2)'
              }}>
                {files.length} indexed
              </span>
            </div>

            {/* Conversation Flow */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div 
                    key={index} 
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    {!isUser && (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(6, 182, 212, 0.15)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                      }}>
                        📖
                      </div>
                    )}
                    <div 
                      className={isUser ? '' : 'glass-card'}
                      style={{
                        maxWidth: '75%',
                        padding: '16px 20px',
                        borderRadius: '16px',
                        backgroundColor: isUser ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
                        border: isUser ? 'none' : '1px solid var(--border-glass)',
                        color: '#e2e8f0',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        boxShadow: isUser ? '0 4px 12px rgba(99,102,241,0.2)' : 'none'
                      }}
                    >
                      {isUser ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                      ) : (
                        <div 
                          dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }} 
                          style={{ overflowWrap: 'break-word' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}>
                    📖
                  </div>
                  <div className="glass-card" style={{ padding: '12px 20px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div className="dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                      <div className="dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }} style={{ animationDelay: '0.2s' }} />
                      <div className="dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }} style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input box */}
            <form onSubmit={handleSend} style={{
              padding: '20px 24px',
              borderTop: '1px solid var(--border-glass)',
              display: 'flex',
              gap: '12px',
              backgroundColor: 'rgba(0,0,0,0.1)'
            }}>
              <input
                type="text"
                className="input-glass"
                placeholder={`Ask a question from "${selectedFile.file_name}"...`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
                required
                style={{ flexGrow: 1 }}
              />
              <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0 24px' }}>
                Ask Book
              </button>
            </form>
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
            <span style={{ fontSize: '64px' }}>📚</span>
            <div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>RAG Document Assistant</h3>
              <p style={{ maxWidth: '400px', fontSize: '14px' }}>
                Upload an academic PDF notes file or textbook on the left tray, and select it to begin asking questions directly based on its content.
              </p>
            </div>
            <button onClick={handleUploadClick} className="btn-primary" style={{ marginTop: '8px' }}>
              Upload a File Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfQa;
