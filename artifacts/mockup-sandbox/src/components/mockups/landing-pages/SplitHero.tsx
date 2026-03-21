import { useState, useEffect } from "react";

const NOTE_TEXT = `Marcus completed 24 discrete trials across color identification and manding programs. Demonstrated 87% accuracy on color ID (21/24), up from 72% last session. Manding achieved 79% accuracy with hand-over-hand prompting faded to gestural. One episode of task avoidance (22 sec) — redirected successfully using preferred item. Rapport excellent throughout. Recommend advancing to independent level on color ID next session.`;

const FEATURES = [
  { icon: "⚡", title: "Auto-Generate Notes", desc: "AI writes your full session note from a few inputs. No blank page, no re-typing." },
  { icon: "👶", title: "Client Profiles", desc: "Store DOB, diagnosis, and session history for every child you work with." },
  { icon: "📋", title: "Session Wizard", desc: "Guided 7-step workflow captures targets, behaviors, and outcomes consistently." },
  { icon: "📁", title: "Note History", desc: "Every note saved, searchable, and ready to copy into your clinic's system." },
];

const STEPS = ["Client", "Session Date", "Goals & Targets", "Behaviors", "Generate"];
const WIZARD_CONTENT = [
  { label: "Client", value: "Marcus T., age 6 · Autism Spectrum Disorder" },
  { label: "Session Date", value: "March 21, 2026 · 60 min" },
  { label: "Goals", value: "Color ID (87%) · Manding (79%) · Shape Match" },
  { label: "Behaviors", value: "1× task avoidance · 22 sec · redirected" },
];

