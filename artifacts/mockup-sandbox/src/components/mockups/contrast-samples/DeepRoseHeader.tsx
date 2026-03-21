export default function DeepRoseHeader() {
  const clients = [
    { id: 1, initials: "MA", name: "Marcus A.", age: "8 yrs · Male", status: "ready", behaviors: ["Aggression", "Elopement"], programs: ["PECS", "Token Economy"] },
    { id: 2, initials: "SL", name: "Sofia L.", age: "6 yrs · Female", status: "processing", behaviors: ["Self-injury"], programs: ["Visual Schedule"] },
    { id: 3, initials: "TR", name: "Tyler R.", age: "10 yrs · Male", status: "missing", behaviors: [], programs: [] },
    { id: 4, initials: "AK", name: "Amara K.", age: "7 yrs · Female", status: "ready", behaviors: ["Tantrum", "SIB"], programs: ["DTT", "NET"] },
  ];

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    ready: { label: "Assessment Ready", bg: "#ECFDF5", text: "#047857", dot: "#10B981" },
    processing: { label: "Processing", bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
    missing: { label: "No Assessment", bg: "#FFF1F2", text: "#BE123C", dot: "#F43F5E" },
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FDFAF7", minHeight: "100vh" }}>

      {/* Nav — deep rose */}
      <div style={{ background: "#7A3545", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, letterSpacing: "0.12em", fontSize: 12, color: "#FFCDD8", textTransform: "uppercase" }}>ABANOTEASSISTANT</span>
        <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: 600 }}>
          {["Dashboard", "Clients", "Notes", "Admin"].map((t, i) => (
            <span key={t} style={{ color: i === 1 ? "#FFCDD8" : "rgba(255,220,230,0.65)", borderBottom: i === 1 ? "2px solid #FFCDD8" : "none", paddingBottom: 2 }}>{t}</span>
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.3)" }}>JD</div>
      </div>

      {/* Hero — same deep rose, larger */}
      <div style={{ background: "linear-gradient(160deg, #7A3545 0%, #A0485A 100%)", padding: "30px 24px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 80, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative" }}>
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,220,228,0.7)", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Clients</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "6px 0 4px" }}>Your Caseload</h1>
            <p style={{ fontSize: 13, color: "rgba(255,220,228,0.8)", margin: 0 }}>4 active clients · 3 assessments on file</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ padding: "9px 16px", background: "rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>Filter</div>
            <div style={{ padding: "9px 18px", background: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#7A3545", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>+ New Client</div>
          </div>
        </div>
      </div>

      {/* Scallop transition */}
      <div style={{ background: "#7A3545", height: 0, overflow: "visible", position: "relative", zIndex: 1 }}>
        <svg viewBox="0 0 1440 40" style={{ display: "block", marginTop: -1, background: "transparent" }}>
          <path d="M0,0 Q360,40 720,0 Q1080,40 1440,0 L1440,40 L0,40 Z" fill="#FDFAF7" />
        </svg>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 900, margin: "-8px auto 0", padding: "0 24px 16px" }}>
        <div style={{ background: "#fff", border: "1.5px solid #F0E4E1", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, color: "#B08880", fontSize: 13, boxShadow: "0 2px 8px rgba(194,122,138,0.08)" }}>
          🔍 <span>Search clients…</span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {clients.map(c => {
          const s = statusConfig[c.status];
          return (
            <div key={c.id} style={{ background: "#fff", border: "1.5px solid #F0E4E1", borderRadius: 18, padding: 20, boxShadow: "0 2px 12px rgba(122,53,69,0.06)", transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#7A3545,#C27A8A)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#fff", flexShrink: 0 }}>{c.initials}</div>
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
                    <span key={b} style={{ background: "#FFF1F4", color: "#7A3545", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, border: "1px solid #FFD5DC" }}>{b}</span>
                  ))}
                </div>
              )}
              {c.programs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#9A7A70", marginRight: 4 }}>Programs:</span>
                  {c.programs.map(p => (
                    <span key={p} style={{ background: "#F0E4E1", color: "#5C3D35", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{p}</span>
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

      <div style={{ textAlign: "center", padding: "8px 0 24px", fontSize: 12, color: "#A08070", fontWeight: 600 }}>Option B — Deep Rose Header · Strong top contrast, white card zone below</div>
    </div>
  );
}
