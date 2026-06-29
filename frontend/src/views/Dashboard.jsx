import React, { useState, useEffect } from 'react';

function Dashboard({ user, setTab, headers }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    fetch('/api/user/stats', { headers })
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching stats:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleDeleteFile = (id) => {
    if (window.confirm("Are you sure you want to delete this file? This will remove its search index.")) {
      fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers
      })
        .then(res => res.json())
        .then(() => {
          fetchStats();
        })
        .catch(err => console.error("Error deleting file:", err));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h2 style={{ marginBottom: '24px', fontFamily: 'var(--font-title)' }}>Dashboard</h2>
        <div className="grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card" style={{ height: '150px', padding: '24px', animation: 'pulseGlow 2s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 className="text-gradient" style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px' }}>
          Hello, {user.name} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
          Welcome back to your academic workstation. You are currently tracking {stats.total_uploads} documents and {stats.total_quizzes_taken} quizzes.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid-cols-3" style={{ marginBottom: '40px' }}>
        {/* Metric 1 */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            💬
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: '800' }}>{stats.total_chats}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Academic Queries
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            📁
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: '800' }}>{stats.total_uploads}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Materials Indexed
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            🏆
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: '800' }}>
              {stats.average_quiz_score}%
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Quiz Average ({stats.total_quizzes_taken} taken)
            </p>
          </div>
        </div>
      </div>

      {/* Main grids: recent activities and shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Left Side: Recent Files & Quizzes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Uploaded Materials Panel */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>📚 Study Materials</h3>
              <button 
                onClick={() => setTab('pdfqa')} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                + Upload New
              </button>
            </div>
            
            {stats.recent_files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                No academic PDFs uploaded yet. Go to "Chat with PDF" to upload notes/textbooks!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.recent_files.map(file => (
                  <div key={file.id} className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '24px' }}>📄</span>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{file.file_name}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Size: {formatBytes(file.file_size)} • Uploaded: {new Date(file.upload_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setTab('pdfqa')} 
                        className="btn-primary" 
                        style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '6px' }}
                      >
                        💬 Chat
                      </button>
                      <button 
                        onClick={() => handleDeleteFile(file.id)} 
                        className="btn-secondary" 
                        style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quiz Performance Panel */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>📝 Recent Quiz Records</h3>
              <button 
                onClick={() => setTab('quiz')} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                + Take New Quiz
              </button>
            </div>

            {stats.recent_quizzes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                No quiz scores recorded yet. Generate a quiz on a topic to test your knowledge!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.recent_quizzes.map(quiz => {
                  const percentage = Math.round((quiz.score / quiz.total_questions) * 100);
                  const isPassed = percentage >= 50;
                  return (
                    <div key={quiz.id} className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{quiz.topic}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Score: {quiz.score}/{quiz.total_questions} ({percentage}%) • Date: {new Date(quiz.taken_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isPassed ? '#10b981' : '#ef4444',
                        border: `1px solid ${isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                      }}>
                        {isPassed ? 'PASSED' : 'RETRY'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Quick Shortcuts & Study Analytics SVG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Quick Shortcuts */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>⚡ Quick Tools</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => setTab('chatbot')} className="btn-primary" style={{ width: '100%', justifyContent: 'flex-start', padding: '14px 18px', borderRadius: '10px' }}>
                💬 Chat with Academic AI
              </button>
              <button onClick={() => setTab('quiz')} className="btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '14px 18px', borderRadius: '10px' }}>
                📝 Generate a Custom Test
              </button>
              <button onClick={() => setTab('summarizer')} className="btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '14px 18px', borderRadius: '10px' }}>
                ⚡ Summarize Textbook PDF
              </button>
              <button onClick={() => setTab('planner')} className="btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '14px 18px', borderRadius: '10px' }}>
                📅 Generate Study Timetable
              </button>
            </div>
          </div>

          {/* SVG Performance Progress Chart */}
          <div className="glass-panel" style={{ padding: '28px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', textAlign: 'left' }}>📈 Score Trend</h3>
            
            {stats.recent_quizzes.length < 2 ? (
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Take at least 2 quizzes to plot performance trends.
              </div>
            ) : (
              <div>
                <svg width="100%" height="120" viewBox="0 0 200 100" style={{ overflow: 'visible' }}>
                  {/* Grid Lines */}
                  <line x1="10" y1="10" x2="190" y2="10" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                  <line x1="10" y1="50" x2="190" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                  <line x1="10" y1="90" x2="190" y2="90" stroke="rgba(255,255,255,0.08)" />
                  
                  {/* Score Path calculation */}
                  {(() => {
                    const quizzes = [...stats.recent_quizzes].reverse();
                    const pointCount = quizzes.length;
                    const spacing = 180 / (pointCount - 1 || 1);
                    
                    let pointsStr = "";
                    const circles = [];
                    
                    quizzes.forEach((q, idx) => {
                      const x = 10 + (idx * spacing);
                      const percent = (q.score / q.total_questions) * 100;
                      // invert y: 100% -> y=10, 0% -> y=90
                      const y = 90 - (percent * 0.8);
                      pointsStr += `${x},${y} `;
                      circles.push(<circle key={idx} cx={x} cy={y} r="3" fill="#06b6d4" stroke="#0a0f1d" strokeWidth="1" />);
                    });
                    
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="url(#gradient-line)"
                          strokeWidth="3"
                          points={pointsStr.trim()}
                        />
                        <defs>
                          <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                        </defs>
                        {circles}
                      </>
                    );
                  })()}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>Earlier</span>
                  <span>Latest Quiz</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
