import React from 'react';

const directions = [
  {
    id: 'DeepSlate',
    label: 'Direction 1',
    name: 'Deep Slate',
    feel: 'Dark-mode premium SaaS — focused, high contrast. Think Linear, Vercel.',
    accent: '#00C9A7',
    bg: '#0F1117',
    badgeBg: '#1A1D27',
    badgeText: '#00C9A7',
    badgeBorder: '#2A2D3E',
    labelColor: '#8B91A7',
  },
  {
    id: 'WarmStone',
    label: 'Direction 2',
    name: 'Warm Stone',
    feel: 'Light-mode, calm, grounded — like a modern clinic or productivity tool. Think Notion, Craft.',
    accent: '#4A7C59',
    bg: '#F7F5F0',
    badgeBg: '#FFFFFF',
    badgeText: '#4A7C59',
    badgeBorder: '#E2DDD5',
    labelColor: '#6B6860',
  },
  {
    id: 'SoftIndigo',
    label: 'Direction 3',
    name: 'Soft Indigo',
    feel: 'Modern SaaS — trustworthy, confident without being cold. Think Superhuman, Loom.',
    accent: '#5B5FEF',
    bg: '#F3F4F8',
    badgeBg: '#FFFFFF',
    badgeText: '#5B5FEF',
    badgeBorder: '#E0E2ED',
    labelColor: '#6B7280',
  },
];

function getBase(): string {
  return (import.meta.env.BASE_URL ?? '').replace(/\/$/, '');
}

export function Canvas() {
  const base = getBase();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#111217',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 24px',
      gap: 24,
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5B6080' }}>
          ABA Note Assistant · Design Exploration
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F0F2F7', letterSpacing: '-0.03em' }}>
          Three Redesign Directions
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#6B7280', maxWidth: 600 }}>
          Each column shows the same UI surfaces — sidebar, dashboard card, wizard step, and buttons — in a distinct visual direction. Scroll inside each preview to see more.
        </p>
      </div>

      {/* Three-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 18,
        flex: 1,
        minHeight: 0,
      }}>
        {directions.map(dir => (
          <div key={dir.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Column header */}
            <div style={{
              background: dir.badgeBg,
              border: `1px solid ${dir.badgeBorder}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: dir.labelColor, marginBottom: 3 }}>
                {dir.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: dir.badgeText === dir.accent ? dir.bg === '#0F1117' ? '#F0F2F7' : '#1C1C1C' : '#1C1C1C', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: dir.accent,
                  flexShrink: 0,
                }} />
                {dir.name}
              </div>
              <div style={{ fontSize: 11, color: dir.labelColor, marginTop: 5, lineHeight: 1.5 }}>
                {dir.feel}
              </div>
            </div>

            {/* iframe */}
            <div style={{
              flex: 1,
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid #2A2D3E`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minHeight: 700,
              position: 'relative',
            }}>
              <iframe
                src={`${base}/preview/redesign-directions/${dir.id}`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                  minHeight: 700,
                }}
                title={`${dir.name} design direction preview`}
              />
            </div>

            {/* Color swatches */}
            <div style={{
              display: 'flex',
              gap: 6,
              padding: '10px 12px',
              background: '#1A1D27',
              borderRadius: 8,
              border: '1px solid #2A2D3E',
              alignItems: 'center',
            }}>
              {[
                { color: dir.bg, label: 'BG' },
                { color: dir.accent, label: 'Accent' },
              ].map(sw => (
                <div key={sw.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: sw.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: 10, color: '#6B7280' }}>{sw.label}</span>
                  <span style={{ fontSize: 10, color: '#8B91A7', fontFamily: 'monospace' }}>{sw.color}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: '#3D4060', textAlign: 'center' }}>
        Exploration only — no changes made to the main app
      </div>
    </div>
  );
}

export default Canvas;
