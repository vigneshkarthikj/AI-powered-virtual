import React, { useState, useEffect } from 'react';

function Planner({ user, headers }) {
  // Mode selection: 'ga' (Genetic Algorithm) vs 'ai' (Gemini LLM Text Plan)
  const [mode, setMode] = useState('ga');
  
  const [examName, setExamName] = useState('Hardware Certification Exam');
  const [daysLeft, setDaysLeft] = useState(7);
  const [hoursPerDay, setHoursPerDay] = useState(4.0);
  const [loading, setLoading] = useState(false);
  
  // Custom tag subjects (for AI mode)
  const [subjectInput, setSubjectInput] = useState('');
  const [aiSubjects, setAiSubjects] = useState(['Data Structures & Algorithms', 'Database Management Systems']);
  
  // NIC 2620 curriculum subjects (loaded from backend for GA mode)
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [selectedCurriculumNames, setSelectedCurriculumNames] = useState([]);
  
  // Outputs
  const [aiPlan, setAiPlan] = useState('');
  const [gaResult, setGaResult] = useState(null);

  // Load hardware curriculum subjects on mount
  useEffect(() => {
    fetch('/api/planner/subjects', { headers })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch subjects');
        return res.json();
      })
      .then(data => {
        setCurriculumSubjects(data);
        // Select all by default to give user a good initial state
        setSelectedCurriculumNames(data.map(s => s.name));
      })
      .catch(err => console.error("Error loading curriculum subjects:", err));
  }, []);

  const handleAddAiSubject = (e) => {
    e.preventDefault();
    if (subjectInput.trim() && !aiSubjects.includes(subjectInput.trim())) {
      setAiSubjects([...aiSubjects, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const handleRemoveAiSubject = (sub) => {
    setAiSubjects(aiSubjects.filter(s => s !== sub));
  };

  const handleToggleCurriculumSubject = (name) => {
    if (selectedCurriculumNames.includes(name)) {
      setSelectedCurriculumNames(selectedCurriculumNames.filter(n => n !== name));
    } else {
      setSelectedCurriculumNames([...selectedCurriculumNames, name]);
    }
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!examName.trim()) {
      alert("Please enter the exam/goal name.");
      return;
    }

    const currentSubjects = mode === 'ga' ? selectedCurriculumNames : aiSubjects;
    if (currentSubjects.length === 0) {
      alert("Please select or add at least one subject.");
      return;
    }

    setLoading(true);
    setAiPlan('');
    setGaResult(null);

    const endpoint = mode === 'ga' ? '/api/planner/optimize' : '/api/planner';
    
    fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        exam_name: examName,
        days_left: parseInt(daysLeft),
        subjects: currentSubjects,
        hours_per_day: parseFloat(hoursPerDay)
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Optimization failed');
        }
        return data;
      })
      .then((data) => {
        if (mode === 'ga') {
          setGaResult(data);
        } else {
          setAiPlan(data.study_plan);
        }
        setLoading(false);
      })
      .catch((err) => {
        alert("Failed to generate plan: " + err.message);
        setLoading(false);
      });
  };

  const handleCopy = () => {
    const textToCopy = mode === 'ga' ? JSON.stringify(gaResult.schedule, null, 2) : aiPlan;
    navigator.clipboard.writeText(textToCopy);
    alert("Study plan copied to clipboard!");
  };

  const handleDownload = () => {
    const docName = examName.toLowerCase().replace(/\s+/g, '_');
    const element = document.createElement("a");
    let fileContent;
    let extension;
    
    if (mode === 'ga') {
      // Build markdown table from GA schedule
      let md = `# Optimized Study Schedule for ${examName}\n\n`;
      md += `Generated using Genetic Algorithm Optimization (NIC 2620 Vertical)\n`;
      md += `* Days: ${daysLeft} | Daily slots: ${Math.round(hoursPerDay)} hrs\n`;
      md += `* Target Fitness: ${gaResult.metadata.final_fitness} (Initial: ${gaResult.metadata.initial_fitness})\n\n`;
      
      gaResult.schedule.forEach(day => {
        md += `## Day ${day.day_number}\n\n`;
        md += `| Slot | Subject | Category | Activity | Difficulty |\n`;
        md += `|---|---|---|---|---|\n`;
        day.slots.forEach(slot => {
          md += `| ${slot.slot_number} | ${slot.subject} | ${slot.category} | ${slot.activity} | ${slot.difficulty} |\n`;
        });
        md += `\n`;
      });
      fileContent = new Blob([md], { type: 'text/plain' });
      extension = 'md';
    } else {
      fileContent = new Blob([aiPlan], { type: 'text/plain' });
      extension = 'md';
    }
    
    element.href = URL.createObjectURL(fileContent);
    element.download = `${docName}_study_plan.${extension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Custom simple markdown formatter for AI mode
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

  // Helper to color-code curriculum subject tags/headers
  const getCategoryColor = (category) => {
    switch (category) {
      case 'Computer Assembly': return '#f43f5e'; // rose
      case 'Peripheral Devices': return '#3b82f6'; // blue
      case 'Storage Devices': return '#10b981'; // emerald
      case 'Quality Assurance': return '#f59e0b'; // amber
      default: return '#a855f7'; // purple
    }
  };

  // Sample history array down to 15 bars for chart rendering
  const getChartBars = (history) => {
    if (!history || history.length === 0) return [];
    const step = Math.max(1, Math.floor(history.length / 15));
    const result = [];
    for (let i = 0; i < history.length; i += step) {
      result.push({
        generation: i + 1,
        fitness: history[i]
      });
    }
    // Ensure final element is present
    if (result[result.length - 1].generation !== history.length) {
      result.push({
        generation: history.length,
        fitness: history[history.length - 1]
      });
    }
    return result;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', height: 'calc(100vh - 64px)' }}>
      {/* Configuration Form Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Study Planner</h2>
        
        {/* Toggle Mode Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
          <button
            onClick={() => { setMode('ga'); setAiPlan(''); setGaResult(null); }}
            style={{
              padding: '8px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'ga' ? 'linear-gradient(135deg, #06b6d4, #6366f1)' : 'transparent',
              color: 'white',
              boxShadow: mode === 'ga' ? 'var(--shadow-neon-cyan)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            🧬 GA Optimizer
          </button>
          <button
            onClick={() => { setMode('ai'); setAiPlan(''); setGaResult(null); }}
            style={{
              padding: '8px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'ai' ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'transparent',
              color: 'white',
              boxShadow: mode === 'ai' ? 'var(--shadow-neon-purple)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            🤖 Gemini Planner
          </button>
        </div>

        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Exam / Goal Name
            </label>
            <input
              type="text"
              className="input-glass"
              placeholder="E.g. Hardware Assembly Certification"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Days Left
              </label>
              <input
                type="number"
                min="1"
                max="90"
                className="input-glass"
                value={daysLeft}
                onChange={(e) => setDaysLeft(parseInt(e.target.value))}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Hours / Day
              </label>
              <input
                type="number"
                min="1"
                max="12"
                className="input-glass"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}
                required
              />
            </div>
          </div>

          {/* GA Mode: Render checkbox selector for NIC 2620 subjects */}
          {mode === 'ga' ? (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Hardware Curriculum Subjects (NIC 2620)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {curriculumSubjects.map(sub => (
                  <div 
                    key={sub.name} 
                    onClick={() => handleToggleCurriculumSubject(sub.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: selectedCurriculumNames.includes(sub.name) ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedCurriculumNames.includes(sub.name) ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-glass)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedCurriculumNames.includes(sub.name)}
                      onChange={() => {}} // handled by div click
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'white' }}>{sub.name}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', backgroundColor: getCategoryColor(sub.category) + '22', color: getCategoryColor(sub.category), padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {sub.category}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          ⏱️ {sub.required_hours}h req
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* AI Mode: Tags manager */
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Syllabus Subjects
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="E.g. Computer Networks"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  style={{ padding: '8px' }}
                />
                <button 
                  type="button" 
                  onClick={handleAddAiSubject} 
                  className="btn-secondary" 
                  style={{ padding: '8px 12px' }}
                >
                  +
                </button>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {aiSubjects.map(s => (
                  <span key={s} style={{
                    fontSize: '11px',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-glass)',
                    padding: '4px 8px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {s}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveAiSubject(s)} 
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {aiSubjects.length === 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', fontStyle: 'italic' }}>
                    No subjects added yet.
                  </span>
                )}
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ 
              width: '100%', 
              padding: '12px', 
              marginTop: '8px', 
              background: mode === 'ga' ? 'linear-gradient(135deg, #06b6d4, #6366f1)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
              boxShadow: mode === 'ga' ? 'var(--shadow-neon-cyan)' : 'var(--shadow-neon-purple)'
            }}
            disabled={loading || (mode === 'ga' ? selectedCurriculumNames.length === 0 : aiSubjects.length === 0)}
          >
            {mode === 'ga' ? '🧬 Run Genetic Optimization' : '📅 Generate Gemini Plan'}
          </button>
        </form>
      </div>

      {/* Output Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {loading ? (
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
            <div style={{
              width: '60px',
              height: '60px',
              border: `5px solid ${mode === 'ga' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(168, 85, 247, 0.1)'}`,
              borderTopColor: mode === 'ga' ? '#06b6d4' : '#a855f7',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#e2e8f0', fontSize: '15px', fontFamily: 'Outfit, sans-serif', fontWeight: 'bold' }}>
              {mode === 'ga' 
                ? 'Running Evolutionary Chromosome Selection & Multi-Objective Optimization (Generations: 100)...' 
                : 'Formulating prompts and querying Google Gemini LLM study advisor...'}
            </p>
          </div>
        ) : gaResult || aiPlan ? (
          <>
            {/* Header controls */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>
                  {mode === 'ga' ? '🧬 Optimized Evolutionary Schedule' : '📅 AI Academic Study Calendar'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Target: {examName} • {daysLeft} Days • {Math.round(hoursPerDay)} Slots/Day
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCopy} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                  📋 Copy Content
                </button>
                <button onClick={handleDownload} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                  ⬇️ Download Calendar (.md)
                </button>
              </div>
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px' }}>
              {/* RENDER GENETIC ALGORITHM OPTIMIZATION METRICS AND SCHEDULE */}
              {mode === 'ga' && gaResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Evolutionary Analytics Dashboard */}
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 320px',
                    gap: '24px'
                  }}>
                    {/* Stat indicators */}
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#06b6d4', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>
                        Optimization Analytics
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Initial Fitness</span>
                          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#f43f5e' }}>
                            {Math.round(gaResult.metadata.initial_fitness * 100)}%
                          </span>
                        </div>
                        <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Final Optimized Fitness</span>
                          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                            {Math.round(gaResult.metadata.final_fitness * 100)}%
                          </span>
                        </div>
                        <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Generations Run</span>
                          <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
                            {gaResult.metadata.generations}
                          </span>
                        </div>
                        <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Mutation & Crossover</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', display: 'block', marginTop: '6px' }}>
                            Mut: {gaResult.metadata.mutation_rate} | Cross: {gaResult.metadata.crossover_rate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Convergence chart */}
                    <div>
                      <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#a855f7', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px', textAlign: 'center' }}>
                        Fitness Convergence Curve
                      </h4>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        height: '110px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        padding: '12px 16px 4px 16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-glass)',
                        position: 'relative'
                      }}>
                        {getChartBars(gaResult.history).map((bar, idx) => (
                          <div 
                            key={idx} 
                            style={{
                              width: '10px',
                              // Scale height between 10% and 95% based on fitness value
                              height: `${Math.max(10, Math.round(bar.fitness * 95))}%`,
                              background: 'linear-gradient(to top, #6366f1, #06b6d4)',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                            title={`Gen ${bar.generation}: ${Math.round(bar.fitness * 100)}%`}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', padding: '0 4px' }}>
                        <span>Gen 1</span>
                        <span>Evolution Progress</span>
                        <span>Gen {gaResult.metadata.generations}</span>
                      </div>
                    </div>
                  </div>

                  {/* Optimized Timetable Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {gaResult.schedule.map(day => (
                      <div 
                        key={day.day_number}
                        className="glass-panel" 
                        style={{ padding: '20px', borderRadius: '16px' }}
                      >
                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'flex', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {day.day_number}
                          </span>
                          Day {day.day_number}
                        </h4>

                        {/* List slots */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {day.slots.map(slot => (
                            <div 
                              key={slot.slot_number}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '80px 240px 1fr 120px',
                                gap: '16px',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                backgroundColor: slot.difficulty === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                                border: slot.difficulty === 0 ? '1px dashed var(--border-glass)' : '1px solid var(--border-glass)',
                                transition: 'transform 0.2s ease',
                              }}
                            >
                              {/* Slot Tag */}
                              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                Hour Slot {slot.slot_number}
                              </div>

                              {/* Subject Name and Badge */}
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: slot.difficulty === 0 ? 'var(--text-muted)' : 'white' }}>
                                  {slot.subject}
                                </div>
                                <span style={{ 
                                  fontSize: '9px', 
                                  backgroundColor: getCategoryColor(slot.category) + '15', 
                                  color: getCategoryColor(slot.category), 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  marginTop: '4px',
                                  display: 'inline-block'
                                }}>
                                  {slot.category}
                                </span>
                              </div>

                              {/* Recommended Study Activity */}
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                {slot.activity}
                              </div>

                              {/* Difficulty Tag */}
                              <div style={{ textAlign: 'right' }}>
                                {slot.difficulty > 0 ? (
                                  <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                                    {[...Array(5)].map((_, i) => (
                                      <span key={i} style={{ 
                                        color: i < slot.difficulty ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                                        fontSize: '12px' 
                                      }}>
                                        ★
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                                    💤 Rest Slot
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RENDER GEMINI TEXT PLAN FOR AI MODE */}
              {mode === 'ai' && aiPlan && (
                <div className="markdown-content" style={{ lineHeight: '1.6' }}>
                  <div 
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(aiPlan) }} 
                    style={{ color: '#e2e8f0' }}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty console state */
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
            <span style={{ fontSize: '64px' }}>{mode === 'ga' ? '🧬' : '📅'}</span>
            <div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>
                {mode === 'ga' ? 'Evolutionary Optimization Engine' : 'AI Study Planner Console'}
              </h3>
              <p style={{ maxWidth: '450px', fontSize: '14px', lineHeight: '1.5' }}>
                {mode === 'ga' 
                  ? 'Select courses from the official NIC 2620 Computer & Peripheral Hardware curriculum, specify daily slots, and run the Genetic Algorithm to optimize a balanced study schedule that converges over 100 generations.'
                  : 'Configure target exam details, add custom subjects list, choose study availability, and let Google Gemini AI build a customized study calendar.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Planner;
