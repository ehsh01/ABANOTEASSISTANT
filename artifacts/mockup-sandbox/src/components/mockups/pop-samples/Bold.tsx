import { Sparkles, ChevronRight, Clock, ShieldCheck, FileCheck2, Zap, Pencil, Star } from "lucide-react";

const textPopBold = {
  textShadow: "0 1px 0 rgba(255,255,255,0.98), 0 -1px 0 rgba(180,100,115,0.2), 0 5px 22px rgba(194,122,138,0.65), 0 3px 7px rgba(0,0,0,0.2)",
} as React.CSSProperties;

const textPopWhiteBold = {
  textShadow: "0 0 2px rgba(255,255,255,0.2), 0 4px 24px rgba(100,20,40,0.55), 0 2px 6px rgba(0,0,0,0.25)",
} as React.CSSProperties;

const iconPopBold = {
  filter: "drop-shadow(0 6px 14px rgba(194,122,138,0.7)) drop-shadow(0 3px 4px rgba(0,0,0,0.2))",
} as React.CSSProperties;

const iconPopWhiteBold = {
  filter: "drop-shadow(0 6px 18px rgba(80,10,30,0.55)) drop-shadow(0 3px 5px rgba(0,0,0,0.25))",
} as React.CSSProperties;

export function Bold() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FDFAF7", minHeight: "100vh" }}>
      {/* Label */}
      <div style={{ background: "#C27A8A", color: "white", padding: "6px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
        Option B — Bold · Very dramatic, strong 3D depth
      </div>

      {/* Nav */}
      <nav style={{ background: "white", borderBottom: "1px solid #F0E4E1", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(194,122,138,0.4)" }}>
            <Sparkles style={{ width: 16, height: 16, color: "white", ...iconPopWhiteBold }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", color: "#2D2523", ...textPopBold }}>ABANOTEASSISTANT</span>
        </div>
        <button style={{ background: "#C27A8A", color: "white", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 10px 28px rgba(194,122,138,0.45)" }}>
          New Note <ChevronRight style={{ width: 16, height: 16, ...iconPopWhiteBold }} />
        </button>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #C27A8A 0%, #d4849a 40%, #b06a79 100%)", padding: "48px 32px 40px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", marginBottom: 20 }}>
          <Zap style={{ width: 14, height: 14, color: "#FCEEF1", ...iconPopWhiteBold }} />
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600, ...textPopWhiteBold }}>AI-Powered Documentation</span>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 800, color: "white", marginBottom: 16, lineHeight: 1.1, ...textPopWhiteBold }}>
          Your notes,{" "}
          <span style={{ color: "#FCEEF1" }}>written in seconds.</span>
        </h1>
        <p style={{ fontSize: 16, color: "rgba(253,250,247,0.88)", maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.6, ...textPopWhiteBold }}>
          Guide through a smart checklist and receive complete, professional ABA session notes.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 28, color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
          {[["Clock", Clock, "15 min saved"], ["ShieldCheck", ShieldCheck, "Compliant notes"], ["FileCheck2", FileCheck2, "5,000+ notes"]].map(([, Icon, label]) => (
            <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon style={{ width: 18, height: 18, color: "#FCEEF1", ...iconPopWhiteBold }} />
              <span style={{ ...textPopWhiteBold }}>{label as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card sample */}
      <div style={{ padding: "28px 32px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2D2523", fontWeight: 700, marginBottom: 4, ...textPopBold }}>Session Notes</h2>
        <p style={{ color: "#877870", fontSize: 13, marginBottom: 20 }}>5 total notes</p>
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #F0E4E1", overflow: "hidden", boxShadow: "0 4px 20px rgba(194,122,138,0.1)" }}>
          {[["Jayden B.", "Final", "97153", "RBT"], ["James R.", "Draft", "97155", "BCBA"]].map(([name, status, code, type]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 20px", borderBottom: "1px solid #F0E4E1" }}>
              <span style={{ color: "#C27A8A", fontWeight: 600, fontSize: 14, minWidth: 100, ...textPopBold }}>{name}</span>
              <span style={{ background: status === "Final" ? "#ecfdf5" : "#fffbeb", color: status === "Final" ? "#065f46" : "#92400e", border: `1px solid ${status === "Final" ? "#a7f3d0" : "#fde68a"}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, ...textPopBold }}>{status}</span>
              <span style={{ background: "#FDFAF7", border: "1px solid #F0E4E1", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#2D2523", ...textPopBold }}>{type}</span>
              <span style={{ fontWeight: 700, color: "#2D2523", fontSize: 14, ...textPopBold }}>{code}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <Pencil style={{ width: 16, height: 16, color: "#877870", ...iconPopBold }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
