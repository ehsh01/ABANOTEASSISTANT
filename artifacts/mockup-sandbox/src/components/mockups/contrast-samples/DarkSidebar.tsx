export default function DarkSidebar() {
  const clients = [
    { id: 1, initials: "MA", name: "Marcus A.", age: "8 yrs · Male", status: "ready", behaviors: ["Aggression", "Elopement"], programs: ["PECS", "Token Economy"] },
    { id: 2, initials: "SL", name: "Sofia L.", age: "6 yrs · Female", status: "processing", behaviors: ["Self-injury"], programs: ["Visual Schedule"] },
    { id: 3, initials: "TR", name: "Tyler R.", age: "10 yrs · Male", status: "missing", behaviors: [], programs: [] },
    { id: 4, initials: "AK", name: "Amara K.", age: "7 yrs · Female", status: "ready", behaviors: ["Tantrum", "SIB"], programs: ["DTT", "NET"] },
  ];

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    ready: { label: "Ready", bg: "#ECFDF5", text: "#047857", dot: "#10B981" },
    processing: { label: "Processing", bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
    missing: { label: "No Assessment", bg: "#FFF1F2", text: "#BE123C", dot: "#F43F5E" },
  };

  const navItems = [
    { icon: "⊞", label: "Dashboard", active: false },
    { icon: "👤", label: "Clients", active: true },
    { icon: "📄", label: "Notes", active: false },
    { icon: "⚙", label: "Admin", active: false },
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FDFAF7", minHeight: "100vh", display: "flex" }}>

      {/* Dark sidebar */}
      <div style={{ width: 220, background: "#2D1F1A", flexShrink: 0, display: "flex", flexDirection: "column", padding: "24px 0" }}>
        <div style={{ padding: "0 20px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 800, letterSpacing: "0.1em", fontSize: 10, color: "#C27A8A", textTransform: "uppercase", marginBottom: 4 }}>ABANOTEASSISTANT</div>
          <div style={{ width: 36, height: 2, background: "linear-gradient(90deg,#C27A8A,transparent)", borderRadius: 2 }} />
        </div>

        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navItems.map(item => (
            <div
              key={item.label}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10, marginBottom: 4,
                background: item.active ? "rgba(194,122,138,0.18)" : "transparent",
                borderLeft: item.active ? "3px solid #C27A8A" : "3px solid transparent",
                cursor: "pointer"
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: item.active ? 700 : 500, color: item.active ? "#F4C8D0" : "rgba(255,220,228,0.5)" }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* User at bottom */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#C27A8A,#e8c4cc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>JD</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F4C8D0" }}>Jane D.</div>
            <div style={{ fontSize: 10, color: "rgba(255,220,228,0.45)" }}>Therapist</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>

        {/* Top bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #F0E4E1", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#2D2523", margin: 0 }}>Clients</h1>
            <p style={{ fontSize: 12, color: "#877870", margin: "2px 0 0" }}>4 active clients</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ padding: "8px 14px", background: "#FDFAF7", border: "1.5px solid #F0E4E1", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#877870" }}>Filter</div>
            <div style={{ padding: "8px 18px", background: "#C27A8A", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 4px 12px rgba(194,122,138,0.25)" }}>+ New Client</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "16px 28px 0" }}>
          <div style={{ background: "#fff", border: "1.5px solid #F0E4E1", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, color: "#B08880", fontSize: 13 }}>
            🔍 <span>Search clients…</span>
          </div>
        </div>

        {/* Cards */}
        <div style={{ padding: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {clients.map(c => {
            const s = statusConfig[c.status];
            return (
              <div key={c.id} style={{ background: "#fff", border: "1.5px solid #F0E4E1", borderRadius: 18, padding: 20, boxShadow: "0 2px 12px rgba(45,31,26,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#C27A8A,#e8c4cc)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#fff", flexShrink: 0 }}>{c.initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#2D2523" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#877870", marginTop: 2 }}>{c.age}</div>
                  </div>
                  <div style={{ marginLeft: "auto", background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                    {s.label}
                  </div>
                </div>
                {c.behaviors.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "#9A7A70", marginRight: 4 }}>Behaviors:</span>
                    {c.behaviors.map(b => (
                      <span key={b} style={{ background: "#FDFAF7", color: "#5C3D35", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, border: "1px solid #F0E4E1" }}>{b}</span>
                    ))}
                  </div>
                )}
                {c.programs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#9A7A70", marginRight: 4 }}>Programs:</span>
                    {c.programs.map(p => (
                      <span key={p} style={{ background: "#FDFAF7", color: "#5C3D35", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, border: "1px solid #F0E4E1" }}>{p}</span>
                    ))}
                  </div>
                )}
                {c.behaviors.length === 0 && c.programs.length === 0 && (
                  <div style={{ fontSize: 12, color: "#B08880", fontStyle: "italic" }}>No programs on file yet</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "0 0 20px", fontSize: 12, color: "#A08070", fontWeight: 600 }}>Option C — Dark Sidebar · High-contrast nav rail, clean white content zone</div>
      </div>
    </div>
  );
}