export function SplitHero() {
  const [wizardStep, setWizardStep] = useState(0);
  const [noteChars, setNoteChars] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setWizardStep(s => (s + 1) % STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (wizardStep === STEPS.length - 1) {
      setNoteChars(0);
      setGenerating(true);
      let i = 0;
      const t = setInterval(() => {
        i += 4;
        setNoteChars(i);
        if (i >= NOTE_TEXT.length) { clearInterval(t); setGenerating(false); }
      }, 28);
      return () => clearInterval(t);
    }
  }, [wizardStep]);

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: "#FDFAF7", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes stepIn { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes floatApp { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(-1deg)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes progressBar { from{width:0} to{width:58%} }
        @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
      `}</style>

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-10 py-4" style={{ background: "rgba(253,250,247,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid #F0E4E1" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)", boxShadow: "0 4px 10px rgba(194,122,138,0.3)" }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" /></svg>
          </div>
          <span className="font-extrabold text-xs tracking-widest uppercase" style={{ color: "#2D2523", letterSpacing: "0.18em" }}>ABANOTEASSISTANT</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: "#877870" }}>Sign In</button>
          <button className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 12px rgba(194,122,138,0.35)" }}>Get Started Free</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="grid grid-cols-2 gap-12 px-10 pt-14 pb-16 max-w-6xl mx-auto items-center">
        {/* Left */}
        <div style={{ animation: "fadeUp 0.7s ease-out both" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ background: "#FCEEF1", border: "1px solid #F0E4E1" }}>
            <span style={{ fontSize: 12, color: "#C27A8A", fontWeight: 700 }}>✦ Built for ABA therapists</span>
          </div>
          <h1 className="text-5xl font-extrabold leading-tight mb-5" style={{ color: "#2D2523" }}>
            Session notes<br />
            <span style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              written in seconds.
            </span>
          </h1>
          <p className="text-lg mb-8 leading-relaxed" style={{ color: "#877870" }}>
            Stop spending your evenings on paperwork. ABANOTEASSISTANT takes your session inputs and generates complete, accurate clinical notes instantly.
          </p>
          <div className="flex gap-3">
            <button className="px-6 py-3.5 rounded-xl text-white font-bold text-sm" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 6px 20px rgba(194,122,138,0.4)" }}>
              Start Free Today
            </button>
            <button className="px-6 py-3.5 rounded-xl font-semibold text-sm" style={{ border: "1.5px solid #F0E4E1", color: "#877870" }}>
              Sign In →
            </button>
          </div>
          <p className="text-xs mt-4" style={{ color: "#D4A5B0" }}>No credit card required · For RBTs & BCBAs</p>
        </div>

        {/* Right: animated app window */}
        <div style={{ animation: "floatApp 5s ease-in-out infinite" }}>
          <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 24px 64px rgba(194,122,138,0.2), 0 4px 16px rgba(0,0,0,0.08)", border: "1px solid #F0E4E1" }}>
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#2D2523" }}>
              {["#FF5F56","#FFBD2E","#27C93F"].map((c,i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              <div className="flex-1 mx-3 px-3 py-1 rounded-md text-xs text-center" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>abanoteassistant.app/wizard</div>
            </div>
            {/* App content */}
            <div className="p-5" style={{ background: "#FDFAF7", minHeight: 320 }}>
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 mb-5 overflow-hidden">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                      style={{ background: i === wizardStep ? "linear-gradient(135deg,#C87585,#C27A8A)" : i < wizardStep ? "rgba(194,122,138,0.15)" : "#F0E4E1", color: i === wizardStep ? "white" : i < wizardStep ? "#C27A8A" : "#877870", boxShadow: i === wizardStep ? "0 3px 10px rgba(194,122,138,0.35)" : "none" }}>
                      {i < wizardStep ? "✓" : i + 1} {i <= 2 ? s : ""}
                    </div>
                    {i < STEPS.length - 1 && <div className="w-4 h-px" style={{ background: i < wizardStep ? "#C27A8A" : "#F0E4E1" }} />}
                  </div>
                ))}
              </div>

              {/* Content area */}
              {wizardStep < STEPS.length - 1 ? (
                <div style={{ animation: "stepIn 0.4s ease-out both" }} key={wizardStep}>
                  <p className="text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: "#877870" }}>{WIZARD_CONTENT[Math.min(wizardStep, 3)].label}</p>
                  <div className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "white", border: "1.5px solid #C27A8A", color: "#2D2523", boxShadow: "0 0 0 3px rgba(194,122,138,0.1)" }}>
                    {WIZARD_CONTENT[Math.min(wizardStep, 3)].value}
                  </div>
                  <button className="mt-5 px-5 py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 12px rgba(194,122,138,0.35)" }}>
                    Next Step →
                  </button>
                </div>
              ) : (
                <div key="generate">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#877870" }}>Generated Note</p>
                    {generating && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#FCEEF1", color: "#C27A8A", animation: "shimmer 1s ease-in-out infinite" }}>✦ Writing...</span>}
                  </div>
                  <div className="p-4 rounded-xl text-xs leading-relaxed" style={{ background: "white", border: "1.5px solid #F0E4E1", minHeight: 120, color: "#2D2523" }}>
                    {NOTE_TEXT.slice(0, noteChars)}
                    {generating && <span style={{ animation: "cursorBlink 0.8s ease-in-out infinite", borderRight: "2px solid #C27A8A" }}>&nbsp;</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-10 py-12 max-w-6xl mx-auto">
        <p className="text-center text-xs font-bold uppercase tracking-widest mb-8" style={{ color: "#C27A8A" }}>Everything you need</p>
        <div className="grid grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="p-5 rounded-2xl" style={{ background: "white", border: "1px solid #F0E4E1", boxShadow: "0 2px 12px rgba(194,122,138,0.06)" }}>
              <div className="text-2xl mb-3">{f.icon}</div>
              <p className="font-bold text-sm mb-1.5" style={{ color: "#2D2523" }}>{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#877870" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA banner */}
      <div className="mx-10 mb-14 rounded-3xl px-10 py-10 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 12px 40px rgba(194,122,138,0.35)" }}>
        <div>
          <p className="text-white font-extrabold text-2xl mb-1">Ready to save hours every week?</p>
          <p className="text-white/70 text-sm">Join ABA therapists who've eliminated their paperwork backlog.</p>
        </div>
        <button className="px-7 py-3.5 rounded-xl font-bold text-sm flex-shrink-0" style={{ background: "white", color: "#C27A8A", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
          Create Free Account →
        </button>
      </div>
    </div>
  );
}
