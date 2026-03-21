const BUBBLES = [
  { size: 180, x: -5, y: -8, color: "rgba(194,122,138,0.07)", dur: 12, delay: 0 },
  { size: 240, x: 65, y: -15, color: "rgba(181,160,212,0.06)", dur: 14, delay: 1.5 },
  { size: 160, x: -10, y: 55, color: "rgba(142,168,216,0.07)", dur: 10, delay: 0.8 },
  { size: 220, x: 70, y: 60, color: "rgba(232,168,124,0.05)", dur: 13, delay: 2.2 },
  { size: 130, x: 35, y: 70, color: "rgba(194,122,138,0.06)", dur: 11, delay: 1.0 },
  { size: 100, x: 80, y: 35, color: "rgba(125,196,160,0.07)", dur: 9, delay: 3.0 },
];

const STARS_SMALL = [
  { x: 12, y: 15, s: 16, d: 0 }, { x: 80, y: 12, s: 12, d: 1 },
  { x: 7, y: 72, s: 14, d: 0.5 }, { x: 88, y: 68, s: 18, d: 1.8 },
  { x: 45, y: 90, s: 10, d: 2.2 }, { x: 60, y: 7, s: 20, d: 0.9 },
  { x: 25, y: 88, s: 14, d: 1.4 }, { x: 92, y: 40, s: 12, d: 2.8 },
];

export function Ambient() {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(170deg,#FDF0F4 0%,#FDFAF7 40%,#F8F4FD 100%)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes drift { 0%,100%{transform:translate(0,0)} 33%{transform:translate(10px,-8px)} 66%{transform:translate(-6px,12px)} }
        @keyframes twinkleStar { 0%,100%{opacity:0.25;transform:scale(0.8)} 50%{opacity:0.7;transform:scale(1.05)} }
        @keyframes floatLabel { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes fieldGlow { 0%,100%{border-color:rgba(240,228,225,0.8);box-shadow:none} 50%{border-color:rgba(194,122,138,0.35);box-shadow:0 0 0 4px rgba(194,122,138,0.06)} }
        @keyframes btnPulse { 0%,100%{box-shadow:0 6px 24px rgba(194,122,138,0.35)} 50%{box-shadow:0 8px 32px rgba(194,122,138,0.55)} }
        @keyframes dividerShimmer { 0%,100%{opacity:0.2} 50%{opacity:0.6} }
        @keyframes enterText { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Large ambient blobs */}
      {BUBBLES.map((b, i) => (
        <div key={i} className="absolute pointer-events-none rounded-full"
          style={{ width: b.size, height: b.size, left: `${b.x}%`, top: `${b.y}%`, background: b.color, filter: "blur(40px)", animation: `drift ${b.dur}s ease-in-out ${b.delay}s infinite` }} />
      ))}

      {/* Small floating stars */}
      {STARS_SMALL.map((s, i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${s.x}%`, top: `${s.y}%`, animation: `twinkleStar ${5 + i % 4}s ease-in-out ${s.d}s infinite` }}>
          <svg width={s.s} height={s.s} viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#C27A8A" />
          </svg>
        </div>
      ))}

      {/* Everything sits directly on the background — no card */}

      {/* Logo mark — floating above */}
      <div className="relative z-10 flex flex-col items-center mb-14" style={{ animation: "enterText 0.8s ease-out both" }}>
        <div className="w-16 h-16 rounded-full mb-5 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(232,180,184,0.6),rgba(194,122,138,0.8))", backdropFilter: "blur(16px)", border: "1.5px solid rgba(255,255,255,0.6)", boxShadow: "0 8px 32px rgba(194,122,138,0.25)", animation: "btnPulse 4s ease-in-out infinite" }}>
          <svg viewBox="0 0 24 24" className="w-8 h-8">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }} />
          </svg>
        </div>
        <span className="font-extrabold tracking-widest uppercase text-sm" style={{ color: "#2D2523", letterSpacing: "0.2em", animation: "floatLabel 6s ease-in-out infinite" }}>
          ABANOTEASSISTANT
        </span>
        <p className="text-xs mt-2 font-medium" style={{ color: "#C27A8A", animation: "floatLabel 6s ease-in-out 0.5s infinite" }}>
          Every session makes a difference
        </p>
      </div>

      {/* Divider with stars */}
      <div className="relative z-10 flex items-center gap-4 mb-10 w-72">
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(194,122,138,0.3))", animation: "dividerShimmer 4s ease-in-out infinite" }} />
        <svg width={14} height={14} viewBox="0 0 24 24" style={{ animation: "twinkleStar 3s ease-in-out infinite" }}>
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#C27A8A" opacity={0.5} />
        </svg>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,rgba(194,122,138,0.3),transparent)", animation: "dividerShimmer 4s ease-in-out 0.5s infinite" }} />
      </div>

      {/* Form — floats directly in the world */}
      <div className="relative z-10 w-72 space-y-5" style={{ animation: "enterText 0.8s ease-out 0.2s both" }}>
        {/* Email */}
        <div>
          <p className="text-xs font-semibold mb-2 text-center uppercase tracking-widest" style={{ color: "#877870" }}>Email</p>
          <input
            className="w-full text-center px-4 py-4 rounded-2xl text-sm outline-none"
            placeholder="your@email.com"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(20px)",
              border: "1.5px solid rgba(240,228,225,0.8)",
              color: "#2D2523",
              fontFamily: "inherit",
              animation: "fieldGlow 5s ease-in-out infinite",
              boxShadow: "0 2px 12px rgba(194,122,138,0.06)",
            }}
          />
        </div>

        {/* Password */}
        <div>
          <p className="text-xs font-semibold mb-2 text-center uppercase tracking-widest" style={{ color: "#877870" }}>Password</p>
          <input
            type="password"
            className="w-full text-center px-4 py-4 rounded-2xl text-sm outline-none"
            placeholder="••••••••"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(20px)",
              border: "1.5px solid rgba(240,228,225,0.8)",
              color: "#2D2523",
              fontFamily: "inherit",
              animation: "fieldGlow 5s ease-in-out 0.8s infinite",
              boxShadow: "0 2px 12px rgba(194,122,138,0.06)",
            }}
          />
        </div>

        {/* Button */}
        <button
          className="w-full py-4 rounded-2xl text-white text-sm font-bold tracking-wide mt-2"
          style={{
            background: "linear-gradient(135deg,rgba(200,117,133,0.9),rgba(194,122,138,0.95))",
            backdropFilter: "blur(12px)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            animation: "btnPulse 4s ease-in-out 1s infinite",
          }}
        >
          Sign In
        </button>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-center text-xs mt-8" style={{ color: "#877870", animation: "enterText 0.8s ease-out 0.4s both" }}>
        No account?{" "}
        <span className="font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>Register</span>
      </p>
    </div>
  );
}
