import { Sparkles, ChevronRight, Clock, ShieldCheck, FileCheck2, Zap, Pencil } from "lucide-react";

const textPopMax = {
  textShadow: "0 1px 0 rgba(255,255,255,1), 0 -1px 0 rgba(160,80,100,0.35), 0 2px 0 rgba(194,122,138,0.4), 0 8px 30px rgba(194,122,138,0.8), 0 4px 8px rgba(0,0,0,0.28)",
} as React.CSSProperties;

const textPopWhiteMax = {
  textShadow: "0 0 1px rgba(255,255,255,0.4), 0 1px 0 rgba(255,255,255,0.15), 0 5px 30px rgba(80,10,30,0.75), 0 3px 8px rgba(0,0,0,0.35)",
} as React.CSSProperties;

const iconPopMax = {
  filter: "drop-shadow(0 0 10px rgba(194,122,138,0.9)) drop-shadow(0 8px 16px rgba(150,60,80,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
} as React.CSSProperties;

const iconPopWhiteMax = {
  filter: "drop-shadow(0 0 12px rgba(255,220,230,0.95)) drop-shadow(0 8px 20px rgba(70,5,25,0.65)) drop-shadow(0 3px 5px rgba(0,0,0,0.3))",
} as React.CSSProperties;

export function Cinematic() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FDFAF7", minHeight: "100vh" }}>
      {/* Label */}
      <div style={{ background: "#2D2523", color: "#e6b3c0", padding: "6px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 0 12px rgba(194,122,138,0.8)" }}>
        Option C — Cinematic · Maximum impact, glowing depth
      </div>

      {/* Nav */}
      <nav style={{ background: "white", borderBottom: "1px solid #F0E4E1", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(194,122,138,0.6), 0 0 0 3px rgba(194,122,138,0.15)" }}>
            <Sparkles style={{ width: 16, height: 16, color: "white", ...iconPopWhiteMax }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", color: "#2D2523", ...textPopMax }}>ABANOTEASSISTANT</span>
        </div>
        <button style={{ background: "linear-gradient(135deg, #C27A8A, #b06a79)", color: "white", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 12px 32px rgba(194,122,138,0.6), 0 0 0 2px rgba(194,122,138,0.2)" }}>
          New Note <ChevronRight style={{ width: 16, height: 16, ...iconPopWhiteMax }} />
        </button>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #C27A8A 0%, #d4849a 40%, #b06a79 100%)", padding: "48px 32px 40px", textAlign: "center", position: "relative" }}>
        {/* Glow orb */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 200, background: "radial-gradient(ellipse, rgba(255,200,215,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", marginBottom: 20, position: "relative" }}>
          <Zap style={{ width: 14, height: 14, color: "#FCEEF1", ...iconPopWhiteMax }} />
          <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 13, fontWeight: 600, ...textPopWhiteMax }}>AI-Powered Documentation</span>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 800, color: "white", marginBottom: 16, lineHeight: 1.1, position: "relative", ...textPopWhiteMax }}>
          Your notes,{" "}
          <span style={{ color: "#FCEEF1" }}>written in seconds.</span>
        </h1>
        <p style={{ fontSize: 16, color: "rgba(253,250,247,0.9)", maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.6, position: "relative", ...textPopWhiteMax }}>
          Guide through a smart checklist and receive complete, professional ABA session notes.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 28, color: "rgba(255,255,255,0.9)", fontSize: 13, position: "relative" }}>
          {[["Clock", Clock, "15 min saved"], ["ShieldCheck", ShieldCheck, "Compliant notes"], ["FileCheck2", FileCheck2, "5,000+ notes"]].map(([, Icon, label]) => (
            <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon style={{ width: 18, height: 18, color: "#FCEEF1", ...iconPopWhiteMax }} />
              <span style={{ ...textPopWhiteMax }}>{label as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card sample */}
      <div style={{ padding: "28px 32px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2D2523", fontWeight: 700, marginBottom: 4, ...textPopMax }}>Session Notes</h2>
        <p style={{ color: "#877870", fontSize: 13, marginBottom: 20 }}>5 total notes</p>
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #F0E4E1", overflow: "hidden", boxShadow: "0 8px 32px rgba(194,122,138,0.18), 0 2px 8px rgba(0,0,0,0.06)" }}>
          {[["Jayden B.", "Final", "97153", "RBT"], ["James R.", "Draft", "97155", "BCBA"]].map(([name, status, code, type]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 20px", borderBottom: "1px solid #F0E4E1" }}>
              <span style={{ color: "#C27A8A", fontWeight: 600, fontSize: 14, minWidth: 100, ...textPopMax }}>{name}</span>
              <span style={{ background: status === "Final" ? "#ecfdf5" : "#fffbeb", color: status === "Final" ? "#065f46" : "#92400e", border: `1px solid ${status === "Final" ? "#a7f3d0" : "#fde68a"}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, ...textPopMax }}>{status}</span>
              <span style={{ background: "#FDFAF7", border: "1px solid #F0E4E1", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#2D2523", ...textPopMax }}>{type}</span>
              <span style={{ fontWeight: 700, color: "#2D2523", fontSize: 14, ...textPopMax }}>{code}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <Pencil style={{ width: 16, height: 16, color: "#877870", ...iconPopMax }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
