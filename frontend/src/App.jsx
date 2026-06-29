import React, { useState, useEffect } from 'react';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Chatbot from './views/Chatbot';
import PdfQa from './views/PdfQa';
import Quiz from './views/Quiz';
import Summarizer from './views/Summarizer';
import Planner from './views/Planner';

function App() {
  const [token, setToken] = useState(localStorage.getItem('academic_assistant_token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Set Authorization headers for API calls
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Fetch current user details
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch('/api/user/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Unauthorized session');
        }
        return res.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        handleLogout();
        setLoading(false);
      });
  }, [token]);

  const handleLogin = (newToken) => {
    localStorage.setItem('academic_assistant_token', newToken);
    setToken(newToken);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('academic_assistant_token');
    setToken('');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid rgba(99, 102, 241, 0.1)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#9ca3af', fontFamily: 'Outfit, sans-serif' }}>Loading academic environment...</p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  // If not logged in, show Login view
  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  // Render the current active view
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} setTab={setActiveTab} headers={getAuthHeaders()} />;
      case 'chatbot':
        return <Chatbot user={user} headers={getAuthHeaders()} />;
      case 'pdfqa':
        return <PdfQa user={user} headers={getAuthHeaders()} />;
      case 'quiz':
        return <Quiz user={user} headers={getAuthHeaders()} />;
      case 'summarizer':
        return <Summarizer user={user} headers={getAuthHeaders()} />;
      case 'planner':
        return <Planner user={user} headers={getAuthHeaders()} />;
      default:
        return <Dashboard user={user} setTab={setActiveTab} headers={getAuthHeaders()} />;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel" style={{
        margin: '16px',
        height: 'calc(100vh - 32px)',
        borderRadius: '20px',
        padding: '24px 16px'
      }}>
        {/* Logo Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', paddingLeft: '8px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 'bold',
            boxShadow: 'var(--shadow-neon-cyan)'
          }}>
            🎓
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-title)' }}>
              Edu<span className="text-gradient-cyan">Mind</span>
            </h1>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Academic AI
            </p>
          </div>
        </div>

        {/* Tab links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'chatbot', label: 'Chat Assistant', icon: '💬' },
            { id: 'pdfqa', label: 'Chat with PDF', icon: '📁' },
            { id: 'quiz', label: 'Quiz Generator', icon: '📝' },
            { id: 'summarizer', label: 'Notes Summarizer', icon: '⚡' },
            { id: 'planner', label: 'Study Planner', icon: '📅' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? '600' : '500',
                fontSize: '14px',
                fontFamily: 'var(--font-title)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                borderLeft: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent'
              }}
              className={activeTab === tab.id ? 'pulse-glow' : ''}
            >
              <span style={{ fontSize: '16px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* User profile & logout footer */}
        <div style={{
          borderTop: '1px solid var(--border-glass)',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: 'white',
              fontSize: '14px'
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h4 style={{ fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.name}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {user.branch || 'CSE'} • Yr {user.year || 2}
              </p>
            </div>
          </div>
          
          <button onClick={handleLogout} className="btn-secondary" style={{
            padding: '10px 16px',
            fontSize: '13px',
            width: '100%',
            justifyContent: 'center'
          }}>
            🚪 Log Out
          </button>
        </div>
      </aside>

      {/* Main Active Panel View */}
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
