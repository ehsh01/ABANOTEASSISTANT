import React, { useState } from 'react';

const T = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  accent: '#4A7C59',
  accentDim: 'rgba(74,124,89,0.1)',
  text: '#1C1C1C',
  muted: '#6B6860',
  border: '#E2DDD5',
};

const nav = [
  { label: 'Dashboard', icon: '⊞', active: true },
  { label: 'Clients', icon: '👤', active: false },
  { label: 'Sessions', icon: '📋', active: false },
  { label: 'Reports', icon: '📊', active: false },
  { label: 'Settings', icon: '⚙', active: false },
];

export function WarmStone() {
  const [inputVal, setInputVal] = useState('');
  const [step, setStep] = useState(1);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: T.text, display: 'flex', flexDirection: 'column', gap: 32, padding: 28 }}>

      {/* ── SECTION LABEL ── */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>Direction 2 — Warm Stone</div>

      {/* ── SIDEBAR + NAV ── */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Sidebar &amp; Navigation</div>
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', width: 'fit-content', boxShadow: '0 2px 16px rgba(28,28,28,0.08)' }}>
          {/* Sidebar */}
          <div style={{ width: 200, background: T.surface, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4, borderRight: `1px solid ${T.border}` }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' }}>✦</div>
              <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: T.text }}>NoteAssist</span>
            </div>
            {/* Nav links */}
            {nav.map(n => (
              <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7, background: n.active ? T.accentDim : 'transparent', color: n.active ? T.accent : T.muted, fontSize: 13, fontWeight: n.active ? 600 : 400, cursor: 'pointer' }}>
                <span style={{ fontSize: 14 }}>{n.icon}</span>
                {n.label}
              </div>
            ))}
            {/* User info */}
            <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${T.accent}20`, border: `1.5px solid ${T.accent}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: T.accent, fontWeight: 700 }}>JD</div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Jamie D.</div>
                <div style={{ fontSize: 10, color: T.muted }}>BCBA</div>
              </div>
            </div>
          </div>
          {/* Main content placeholder */}
          <div style={{ width: 260, background: T.bg, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: T.text }}>Good morning, Jamie</div>
            <div style={{ fontSize: 12, color: T.muted }}>Wednesday · April 23</div>
            <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: T.border, width: '80%' }} />
            <div style={{ height: 6, borderRadius: 3, background: T.border, width: '60%' }} />
            <div style={{ height: 6, borderRadius: 3, background: T.border, width: '70%' }} />
          </div>
        </div>
      </section>

      {/* ── DASHBOARD CARD ── */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Dashboard Card</div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, width: 340, boxShadow: '0 2px 12px rgba(28,28,28,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>Active Clients</div>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: T.text }}>24</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {[{ label: 'Sessions today', val: '6' }, { label: 'Notes pending', val: '3' }].map(s => (
              <div key={s.label} style={{ flex: 1, background: T.bg, borderRadius: 8, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{s.val}</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button style={{ width: '100%', background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '-0.01em' }}>
            Start New Session
          </button>
        </div>
      </section>

      {/* ── WIZARD STEP CARD ── */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Wizard Step</div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, width: 340, boxShadow: '0 2px 12px rgba(28,28,28,0.07)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[1,2,3,4].map(s => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? T.accent : T.border }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Step {step} of 4</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: T.text, marginBottom: 6 }}>Client Behavior Target</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Describe the target behavior clearly and objectively.</div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6 }}>Behavior Label</label>
          <textarea
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="e.g. Follows 1-step instructions without prompting"
            rows={3}
            style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 12, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              onClick={() => setStep(s => Math.min(s + 1, 4))}
              style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Next →
            </button>
          </div>
        </div>
      </section>

      {/* ── BUTTONS + FORM INPUT ── */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Buttons &amp; Inputs</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 340 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Primary</button>
            <button style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Secondary</button>
            <button style={{ background: 'transparent', color: T.accent, border: `1px solid ${T.accent}50`, borderRadius: 8, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Ghost</button>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6 }}>Session Notes</label>
            <input
              placeholder="Type your notes here…"
              style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>Accent: <span style={{ color: T.accent, fontWeight: 600 }}>#4A7C59</span> · Background: <span style={{ fontWeight: 600 }}>#F7F5F0</span></div>
        </div>
      </section>
    </div>
  );
}

export default WarmStone;
