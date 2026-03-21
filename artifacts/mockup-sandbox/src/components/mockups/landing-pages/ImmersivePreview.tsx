import { useState, useEffect } from "react";

const NOTE_TEXT = `Client demonstrated 87% mastery on color identification (21/24 trials). Manding program advanced to gestural prompting — 79% accuracy. One brief task avoidance episode (22 sec) successfully redirected. Rapport excellent. Recommend advancing color ID to independent criterion next session.`;

const FEATURES = [
  { icon: "⚡", label: "AI Note Generation", desc: "Complete clinical notes from session inputs" },
  { icon: "👶", label: "Client Profiles", desc: "Full history, diagnosis, and goals per child" },
  { icon: "📋", label: "Session Wizard", desc: "7-step guided workflow, every time" },
  { icon: "📁", label: "Note Archive", desc: "Searchable session history, always accessible" },
];

const DEMO_STEPS = [
  { icon: "👶", label: "Select client", detail: "Marcus T. — Age 6 · ASD" },
  { icon: "📅", label: "Session date", detail: "March 21, 2026 · 60 min" },
  { icon: "📊", label: "Log targets", detail: "Color ID 87% · Manding 79%" },
  { icon: "⚡", label: "Generate note", detail: "AI writes in seconds" },
];

export function ImmersivePreview() {
  const [noteChars, setNoteChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);
  const [demoStep, setDemoStep] = useState(-1);

  const startDemo = () => {
    if (started) return;
    setStarted(true);
    setDemoStep(0);
    let step = 0;
    const stepInterval = setInterval(() => {
      step++;
      setDemoStep(step);
      if (step === 3) {
        clearInterval(stepInterval);
        setTimeout(() => {
          setIsTyping(true);
          setNoteChars(0);
          let i = 0;
          const t = setInterval(() => {
            i += 5;
            setNoteChars(Math.min(i, NOTE_TEXT.length));
            if (i >= NOTE_TEXT.length) { clearInterval(t); setIsTyping(false); }
          }, 22);
        }, 600);
      }
    }, 800);
  };

  useEffect(() => {
    const timer = setTimeout(() => startDemo(), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#1A1014" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 30px rgba(194,122,138,0.3),0 0 60px rgba(194,122,138,0.15)} 50%{box-shadow:0 0 40px rgba(194,122,138,0.5),0 0 80px rgba(194,122,138,0.25)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes stepSlide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes particleDrift { 0%,100%{transform:translate(0,0);opacity:0.3} 50%{transform:translate(var(--dx),var(--dy));opacity:0.7} }
        @keyframes ringExpand { from{transform:scale(0.9);opacity:0.8} to{transform:scale(1.4);opacity:0} }
      `}</style>

      {/* Background glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle,rgba(194,122,138,0.15) 0%,transparent 70%)", top: "-10%", right: "10%", animation: "float 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 300, height: 300, background: "radial-gradient(circle,rgba(181,160,212,0.1) 0%,transparent 70%)", bottom: "20%", left: "5%", animation: "float 10s ease-in-out 2s infinite" }} />
      </div>

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-10 py-5" style={{ borderBottom: "1px solid rgba(240,228,225,0.1)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)", boxShadow: "0 4px 12px rgba(194,122,138,0.5)" }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" /></svg>
          </div>
          <span className="font-extrabold text-xs tracking-widest uppercase" style={{ color: "white", letterSpacing: "0.18em" }}>ABANOTEASSISTANT</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Sign In</button>
          <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 16px rgba(194,122,138,0.5)" }}>Get Started Free</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 text-center px-10 pt-14 pb-10" style={{ animation: "fadeUp 0.7s ease-out both" }}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: "rgba(194,122,138,0.15)", border: "1px solid rgba(194,122,138,0.3)" }}>
          <span style={{ fontSize: 12, color: "#E8B4B8", fontWeight: 700 }}>✦ Clinical notes, handled by AI</span>
        </div>
        <h1 className="text-6xl font-extrabold mb-5" style={{ color: "white", lineHeight: 1.1 }}>
          Write better notes<br />
          <span style={{ background: "linear-gradient(135deg,#E8B4B8,#C27A8A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            10× faster.
          </span>
        </h1>
        <p className="text-base mx-auto mb-10" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 460, lineHeight: 1.7 }}>
          Your sessions are full enough. Let AI handle the documentation. ABANOTEASSISTANT generates complete clinical notes from your session data — in seconds.
        </p>

        {/* Interactive demo */}
        <div className="mx-auto max-w-3xl rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", border: "1px solid rgba(240,228,225,0.12)", boxShadow: "0 24px 80px rgba(194,122,138,0.2), 0 4px 20px rgba(0,0,0,0.3)", animation: "glow 4s ease-in-out infinite" }}>
          {/* Chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["#FF5F56","#FFBD2E","#27C93F"].map((c,i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
            <div className="flex-1 mx-4 px-3 py-1 rounded-md text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
              abanoteassistant.app/wizard
            </div>
          </div>

          <div className="p-7">
            {/* Demo steps */}
            <div className="flex items-center gap-3 mb-6">
              {DEMO_STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                    style={{
                      background: i <= demoStep ? "rgba(194,122,138,0.2)" : "rgba(255,255,255,0.05)",
                      border: i <= demoStep ? "1px solid rgba(194,122,138,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      animation: i === demoStep ? "stepSlide 0.4s ease-out both" : "none",
                    }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: i <= demoStep ? "#E8B4B8" : "rgba(255,255,255,0.3)" }}>{s.label}</p>
                      {i <= demoStep && <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.detail}</p>}
                    </div>
                    {i < demoStep && <span style={{ color: "#7DC4A0", fontSize: 12 }}>✓</span>}
                  </div>
                  {i < DEMO_STEPS.length - 1 && (
                    <div className="w-5 h-px" style={{ background: i < demoStep ? "rgba(194,122,138,0.5)" : "rgba(255,255,255,0.1)" }} />
                  )}
                </div>
              ))}
            </div>

            {/* Note output */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 120 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Generated Clinical Note</p>
                {isTyping && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(194,122,138,0.2)", color: "#E8B4B8", animation: "shimmer 1s ease-in-out infinite" }}>✦ Writing...</span>
                )}
                {!isTyping && noteChars >= NOTE_TEXT.length && (
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1 rounded-lg font-bold" style={{ background: "rgba(194,122,138,0.2)", color: "#E8B4B8" }}>Copy</button>
                    <button className="text-xs px-3 py-1 rounded-lg font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", color: "white" }}>Save</button>
                  </div>
                )}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: noteChars > 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.15)", fontStyle: noteChars === 0 ? "italic" : "normal", lineHeight: 1.75 }}>
                {noteChars === 0 ? "Your note will appear here..." : NOTE_TEXT.slice(0, noteChars)}
                {isTyping && <span style={{ borderRight: "2px solid #C27A8A", animation: "blink 0.7s ease-in-out infinite" }}>&nbsp;</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="relative z-10 px-10 py-14 max-w-5xl mx-auto">
        <div className="grid grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(240,228,225,0.1)" }}>
              <div className="text-2xl mb-3">{f.icon}</div>
              <p className="font-bold text-sm mb-1.5" style={{ color: "white" }}>{f.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 text-center px-10 pb-16">
        <div className="inline-block rounded-3xl px-12 py-10" style={{ background: "rgba(194,122,138,0.1)", border: "1px solid rgba(194,122,138,0.25)" }}>
          <p className="text-2xl font-extrabold text-white mb-2">Stop writing at midnight.</p>
          <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.4)" }}>Your kids need a rested, present therapist. Let AI handle the notes.</p>
          <button className="px-8 py-4 rounded-xl text-white font-bold text-sm" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 8px 28px rgba(194,122,138,0.5)" }}>
            Get Started — It's Free
          </button>
        </div>
      </div>
    </div>
  );
}
