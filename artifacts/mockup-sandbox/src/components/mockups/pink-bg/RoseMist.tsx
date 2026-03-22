export default function RoseMist() {
  const BG = "#FDE8EE";
  const SIDEBAR = "#C27A8A";
  const CARD_BG = "#FFFFFF";
  const BORDER = "#E8D8D3";
  const TEXT = "#2D2523";
  const MUTED = "#877870";
  const ROSE = "#C27A8A";

  const clients = [
    { initials: "JM", name: "Jamie Martinez", age: "6–9 yrs", behaviors: ["Aggression", "Self-Injury"], programs: ["PECS", "Token Economy"], status: "ready" },
    { initials: "AL", name: "Avery Lee", age: "4–6 yrs", behaviors: ["Elopement"], programs: ["First-Then Board"], status: "pending" },
    { initials: "RS", name: "Riley Smith", age: "9–12 yrs", behaviors: ["Tantrums", "Hitting"], programs: ["Social Stories", "DTT"], status: "ready" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", background: BG }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: SIDEBAR, display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 28px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>ABANoteAssistant</div>
        </div>
        {["Dashboard", "Clients", "Notes", "Admin"].map((item, i) => (
          <div key={item} style={{
            padding: "12px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: i === 1 ? "rgba(0,0,0,0.15)" : "transparent",
            borderLeft: i === 1 ? "3px solid #fff" : "3px solid transparent",
            marginTop: i === 0 ? 8 : 0,
          }}>{item}</div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, background: BG, overflowY: "auto", padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>Clients</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>3 active clients</div>
          </div>
          <button style={{ background: ROSE, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ New Client</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {clients.map((c) => (
            <div key={c.name} style={{
              background: CARD_BG, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 22,
              boxShadow: "0 4px 20px -4px rgba(44,37,35,0.12), 0 1px 3px rgba(44,37,35,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F9EEF1", display: "flex", alignItems: "center", justifyContent: "center", color: ROSE, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{c.initials}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{c.age}</div>
                </div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, marginBottom: 14, background: c.status === "ready" ? "#F0FDF4" : "#FFFBEB", color: c.status === "ready" ? "#15803D" : "#B45309", border: `1px solid ${c.status === "ready" ? "#BBF7D0" : "#FDE68A"}` }}>
                {c.status === "ready" ? "✓ Assessment complete" : "⚠ Assessment pending"}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Behaviors: <span style={{ color: TEXT }}>{c.behaviors.join(", ")}</span></div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Programs: <span style={{ color: TEXT }}>{c.programs.join(", ")}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BORDER}`, paddingTop: 14, gap: 8 }}>
                <span style={{ fontSize: 11, color: MUTED }}>DOB: 2017-03-12</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD_BG, color: MUTED, cursor: "pointer" }}>View</button>
                  <button style={{ fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 8, border: `1px solid ${ROSE}`, background: CARD_BG, color: ROSE, cursor: "pointer" }}>Add Note</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
