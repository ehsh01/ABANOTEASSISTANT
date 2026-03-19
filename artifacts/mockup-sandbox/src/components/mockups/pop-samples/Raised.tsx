import { Sparkles, ChevronRight, Clock, ShieldCheck, FileCheck2, Zap, Pencil, Star } from "lucide-react";

const textPopLight = {
  textShadow: "0 1px 0 rgba(255,255,255,0.9), 0 3px 12px rgba(194,122,138,0.4), 0 2px 4px rgba(0,0,0,0.12)",
} as React.CSSProperties;

const textPopWhiteLight = {
  textShadow: "0 3px 18px rgba(110,25,45,0.35), 0 1px 5px rgba(0,0,0,0.15)",
} as React.CSSProperties;

const iconPopLight = {
  filter: "drop-shadow(0 4px 8px rgba(194,122,138,0.55)) drop-shadow(0 2px 3px rgba(0,0,0,0.12))",
} as React.CSSProperties;

const iconPopWhiteLight = {
  filter: "drop-shadow(0 4px 10px rgba(100,20,40,0.4)) drop-shadow(0 2px 3px rgba(0,0,0,0.15))",
} as React.CSSProperties;

export function Raised() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FDFAF7", minHeight: "100vh" }}>
      {/* Label */}
      <div style={{ background: "#2D2523", color: "#FDFAF7", padding: "6px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Option A — Raised · Noticeable but tasteful
      </div>

      {/* Nav */}
      <nav style={{ background: "white", borderBottom: "1px solid #F0E4E1", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(194,122,138,0.25)" }}>
            <Sparkles style={{ width: 16, height: 16, color: "white", ...iconPopWhiteLight }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", color: "#2D2523", ...textPopLight }}>ABANOTEASSISTANT</span>
        </div>
        <button style={{ background: "#C27A8A", color: "white", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 20px rgba(194,122,138,0.3)" }}>
          New Note <ChevronRight style={{ width: 16, height: 16, ...iconPopWhiteLight }} />
        </button>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #C27A8A 0%, #d4849a 40%, #b06a79 100%)", padding: "48px 32px 40px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", marginBottom: 20 }}>
          <Zap style={{ width: 14, height: 14, color: "#FCEEF1", ...iconPopWhiteLight }} />
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600, ...textPopWhiteLight }}>AI-Powered Documentation</span>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 800, color: "white", marginBottom: 16, lineHeight: 1.1, ...textPopWhiteLight }}>
          Your notes,{" "}
          <span style={{ color: "#FCEEF1" }}>written in seconds.</span>
        </h1>
        <p style={{ fontSize: 16, color: "rgba(253,250,247,0.88)", maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.6, ...textPopWhiteLight }}>
          Guide through a smart checklist and receive complete, professional ABA session notes.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 28, color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
          {[["Clock", Clock, "15 min saved"], ["ShieldCheck", ShieldCheck, "Compliant notes"], ["FileCheck2", FileCheck2, "5,000+ notes"]].map(([, Icon, label]) => (
            <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon style={{ width: 18, height: 18, color: "#FCEEF1", ...iconPopWhiteLight }} />
              <span style={{ ...textPopWhiteLight }}>{label as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card sample */}
      <div style={{ padding: "28px 32px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2D2523", fontWeight: 700, marginBottom: 4, ...textPopLight }}>Session Notes</h2>
        <p style={{ color: "#877870", fontSize: 13, marginBottom: 20 }}>5 total notes</p>
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #F0E4E1", overflow: "hidden" }}>
          {[["Jayden B.", "Final", "97153", "RBT"], ["James R.", "Draft", "97155", "BCBA"]].map(([name, status, code, type]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 20px", borderBottom: "1px solid #F0E4E1" }}>
              <span style={{ color: "#C27A8A", fontWeight: 600, fontSize: 14, minWidth: 100, ...textPopLight }}>{name}</span>
              <span style={{ background: status === "Final" ? "#ecfdf5" : "#fffbeb", color: status === "Final" ? "#065f46" : "#92400e", border: `1px solid ${status === "Final" ? "#a7f3d0" : "#fde68a"}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, ...textPopLight }}>{status}</span>
              <span style={{ background: "#FDFAF7", border: "1px solid #F0E4E1", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#2D2523", ...textPopLight }}>{type}</span>
              <span style={{ fontWeight: 700, color: "#2D2523", fontSize: 14, ...textPopLight }}>{code}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <Pencil style={{ width: 16, height: 16, color: "#877870", ...iconPopLight }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
