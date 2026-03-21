import { useState, useEffect } from "react";

const NOTE = `Client participated in a 60-min ABA session. DTT conducted across color identification (87%, 21/24), shape matching (64%, 16/25), and manding via PECS (79%, 11/14). Gestural prompting faded successfully on color ID. One episode of task refusal at 35-min mark (22 sec) — redirected with preferred fidget item. No SIB observed. Client demonstrated positive affect throughout; verbal praise effective as reinforcer. Recommend advancing color ID to independent criterion next session.`;

export function LuxurySplit() {
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<"idle" | "typing" | "done">("idle");

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase("typing");
      let i = 0;
      const iv = setInterval(() => {
        i += 6;
        setChars(Math.min(i, NOTE.length));
        if (i >= NOTE.length) { clearInterval(iv); setPhase("done"); }
      }, 25);
    }, 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes breathe {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes floatUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes subtleFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes glowPulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes dotPulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.4);opacity:1} }
        .left-panel { background: #12080D; }
        .glow-orb-1 { position:absolute; width:500px; height:500px; border-radius:50%; background:radial-gradient(circle,rgba(180,80,110,0.18) 0%,transparent 70%); top:-100px; left:-150px; pointer-events:none; animation: glowPulse 6s ease-in-out infinite; }
        .glow-orb-2 { position:absolute; width:400px; height:400px; border-radius:50%; background:radial-gradient(circle,rgba(140,60,90,0.12) 0%,transparent 70%); bottom:-80px; right:-100px; pointer-events:none; animation: glowPulse 8s ease-in-out 2s infinite; }
      `}</style>

      {/* LEFT — Dark info panel */}
      <div className="left-panel relative flex flex-col justify-between w-[42%] px-14 py-12 overflow-hidden flex-shrink-0">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3" style={{ animation: "floatUp 0.6s ease-out both" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#C87585,#9A3A54)", boxShadow: "0 4px 20px rgba(194,80,100,0.45)" }}>
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" />
            </svg>
          </div>
          <span className="font-extrabold tracking-widest text-xs uppercase" style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "0.2em" }}>
            ABANOTEASSISTANT
          </span>
        </div>

        {/* Main copy */}
        <div className="relative z-10" style={{ animation: "floatUp 0.6s ease-out 0.15s both" }}>
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "rgba(194,122,138,0.8)", letterSpacing: "0.18em" }}>
              For RBTs &amp; BCBAs
            </p>
            <h1 style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.08, color: "white", marginBottom: 20, letterSpacing: "-0.02em" }}>
              Session notes<br />
              <span style={{ background: "linear-gradient(135deg,#E8A0B0 0%,#C27A8A 60%,#A05070 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                write themselves.
              </span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.75, maxWidth: 360 }}>
              Walk through your session. We generate a complete, accurate clinical note — ready to submit in under 30 seconds.
            </p>
          </div>

          {/* 3 features — minimal */}
          <div className="space-y-4 mb-10">
            {[
              ["✦", "AI-generated clinical notes", "Accurate, structured, ready to submit"],
              ["✦", "Guided 7-step session wizard", "Never miss a data point again"],
              ["✦", "Full client history & profiles", "Every child, every session, organized"],
            ].map(([dot, title, sub], i) => (
              <div key={i} className="flex items-start gap-3.5">
                <span style={{ color: "#C27A8A", fontSize: 12, marginTop: 3, flexShrink: 0 }}>{dot}</span>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{title}</p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {["#C27A8A","#8EA8D8","#7DC4A0","#B5A0D4"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold"
                  style={{ borderColor: "#12080D", background: c, zIndex: 4 - i }}>
                  {["E","M","P","J"][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => <span key={i} style={{ color: "#C27A8A", fontSize: 11 }}>★</span>)}
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Trusted by 500+ therapists</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10" style={{ animation: "floatUp 0.6s ease-out 0.3s both" }}>
          <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 11 }}>
            © 2026 ABANOTEASSISTANT · HIPAA-conscious design
          </p>
        </div>
      </div>

      {/* RIGHT — Cream panel with product + form */}
      <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "#FDFAF7" }}>

        {/* Product preview — top half */}
        <div className="flex-1 flex items-end justify-center px-10 pt-10 pb-5">
          <div className="w-full max-w-lg" style={{ animation: "subtleFloat 6s ease-in-out infinite" }}>
            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 20px 60px rgba(45,37,35,0.12), 0 4px 16px rgba(45,37,35,0.06)", border: "1px solid #E8DCDA" }}>
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#2D2523" }}>
                <div className="w-3 h-3 rounded-full" style={{ background: "#FF5F56" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "#27C93F" }} />
                <div className="flex-1 mx-3">
                  <div className="mx-auto px-3 py-1 rounded-md text-xs text-center" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", maxWidth: 260 }}>
                    abanoteassistant.app/wizard
                  </div>
                </div>
              </div>

              {/* App UI */}
              <div className="p-5" style={{ background: "#FDFAF7" }}>
                {/* Client chip */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)" }}>MT</div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#2D2523" }}>Marcus T. · Age 6 · ASD</p>
                    <p className="text-xs" style={{ color: "#877870" }}>Session: March 21, 2026 · 60 min</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: "#FCEEF1", color: "#C27A8A" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C27A8A", display: "inline-block", animation: "dotPulse 1.5s ease-in-out infinite" }} />
                    {phase === "typing" ? "Generating..." : phase === "done" ? "Complete" : "Ready"}
                  </div>
                </div>

                {/* Note output */}
                <div className="rounded-xl p-4" style={{ background: "white", border: "1px solid #F0E4E1", minHeight: 110 }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "#877870" }}>Clinical Session Note</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#2D2523", lineHeight: 1.8 }}>
                    {phase === "idle"
                      ? <span style={{ color: "#D4A5B0", fontStyle: "italic" }}>Click "Generate Note" to begin...</span>
                      : NOTE.slice(0, chars)
                    }
                    {phase === "typing" && <span style={{ borderRight: "2px solid #C27A8A", marginLeft: 1, animation: "blink 0.7s ease-in-out infinite" }}>&nbsp;</span>}
                  </p>
                </div>

                {/* Action row */}
                {phase === "done" && (
                  <div className="flex gap-2 mt-3" style={{ animation: "fadeIn 0.5s ease-out both" }}>
                    <button className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background: "#F0E4E1", color: "#877870" }}>Copy</button>
                    <button className="flex-1 py-2 rounded-xl text-white text-xs font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)" }}>Save to File</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-10 h-px" style={{ background: "#F0E4E1" }} />

        {/* Login form — bottom half */}
        <div className="flex items-center justify-center px-10 py-8">
          <div className="w-full max-w-sm">
            <p className="text-sm font-bold mb-1" style={{ color: "#2D2523" }}>Welcome back</p>
            <p className="text-xs mb-6" style={{ color: "#877870" }}>Sign in to access your sessions and notes.</p>

            <div className="space-y-3 mb-4">
              <input className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" placeholder="Email address"
                style={{ background: "white", border: "1.5px solid #E8DCDA", color: "#2D2523", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(45,37,35,0.04)" }} />
              <input type="password" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" placeholder="Password"
                style={{ background: "white", border: "1.5px solid #E8DCDA", color: "#2D2523", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(45,37,35,0.04)" }} />
            </div>

            <button className="w-full py-3.5 rounded-xl text-white text-sm font-bold tracking-wide mb-4"
              style={{ background: "linear-gradient(135deg,#C87585 0%,#B06070 100%)", boxShadow: "0 6px 20px rgba(194,122,138,0.38)", letterSpacing: "0.01em" }}>
              Sign In
            </button>

            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "#877870" }}>
                No account? <span className="font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>Create one free</span>
              </p>
              <span className="text-xs cursor-pointer" style={{ color: "#C27A8A" }}>Forgot password?</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
