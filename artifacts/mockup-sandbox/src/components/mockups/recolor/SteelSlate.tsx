import React, { useState } from 'react';

const P = {
  sidebar: '#3D5166',
  sidebarBorder: 'rgba(255,255,255,0.13)',
  sidebarActive: 'rgba(0,0,0,0.2)',
  hero1: '#4A6180',
  hero2: '#3D5166',
  hero3: '#2F3E52',
  accent: '#4A6180',
  accentHover: '#3D5166',
  accentShadow: 'rgba(61,81,102,0.3)',
  bg: '#F0F2F6',
  surface: '#FFFFFF',
  text: '#1C2230',
  muted: '#6A7688',
  border: '#D8DCE6',
  cardShadow: '0 4px 20px rgba(61,81,102,0.09)',
  name: 'Steel Slate',
  hex: '#4A6180',
};

const NAV = [
  { label: 'Dashboard', active: true },
  { label: 'Clients', active: false },
  { label: 'Notes', active: false },
];

const FEATURES = [
  { icon: '⚡', title: 'Instant Notes', desc: 'Generate full clinical notes in seconds from session data.' },
  { icon: '🛡️', title: 'HIPAA Ready', desc: 'Built with privacy and compliance at the core.' },
  { icon: '✅', title: 'Smart Review', desc: 'AI checks completeness and flags missing info.' },
  { icon: '📋', title: 'Templates', desc: 'Pre-built structures for every note type you need.' },
];

export function SteelSlate() {
  const [active, setActive] = useState('Dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', background: P.bg, color: P.text, overflow: 'hidden' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 220, background: P.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <div style={{ padding: '20px 20px 18px', borderBottom: `1px solid ${P.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>ABANOTEASSISTANT</div>
            <div style={{ width: 36, height: 2, marginTop: 5, background: 'linear-gradient(90deg, rgba(255,255,255,0.7), transparent)', borderRadius: 2 }} />
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.15)', border: `1px solid ${P.sidebarBorder}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
            ↩ Log out
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <div
              key={n.label}
              onClick={() => setActive(n.label)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10,
                background: active === n.label ? P.sidebarActive : 'transparent',
                color: active === n.label ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: active === n.label ? 600 : 400, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15 }}>
                {n.label === 'Dashboard' ? '⊞' : n.label === 'Clients' ? '👤' : '📄'}
              </span>
              {n.label}
            </div>
          ))}
        </nav>

        <div style={{ padding: '0 10px 12px' }}>
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${P.sidebarBorder}`, background: 'rgba(0,0,0,0.12)' }}>
            <button style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.88)', color: P.accent, border: 'none', cursor: 'pointer' }}>EN</button>
            <button style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer' }}>ES</button>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${P.sidebarBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>JD</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Jamie D.</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>BCBA</div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ background: `linear-gradient(160deg, ${P.hero1} 0%, ${P.hero2} 50%, ${P.hero3} 100%)`, padding: '52px 48px 56px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '150%', background: P.hero1, borderRadius: '50%', opacity: 0.15, filter: 'blur(80px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '40%', height: '120%', background: P.hero3, borderRadius: '50%', opacity: 0.12, filter: 'blur(80px)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>⚡ AI-Powered Clinical Notes</span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Notes in minutes,<br />not hours</h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', margin: '0 0 28px', maxWidth: 480, lineHeight: 1.6 }}>Generate complete, compliant ABA session notes automatically from your session data.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ padding: '12px 28px', background: '#fff', color: P.accent, borderRadius: 999, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(255,255,255,0.2)' }}>✨ New Note</button>
              <button style={{ padding: '12px 28px', background: 'transparent', color: '#fff', borderRadius: 999, fontWeight: 700, fontSize: 14, border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>View Notes</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '36px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, flex: 1 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: '22px 24px', boxShadow: P.cardShadow }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(74,97,128,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: P.text, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 40px 20px', borderTop: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: P.accent, flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: P.muted }}>Option B — <strong style={{ color: P.text }}>Steel Slate</strong> · Sidebar {P.sidebar} · Accent {P.hex}</div>
        </div>
      </main>
    </div>
  );
}

export default SteelSlate;
