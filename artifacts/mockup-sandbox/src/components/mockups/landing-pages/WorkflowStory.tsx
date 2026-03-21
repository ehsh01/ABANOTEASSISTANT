import { useState, useEffect } from "react";

const NOTE_TEXT = `Client demonstrated 87% accuracy on color identification across 24 trials. Manding program progressed to gestural prompting. One brief episode of task avoidance (22 sec), redirected with preferred item. Recommend advancing color ID to independent criterion next session.`;

const CLIENTS = [
  { initials: "MT", name: "Marcus T.", age: 6, color: "#C27A8A" },
  { initials: "LR", name: "Lily R.", age: 8, color: "#8EA8D8" },
  { initials: "JK", name: "Jordan K.", age: 5, color: "#7DC4A0" },
];

const TARGETS = [
  { label: "Color Identification", pct: 87, prev: 72 },
  { label: "Manding", pct: 79, prev: 65 },
  { label: "Shape Matching", pct: 64, prev: 64 },
];

export function WorkflowStory() {
  const [activeStep, setActiveStep] = useState(0);
  const [noteChars, setNoteChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedClient, setSelectedClient] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(s => {
        const next = (s + 1) % 3;
        if (next === 2) {
          setTimeout(() => {
            setNoteChars(0);
            setIsTyping(true);
            let i = 0;
            const t = setInterval(() => {
              i += 5;
              setNoteChars(i);
              if (i >= NOTE_TEXT.length) { clearInterval(t); setIsTyping(false); }
            }, 22);
          }, 400);
        }
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: "#FDFAF7", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes barFill { from{width:0} to{width:var(--w)} }
        @keyframes stepGlow { 0%,100%{box-shadow:0 0 0 0 rgba(194,122,138,0)} 50%{box-shadow:0 0 0 10px rgba(194,122,138,0.12)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-4" style={{ borderBottom: "1px solid #F0E4E1" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)", boxShadow: "0 4px 10px rgba(194,122,138,0.3)" }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" /></svg>
          </div>
          <span className="font-extrabold text-xs tracking-widest uppercase" style={{ color: "#2D2523", letterSpacing: "0.18em" }}>ABANOTEASSISTANT</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: "#877870" }}>Sign In</button>
          <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 12px rgba(194,122,138,0.35)" }}>Get Started Free</button>
        </div>
      </nav>

      {/* Hero — centered */}
      <div className="text-center px-10 pt-14 pb-10" style={{ animation: "fadeUp 0.7s ease-out both" }}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ background: "#FCEEF1", border: "1px solid #F0E4E1" }}>
          <span style={{ fontSize: 12, color: "#C27A8A", fontWeight: 700 }}>✦ Designed for RBTs & BCBAs</span>
        </div>
        <h1 className="text-5xl font-extrabold mb-4 mx-auto" style={{ color: "#2D2523", maxWidth: 600, lineHeight: 1.15 }}>
          Three steps.<br />
          <span style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>One perfect note.</span>
        </h1>
        <p className="text-base mx-auto mb-8" style={{ color: "#877870", maxWidth: 480, lineHeight: 1.7 }}>
          Pick a client, walk through your session, and let AI write the clinical note. No templates, no copy-paste — just your session captured in seconds.
        </p>
        <button className="px-7 py-3.5 rounded-xl text-white font-bold text-sm" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 6px 20px rgba(194,122,138,0.4)" }}>
          Try It Free
        </button>
      </div>

      {/* 3-step workflow with live previews */}
      <div className="px-10 pb-14 max-w-6xl mx-auto">
        {/* Step tabs */}
        <div className="flex items-center justify-center gap-0 mb-8 rounded-2xl p-1.5 mx-auto" style={{ background: "#F0E4E1", maxWidth: 520 }}>
          {["1 · Select Client", "2 · Log Session", "3 · Generate Note"].map((s, i) => (
            <button key={i} onClick={() => setActiveStep(i)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: i === activeStep ? "white" : "transparent", color: i === activeStep ? "#2D2523" : "#877870", boxShadow: i === activeStep ? "0 2px 8px rgba(0,0,0,0.08)" : "none" }}>
              {s}
            </button>
          ))}
        </div>

        {/* Step panels */}
        <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "0 20px 60px rgba(194,122,138,0.15), 0 4px 16px rgba(0,0,0,0.06)", border: "1px solid #F0E4E1" }}>
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#2D2523" }}>
            {["#FF5F56","#FFBD2E","#27C93F"].map((c,i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
            <div className="flex-1 mx-4 px-3 py-1 rounded-md text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
              abanoteassistant.app/wizard · Step {activeStep + 1} of 7
            </div>
          </div>

          {/* Panel content */}
          <div className="p-8" style={{ background: "#FDFAF7", minHeight: 320 }} key={activeStep}>

            {/* STEP 1: Client selection */}
            {activeStep === 0 && (
              <div style={{ animation: "fadeUp 0.4s ease-out both" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#877870" }}>Select a client to begin</p>
                <div className="grid grid-cols-3 gap-4">
                  {CLIENTS.map((c, i) => (
                    <div key={i} onClick={() => setSelectedClient(i)}
                      className="p-5 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3"
                      style={{ background: i === selectedClient ? "white" : "white", border: `2px solid ${i === selectedClient ? c.color : "#F0E4E1"}`, boxShadow: i === selectedClient ? `0 4px 20px ${c.color}30` : "none", transform: i === selectedClient ? "scale(1.02)" : "scale(1)" }}>
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-extrabold text-lg" style={{ background: `linear-gradient(135deg,${c.color}AA,${c.color})`, boxShadow: `0 6px 16px ${c.color}40` }}>
                        {c.initials}
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: "#2D2523" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "#877870" }}>Age {c.age} · ASD</p>
                      </div>
                      {i === selectedClient && <div className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FCEEF1", color: "#C27A8A" }}>✓ Selected</div>}
                    </div>
                  ))}
                </div>
                <button className="mt-6 px-6 py-3 rounded-xl text-white text-sm font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 14px rgba(194,122,138,0.4)" }}>
                  Start Session with {CLIENTS[selectedClient].name.split(" ")[0]} →
                </button>
              </div>
            )}

            {/* STEP 2: Session logging */}
            {activeStep === 1 && (
              <div style={{ animation: "fadeUp 0.4s ease-out both" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#877870" }}>How did the session go?</p>
                <div className="grid grid-cols-2 gap-5">
                  {/* Program targets */}
                  <div>
                    <p className="text-xs font-semibold mb-3" style={{ color: "#2D2523" }}>Program Targets & Accuracy</p>
                    <div className="space-y-3">
                      {TARGETS.map((t, i) => (
                        <div key={i}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-medium" style={{ color: "#2D2523" }}>{t.label}</span>
                            <span className="text-xs font-bold" style={{ color: t.pct > t.prev ? "#7DC4A0" : "#877870" }}>
                              {t.pct}% {t.pct > t.prev ? `↑ from ${t.prev}%` : ""}
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0E4E1" }}>
                            <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: "linear-gradient(90deg,#C87585,#C27A8A)", transition: "width 0.8s ease-out" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Behavior */}
                  <div>
                    <p className="text-xs font-semibold mb-3" style={{ color: "#2D2523" }}>Behavior Notes</p>
                    <div className="space-y-2.5">
                      {[["Session Duration", "60 minutes"], ["Behavior Incidents", "1 episode · 22 sec"], ["Intervention", "Redirect with preferred item"], ["Outcome", "Successful — returned to task"]].map(([k, v], i) => (
                        <div key={i} className="flex justify-between px-3 py-2 rounded-xl" style={{ background: "white", border: "1px solid #F0E4E1" }}>
                          <span className="text-xs" style={{ color: "#877870" }}>{k}</span>
                          <span className="text-xs font-semibold" style={{ color: "#2D2523" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="mt-6 px-6 py-3 rounded-xl text-white text-sm font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 14px rgba(194,122,138,0.4)" }}>
                  ✦ Generate My Note
                </button>
              </div>
            )}

            {/* STEP 3: Generated note */}
            {activeStep === 2 && (
              <div style={{ animation: "fadeUp 0.4s ease-out both" }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#877870" }}>Generated Clinical Note</p>
                    <p className="text-xs mt-0.5" style={{ color: "#D4A5B0" }}>Marcus T. · March 21, 2026</p>
                  </div>
                  {isTyping ? (
                    <span className="text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5" style={{ background: "#FCEEF1", color: "#C27A8A", animation: "shimmer 1s ease-in-out infinite" }}>
                      <span style={{ animation: "shimmer 0.6s ease-in-out infinite" }}>✦</span> AI Writing...
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#FCEEF1", color: "#C27A8A" }}>Copy</button>
                      <button className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", color: "white" }}>Save Note</button>
                    </div>
                  )}
                </div>
                <div className="p-5 rounded-2xl text-sm leading-relaxed" style={{ background: "white", border: "1.5px solid #F0E4E1", minHeight: 160, color: "#2D2523", lineHeight: 1.75 }}>
                  {NOTE_TEXT.slice(0, noteChars)}
                  {isTyping && <span style={{ borderRight: "2px solid #C27A8A", animation: "blink 0.7s ease-in-out infinite" }}>&nbsp;</span>}
                </div>
                {!isTyping && noteChars >= NOTE_TEXT.length && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold" style={{ color: "#7DC4A0", animation: "fadeIn 0.5s ease-out both" }}>
                    ✓ Note complete · Saved to Marcus T.'s history
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features strip */}
      <div className="px-10 pb-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-4 gap-4">
          {[["⚡","Auto-generate notes","AI writes complete clinical documentation from your session inputs"],["👶","Client profiles","Store every child's history, diagnosis, and progress over time"],["📋","7-step wizard","Guided prompts ensure you never miss a required data point"],["🔒","Secure & private","Your notes stay yours. No sharing, no third parties"]].map(([icon, title, desc], i) => (
            <div key={i} className="p-4 rounded-2xl" style={{ background: "white", border: "1px solid #F0E4E1" }}>
              <div className="text-xl mb-2">{icon}</div>
              <p className="font-bold text-xs mb-1" style={{ color: "#2D2523" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#877870" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
