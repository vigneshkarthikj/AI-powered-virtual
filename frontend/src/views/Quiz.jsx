import React, { useState, useEffect } from 'react';

function Quiz({ user, headers }) {
  const [files, setFiles] = useState([]);
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedFileId, setSelectedFileId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionIdx: selectedOptionText }
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizSaved, setQuizSaved] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    // Fetch files in case they want to generate quiz from PDF
    fetch('/api/files', { headers })
      .then(res => res.json())
      .then(data => setFiles(data))
      .catch(err => console.error("Error fetching files:", err));
  }, []);

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      alert("Please enter a quiz topic.");
      return;
    }

    setLoading(true);
    setQuizQuestions([]);
    setCurrentIdx(0);
    setSelectedAnswers({});
    setQuizFinished(false);
    setQuizSaved(false);

    fetch('/api/quiz/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topic: topic,
        num_questions: numQuestions,
        file_id: selectedFileId ? parseInt(selectedFileId) : null
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to generate quiz');
        }
        return data;
      })
      .then((data) => {
        setQuizQuestions(data);
        setLoading(false);
      })
      .catch((err) => {
        alert("Failed to generate quiz: " + err.message);
        setLoading(false);
      });
  };

  const handleOptionClick = (option) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentIdx]: option
    }));
  };

  const handleNext = () => {
    if (currentIdx < quizQuestions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Calculate final score
      let score = 0;
      quizQuestions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correct_answer) {
          score++;
        }
      });
      setQuizScore(score);
      setQuizFinished(true);

      // Automatically post score to backend database
      fetch('/api/quiz/record', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: topic,
          score: score,
          total_questions: quizQuestions.length
        })
      })
        .then(res => res.json())
        .then(() => setQuizSaved(true))
        .catch(err => console.error("Error saving quiz score:", err));
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const resetQuiz = () => {
    setQuizQuestions([]);
    setQuizFinished(false);
    setSelectedAnswers({});
    setCurrentIdx(0);
    setQuizSaved(false);
  };

  if (loading) {
    return (
      <div style={{
        height: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid rgba(168, 85, 247, 0.1)',
          borderTopColor: '#a855f7',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#9ca3af', fontFamily: 'Outfit, sans-serif' }}>
          Formulating custom MCQs with Gemini AI...
        </p>
      </div>
    );
  }

  // Quiz running screen
  if (quizQuestions.length > 0 && !quizFinished) {
    const activeQuestion = quizQuestions[currentIdx];
    const chosenOption = selectedAnswers[currentIdx];

    return (
      <div className="glass-panel" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Progress header */}
        <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: '700', letterSpacing: '1px' }}>
              Quiz on: {topic}
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px' }}>
              Question {currentIdx + 1} of {quizQuestions.length}
            </h3>
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}>
            Answered: {Object.keys(selectedAnswers).length}/{quizQuestions.length}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          marginBottom: '32px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${((currentIdx + 1) / quizQuestions.length) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            transition: 'var(--transition-smooth)'
          }} />
        </div>

        {/* Question text */}
        <h2 style={{ fontSize: '18px', lineHeight: '1.5', fontWeight: '600', marginBottom: '24px' }}>
          {activeQuestion.question_text}
        </h2>

        {/* Option select list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
          {activeQuestion.options.map((opt, oIdx) => {
            const isSelected = chosenOption === opt;
            return (
              <button
                key={oIdx}
                onClick={() => handleOptionClick(opt)}
                style={{
                  textAlign: 'left',
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                  color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isSelected ? '600' : '500',
                  transition: 'var(--transition-smooth)',
                  boxShadow: isSelected ? 'var(--shadow-neon)' : 'none'
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  textAlign: 'center',
                  lineHeight: '28px',
                  backgroundColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: isSelected ? 'white' : 'var(--text-muted)',
                  marginRight: '12px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  {String.fromCharCode(65 + oIdx)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Navigation actions */}
        <div className="flex-between">
          <button 
            onClick={handlePrev} 
            className="btn-secondary"
            disabled={currentIdx === 0}
            style={{ opacity: currentIdx === 0 ? 0.3 : 1 }}
          >
            ← Previous
          </button>
          
          <button 
            onClick={handleNext} 
            className="btn-primary"
            disabled={!chosenOption}
            style={{ opacity: !chosenOption ? 0.5 : 1 }}
          >
            {currentIdx === quizQuestions.length - 1 ? 'Finish Quiz 🏁' : 'Next Question →'}
          </button>
        </div>
      </div>
    );
  }

  // Quiz completion screen
  if (quizFinished) {
    const percentage = Math.round((quizScore / quizQuestions.length) * 100);
    const isPassed = percentage >= 50;

    return (
      <div className="glass-panel" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Scorecard Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '48px' }}>{isPassed ? '🎉' : '📚'}</span>
          <h2 style={{ fontSize: '28px', fontWeight: '800', marginTop: '16px' }}>Quiz Completed</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Topic: {topic}</p>
          
          <div style={{
            display: 'inline-block',
            marginTop: '24px',
            padding: '16px 32px',
            borderRadius: '16px',
            backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isPassed ? 'var(--success)' : 'var(--danger)'}`
          }}>
            <h1 style={{ fontSize: '36px', color: isPassed ? '#10b981' : '#ef4444' }}>
              {quizScore} / {quizQuestions.length}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
              Final Score: {percentage}%
            </p>
          </div>
          {quizSaved && (
            <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px' }}>
              ✓ Score recorded successfully in database index.
            </p>
          )}
        </div>

        {/* Detailed Question Review */}
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
          Question Analysis
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
          {quizQuestions.map((q, idx) => {
            const userAns = selectedAnswers[idx];
            const isCorrect = userAns === q.correct_answer;
            return (
              <div key={idx} className="glass-card" style={{ padding: '24px', borderLeft: `4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}` }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', lineHeight: '1.4' }}>
                  {idx + 1}. {q.question_text}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Your Answer:</span>
                    <span style={{ color: isCorrect ? '#34d399' : '#f87171', fontWeight: '600' }}>
                      {userAns} {isCorrect ? '✓' : '✗'}
                    </span>
                  </div>
                  {!isCorrect && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Correct Answer:</span>
                      <span style={{ color: '#34d399', fontWeight: '600' }}>
                        {q.correct_answer}
                      </span>
                    </div>
                  )}
                </div>

                {/* Gemini's Answer Explanation */}
                <div style={{
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5'
                }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Explanation:
                  </strong>
                  {q.explanation}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div style={{ textAlign: 'center' }}>
          <button onClick={resetQuiz} className="btn-primary" style={{ padding: '12px 32px' }}>
            Take Another Quiz
          </button>
        </div>
      </div>
    );
  }

  // Quiz Setup screen
  return (
    <div className="glass-panel" style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Quiz Generator</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
        Assess your subject comprehension with customized multiple-choice tests generated on any academic topic.
      </p>

      <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
            Quiz Topic
          </label>
          <input
            type="text"
            className="input-glass"
            placeholder="E.g. CPU Scheduling Algorithms, Relational Database Normalization"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Number of Questions
            </label>
            <select
              className="input-glass"
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
              style={{ cursor: 'pointer' }}
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={8}>8 Questions</option>
              <option value={10}>10 Questions</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Quiz Source Context
            </label>
            <select
              className="input-glass"
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">General Topic Knowledge</option>
              {files.map(f => (
                <option key={f.id} value={f.id}>📄 {f.file_name}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '16px', padding: '14px' }}>
          ⚡ Generate Quiz Questions
        </button>
      </form>
    </div>
  );
}

export default Quiz;
