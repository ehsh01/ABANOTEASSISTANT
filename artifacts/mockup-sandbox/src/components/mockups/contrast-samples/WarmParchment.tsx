export default function WarmParchment() {
  const clients = [
    { id: 1, initials: "MA", name: "Marcus A.", age: "8 yrs · Male", status: "ready", behaviors: ["Aggression", "Elopement"], programs: ["PECS", "Token Economy"] },
    { id: 2, initials: "SL", name: "Sofia L.", age: "6 yrs · Female", status: "processing", behaviors: ["Self-injury"], programs: ["Visual Schedule"] },
    { id: 3, initials: "TR", name: "Tyler R.", age: "10 yrs · Male", status: "missing", behaviors: [], programs: [] },
    { id: 4, initials: "AK", name: "Amara K.", age: "7 yrs · Female", status: "ready", behaviors: ["Tantrum", "SIB", "Aggression"], programs: ["DTT", "NET", "Mand Training"] },
  ];

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    ready: { label: "Assessment Ready", bg: "#ECFDF5", text: "#047857", dot: "#10B981" },
    processing: { label: "Processing", bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
    missing: { label: "No Assessment", bg: "#FFF1F2", text: "#BE123C", dot: "#F43F5E" },
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#F2E8E0", minHeight: "100vh" }}>

      {/* Nav */}
      <div style={{ background: "#EDE0D5", borderBottom: "1px solid #D6C4B8", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, letterSpacing: "0.12em", fontSize: 12, color: "#5C3D35", textTransform: "uppercase" }}>ABANOTEASSISTANT</span>
        <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: 600 }}>
          {["Dashboard", "Clients", "Notes", "Admin"].map((t, i) => (
            <span key={t} style={{ color: i === 1 ? "#C27A8A" : "#7A5A52", borderBottom: i === 1 ? "2px solid #C27A8A" : "none", paddingBottom: 2 }}>{t}</span>
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#C27A8A,#e8c4cc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>JD</div>
      </div>

      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #DCC4BA 0%, #E8D5CC 100%)", padding: "28px 24px 20px", borderBottom: "1px solid #C8A89C" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#3B2520", margin: 0 }}>Clients</h1>
            <p style={{ fontSize: 13, color: "#7A5A52", margin: "4px 0 0" }}>4 active clients · 3 assessments on file</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ padding: "8px 14px", background: "#FAF4F0", border: "1px solid #C8A89C", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#7A5A52" }}>Filter</div>
            <div style={{ padding: "8px 18px", background: "#C27A8A", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 4px 12px rgba(194,122,138,0.3)" }}>+ New Client</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 24px 0" }}>
        <div style={{ background: "#FAF4F0", border: "1px solid #C8A89C", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, color: "#A08070", fontSize: 13 }}>
          🔍 <span>Search clients…</span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {clients.map(c => {
          const s = statusConfig[c.status];
          return (
            <div key={c.id} style={{ background: "#FAF4F0", border: "1px solid #C8A89C", borderRadius: 18, padding: 20, boxShadow: "0 2px 8px rgba(90,50,40,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#C27A8A,#e8c4cc)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#fff", flexShrink: 0 }}>{c.initials}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#3B2520" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#8A6A60", marginTop: 2 }}>{c.age}</div>
                </div>
                <div style={{ marginLeft: "auto", background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                  {s.label}
                </div>
              </div>
              {c.behaviors.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "#9A7A70", marginRight: 4 }}>Behaviors:</span>
                  {c.behaviors.slice(0, 2).map(b => (
                    <span key={b} style={{ background: "#EDE0D5", color: "#5C3D35", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{b}</span>
                  ))}
                  {c.behaviors.length > 2 && <span style={{ background: "#EDE0D5", color: "#9A7A70", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>+{c.behaviors.length - 2}</span>}
                </div>
              )}
              {c.programs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#9A7A70", marginRight: 4 }}>Programs:</span>
                  {c.programs.slice(0, 2).map(p => (
                    <span key={p} style={{ background: "#EDE0D5", color: "#5C3D35", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{p}</span>
                  ))}
                  {c.programs.length > 2 && <span style={{ background: "#EDE0D5", color: "#9A7A70", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>+{c.programs.length - 2}</span>}
                </div>
              )}
              {c.behaviors.length === 0 && c.programs.length === 0 && (
                <div style={{ fontSize: 12, color: "#B08880", fontStyle: "italic" }}>No programs on file yet</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", padding: "8px 0 24px", fontSize: 12, color: "#A08070", fontWeight: 600 }}>Option A — Warm Parchment · Creamy background + muted warm tones</div>
    </div>
  );
}
