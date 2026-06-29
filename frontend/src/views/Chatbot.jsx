import React, { useState, useEffect, useRef } from 'react';

function Chatbot({ user, headers }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef(null);

  // Load chat sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Fetch all chat session IDs
  const fetchSessions = () => {
    fetch('/api/chat/sessions', { headers })
      .then(res => res.json())
      .then(data => {
        setSessions(data);
        if (data.length > 0 && !currentSessionId) {
          loadSession(data[0].session_id);
        } else if (data.length === 0) {
          startNewSession();
        }
      })
      .catch(err => console.error("Error fetching sessions:", err));
  };

  // Load a specific session's history
  const loadSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    setLoading(true);
    fetch(`/api/chat/history?session_id=${sessionId}`, { headers })
      .then(res => res.json())
      .then(data => {
        // Reverse array as API returns sorted desc
        const sorted = data.reverse();
        const formatted = [];
        sorted.forEach(msg => {
          formatted.push({ role: 'user', text: msg.question });
          formatted.push({ role: 'assistant', text: msg.answer });
        });
        setMessages(formatted);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading chat history:", err);
        setLoading(false);
      });
  };

  // Start a fresh chat thread
  const startNewSession = () => {
    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([{
      role: 'assistant',
      text: `Hello ${user.name}! I am your CSE AI Assistant. Ask me to explain concepts, check code snippets, or solve problems!`
    }]);
  };

  // Auto scroll to latest reply
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice Input (Web Speech API)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setQuestion(prev => (prev ? prev + " " + speechToText : speechToText));
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userQuestion = question;
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: userQuestion }]);
    setLoading(true);

    fetch('/api/chat/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: userQuestion,
        session_id: currentSessionId
      })
    })
      .then(res => res.json())
      .then(data => {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
        setLoading(false);
        // Refresh sessions list to update title
        fetchSessions();
      })
      .catch(err => {
        console.error("Chat API error:", err);
        setMessages(prev => [...prev, { role: 'assistant', text: "⚠️ Error communicating with academic backend. Please check connection." }]);
        setLoading(false);
      });
  };

  // Custom simple markdown formatter
  const formatMarkdown = (text) => {
    if (!text) return '';
    
    // Escape HTML tag openings to prevent rendering crashes
    let clean = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks styling
    clean = clean.replace(/```(\w*)\n([\s\S]*?)```/gm, (match, lang, code) => {
      return `<pre style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); padding: 12px; border-radius: 8px; font-family: monospace; overflow-x: auto; margin: 12px 0; color: #38bdf8;"><code>${code.trim()}</code></pre>`;
    });

    // Inline code styling
    clean = clean.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #f472b6;">$1</code>');

    // Bold text styling
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: white; font-weight: 700;">$1</strong>');

    // Headers styling
    clean = clean.replace(/^### (.*$)/gim, '<h4 style="margin-top: 16px; margin-bottom: 8px; color: var(--accent); font-weight: 700;">$1</h4>');
    clean = clean.replace(/^## (.*$)/gim, '<h3 style="margin-top: 20px; margin-bottom: 8px; color: var(--secondary); font-weight: 700;">$1</h3>');

    // Blockquotes styling
    clean = clean.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--primary); background: rgba(99, 102, 241, 0.05); padding: 8px 12px; margin: 12px 0; border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>');

    // Carriage breaks
    clean = clean.replace(/\n/g, '<br />');

    return clean;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px', height: 'calc(100vh - 64px)' }}>
      {/* Session Manager Side-Panel */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        <button onClick={startNewSession} className="btn-primary" style={{ padding: '10px', fontSize: '13px', width: '100%' }}>
          + New Chat Thread
        </button>
        
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px', paddingLeft: '4px' }}>
            Past Threads
          </p>
          {sessions.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '4px' }}>No history yet.</span>
          ) : (
            sessions.map(s => (
              <button
                key={s.session_id}
                onClick={() => loadSession(s.session_id)}
                style={{
                  textAlign: 'left',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: currentSessionId === s.session_id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: currentSessionId === s.session_id ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition-smooth)'
                }}
              >
                💬 {s.title || 'Untitled Thread'}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Conversation Window */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Academic Chat Assistant</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Powered by Google Gemini 1.5 Flash</p>
          </div>
          <span style={{
            fontSize: '12px',
            backgroundColor: 'rgba(99,102,241,0.1)',
            padding: '4px 10px',
            borderRadius: '6px',
            color: 'var(--primary)',
            border: '1px solid rgba(99,102,241,0.2)'
          }}>
            Active Session
          </span>
        </div>

        {/* Message Thread */}
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
                    🤖
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
                🤖
              </div>
              <div className="glass-card" style={{ padding: '12px 20px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div className="dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  <div className="dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }} style={{ animationDelay: '0.2s' }} />
                  <div className="dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }} style={{ animationDelay: '0.4s' }} />
                </div>
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                  }
                  .dot { display: inline-block; border-radius: 50%; width: 8px; height: 8px; background-color: #9ca3af; }
                `}} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} style={{
          padding: '20px 24px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          gap: '12px',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}>
          {/* Voice Speech Recognition Trigger */}
          <button 
            type="button"
            onClick={handleVoiceInput}
            style={{
              padding: '0 16px',
              borderRadius: '8px',
              border: listening ? '1px solid var(--danger)' : '1px solid var(--border-glass)',
              background: listening ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
              color: listening ? '#f87171' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              transition: 'var(--transition-smooth)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Voice Input (dictate question)"
            className={listening ? 'pulse-glow' : ''}
          >
            {listening ? '🎙️🔴' : '🎙️'}
          </button>
          
          <input
            type="text"
            className="input-glass"
            placeholder={listening ? "Listening... Speak now..." : "Ask me anything about your computer science curriculum..."}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            required
            style={{ flexGrow: 1 }}
          />
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0 24px' }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chatbot;
