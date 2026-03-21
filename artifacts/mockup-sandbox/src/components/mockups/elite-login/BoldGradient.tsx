import { useState, useEffect } from "react";

const NOTE = `Client participated in a 60-min ABA session. DTT conducted across color identification (87%, 21/24 trials), shape matching (64%, 16/25 trials), and manding via PECS (79%, 11/14). Gestural prompting faded on color ID. One episode of task refusal (22 sec) — redirected effectively. No SIB observed. Recommend advancing color ID to independent criterion.`;

const WORDS = ["session notes", "clinical docs", "SOAP notes", "progress notes", "session records"];

export function BoldGradient() {
  const [wordIdx, setWordIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [typing, setTyping] = useState(false);
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    const wv = setInterval(() => setWordIdx(i => (i + 1) % WORDS.length), 2400);
    return () => clearInterval(wv);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setShowNote(true);
      setTyping(true);
      setChars(0);
      let i = 0;
      const iv = setInterval(() => {
        i += 6;
        setChars(Math.min(i, NOTE.length));
        if (i >= NOTE.length) { clearInterval(iv); setTyping(false); }
      }, 22);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto relative" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
        .bg-gradient-mesh {
          background: linear-gradient(135deg, #F8EBF0 0%, #FDF7F3 30%, #F3EBF8 55%, #FDE8EE 80%, #F6F0FC 100%);
          background-size: 300% 300%;
          animation: gradientShift 10s ease-in-out infinite;
        }
        @keyframes gradientShift { 0%,100%{background-position:0% 0%} 33%{background-position:100% 0%} 66%{background-position:50% 100%} }
        @keyframes wordFlip { 0%{opacity:0;transform:translateY(6px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-6px)} }
        @keyframes floatCard { 0%,100%{transform:translateY(0) rotate(0.5deg)} 50%{transform:translateY(-8px) rotate(0.5deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes badge { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.05)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(0.95)} }
      `}</style>

      {/* Mesh gradient background */}
      <div className="bg-gradient-mesh fixed inset-0" style={{ zIndex: 0 }} />

      {/* Decorative orbs */}
      <div className="fixed pointer-events-none" style={{ zIndex: 1, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(194,122,138,0.14) 0%,transparent 70%)", top: "-200px", right: "-100px", animation: "orb1 12s ease-in-out infinite" }} />
      <div className="fixed pointer-events-none" style={{ zIndex: 1, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(181,160,212,0.12) 0%,transparent 70%)", bottom: "-100px", left: "-150px", animation: "orb2 15s ease-in-out infinite" }} />
      <div className="fixed pointer-events-none" style={{ zIndex: 1, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(142,168,216,0.1) 0%,transparent 70%)", top: "40%", left: "20%", animation: "orb1 9s ease-in-out 3s infinite" }} />

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-12 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)", boxShadow: "0 4px 14px rgba(194,122,138,0.4)" }}>
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" />
            </svg>
          </div>
          <span className="font-extrabold tracking-widest text-xs uppercase" style={{ color: "#2D2523", letterSpacing: "0.2em" }}>ABANOTEASSISTANT</span>
        </div>
        <div className="flex items-center gap-3">
          <button style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#877870", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(240,228,225,0.8)", cursor: "pointer" }}>Sign In</button>
          <button style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "white", background: "linear-gradient(135deg,#C87585,#A85870)", boxShadow: "0 4px 16px rgba(194,100,130,0.4)", cursor: "pointer" }}>Get Started</button>
        </div>
      </nav>

      {/* Main content — 2 column */}
      <div className="relative z-10 flex items-center gap-16 px-12 pt-6 pb-14 max-w-6xl mx-auto">

        {/* Left — Hero text + form */}
        <div className="flex-1 min-w-0">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(194,122,138,0.25)", animation: "badge 0.6s ease-out both" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C27A8A", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#C27A8A", fontWeight: 700 }}>Designed for ABA therapists</span>
          </div>

          {/* Big headline */}
          <h1 style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.05, color: "#2D2523", letterSpacing: "-0.03em", marginBottom: 20, animation: "fadeUp 0.7s ease-out 0.1s both" }}>
            Your{" "}
            <span key={wordIdx} style={{
              display: "inline-block",
              background: "linear-gradient(135deg,#C87585,#8A4060)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "wordFlip 2.4s ease-in-out both",
            }}>
              {WORDS[wordIdx]}
            </span>
            <br />
            written in 30 sec.
          </h1>

          <p style={{ fontSize: 16, color: "#877870", lineHeight: 1.75, maxWidth: 440, marginBottom: 40, animation: "fadeUp 0.7s ease-out 0.2s both" }}>
            Stop spending your evenings on documentation. Walk through your session, and ABANOTEASSISTANT generates a complete, accurate clinical note — instantly.
          </p>

          {/* Inline login form */}
          <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", border: "1px solid rgba(240,228,225,0.9)", boxShadow: "0 8px 40px rgba(45,37,35,0.08)", animation: "fadeUp 0.7s ease-out 0.3s both", maxWidth: 420 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#2D2523", marginBottom: 16 }}>Sign in to your account</p>
            <div style={{ marginBottom: 10 }}>
              <input className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" placeholder="Email address"
                style={{ background: "white", border: "1.5px solid #EDE0DC", color: "#2D2523", fontFamily: "inherit", display: "block", width: "100%", boxSizing: "border-box", boxShadow: "0 1px 3px rgba(45,37,35,0.04)" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <input type="password" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" placeholder="Password"
                style={{ background: "white", border: "1.5px solid #EDE0DC", color: "#2D2523", fontFamily: "inherit", display: "block", width: "100%", boxSizing: "border-box", boxShadow: "0 1px 3px rgba(45,37,35,0.04)" }} />
            </div>
            <button style={{ width: "100%", padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,#C87585,#A85870)", color: "white", fontWeight: 700, fontSize: 14, marginBottom: 12, boxShadow: "0 6px 20px rgba(194,100,120,0.4)", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Sign In
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "#877870" }}>
              New here?{" "}
              <span style={{ color: "#C27A8A", fontWeight: 700, cursor: "pointer" }}>Create a free account →</span>
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 mt-8" style={{ animation: "fadeUp 0.7s ease-out 0.4s both" }}>
            {[["500+", "Therapists"], ["12K+", "Notes generated"], ["30s", "Avg generation time"]].map(([val, label]) => (
              <div key={label}>
                <p style={{ fontSize: 22, fontWeight: 900, color: "#2D2523", lineHeight: 1 }}>{val}</p>
                <p style={{ fontSize: 11, color: "#C4B0AC", marginTop: 3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Live product preview */}
        <div className="flex-shrink-0 w-[430px]" style={{ animation: "floatCard 7s ease-in-out infinite" }}>
          <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 32px 80px rgba(45,37,35,0.18), 0 4px 20px rgba(194,122,138,0.15)", border: "1px solid rgba(240,228,225,0.8)" }}>
            {/* Chrome */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#2D2523" }}>
              {["#FF5F56","#FFBD2E","#27C93F"].map((c,i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              <div className="flex-1 mx-3 px-3 py-1 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                abanoteassistant.app
              </div>
            </div>

            {/* Content */}
            <div style={{ background: "#FDFAF7", padding: "20px" }}>
              {/* Client row */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "white", border: "1px solid #F0E4E1" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)" }}>MT</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#2D2523" }}>Marcus T. · Age 6</p>
                  <p style={{ fontSize: 11, color: "#877870" }}>Session #15 · 60 min · ASD</p>
                </div>
                <div className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: typing || showNote ? "#FCEEF1" : "#F0E4E1", color: typing || showNote ? "#C27A8A" : "#877870" }}>
                  {typing ? "✦ AI writing" : showNote && chars >= NOTE.length ? "✓ Done" : "Ready"}
                </div>
              </div>

              {/* Note area */}
              <div style={{ background: "white", border: "1.5px solid #F0E4E1", borderRadius: 14, padding: 16, minHeight: 160 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#877870", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  Generated Clinical Note
                </p>
                <p style={{ fontSize: 12, lineHeight: 1.85, color: showNote ? "#2D2523" : "#D4A5B0", fontStyle: showNote ? "normal" : "italic" }}>
                  {showNote ? NOTE.slice(0, chars) : "Waiting to generate..."}
                  {typing && <span style={{ borderRight: "2px solid #C27A8A", marginLeft: 1, animation: "blink 0.7s ease-in-out infinite" }}>&nbsp;</span>}
                </p>
              </div>

              {/* Actions */}
              {!typing && chars >= NOTE.length && (
                <div className="flex gap-2 mt-3" style={{ animation: "fadeIn 0.5s ease-out both" }}>
                  <button style={{ flex: 1, padding: "8px", borderRadius: 10, background: "#F0E4E1", color: "#877870", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    Copy note
                  </button>
                  <button style={{ flex: 1, padding: "8px", borderRadius: 10, background: "linear-gradient(135deg,#C87585,#C27A8A)", color: "white", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    Save to file ✓
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {["⚡ AI note generation", "👶 Client profiles", "📋 Session wizard", "🔒 Secure"].map((f, i) => (
              <span key={f} className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", color: "#877870", border: "1px solid rgba(240,228,225,0.9)", animation: `badge 0.4s ease-out ${0.4 + i * 0.08}s both` }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
