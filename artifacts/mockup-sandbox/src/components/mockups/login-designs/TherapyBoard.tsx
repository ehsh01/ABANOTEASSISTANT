const SHAPES = [
  { shape: "circle", color: "#FF7B7B", label: "Red", x: 3, y: 8, rot: 0, dur: 8, delay: 0 },
  { shape: "square", color: "#7BB5FF", label: "Blue", x: 78, y: 5, rot: 12, dur: 7, delay: 0.6 },
  { shape: "triangle", color: "#FFD07B", label: "Yellow", x: 6, y: 58, rot: -8, dur: 9, delay: 1.2 },
  { shape: "circle", color: "#7BDA9E", label: "Green", x: 80, y: 55, rot: 0, dur: 6.5, delay: 0.3 },
  { shape: "star", color: "#C27A8A", label: "Star", x: 88, y: 26, rot: 15, dur: 8, delay: 1.8 },
  { shape: "square", color: "#B57BFF", label: "Purple", x: 2, y: 82, rot: -15, dur: 7.5, delay: 2.2 },
];

function Shape({ type, color, size = 48 }: { type: string; color: string; size?: number }) {
  if (type === "circle") return <div style={{ width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 4px 12px ${color}60` }} />;
  if (type === "square") return <div style={{ width: size, height: size, borderRadius: 8, background: color, boxShadow: `0 4px 12px ${color}60` }} />;
  if (type === "triangle") return (
    <div style={{ width: 0, height: 0, borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size * 0.87}px solid ${color}`, filter: `drop-shadow(0 4px 6px ${color}60)` }} />
  );
  if (type === "star") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill={color} style={{ filter: `drop-shadow(0 4px 6px ${color}80)` }} />
    </svg>
  );
  return null;
}

export function TherapyBoard() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(160deg, #FFF8F0 0%, #FEF0F4 50%, #F0F4FF 100%)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes shapeDrift { 0%,100%{transform:translateY(0)rotate(var(--r))} 40%{transform:translateY(-14px)rotate(calc(var(--r) + 8deg))} 70%{transform:translateY(-6px)rotate(calc(var(--r) - 5deg))} }
        @keyframes boardShine { 0%,100%{box-shadow:0 8px 32px rgba(194,122,138,0.15),0 2px 8px rgba(0,0,0,0.06)} 50%{box-shadow:0 12px 40px rgba(194,122,138,0.25),0 4px 12px rgba(0,0,0,0.08)} }
        @keyframes checkPop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
        @keyframes labelBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes tryGlow { 0%,100%{background:rgba(194,122,138,0.1)} 50%{background:rgba(194,122,138,0.18)} }
      `}</style>

      {/* Floating therapy shapes */}
      {SHAPES.map((s, i) => (
        <div key={i} className="absolute pointer-events-none select-none flex flex-col items-center gap-2"
          style={{ left: `${s.x}%`, top: `${s.y}%`, ["--r" as string]: `${s.rot}deg`, transform: `rotate(${s.rot}deg)`, animation: `shapeDrift ${s.dur}s ease-in-out ${s.delay}s infinite`, zIndex: 0 }}>
          <Shape type={s.shape} color={s.color} size={42} />
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.8)", color: "#877870", backdropFilter: "blur(4px)", animation: `labelBounce ${s.dur}s ease-in-out ${s.delay}s infinite` }}>{s.label}</span>
        </div>
      ))}

      {/* Board frame */}
      <div className="absolute inset-6 rounded-3xl pointer-events-none" style={{ border: "2px dashed rgba(194,122,138,0.2)" }} />

      {/* Corner decorations */}
      {[["top-6 left-6","rounded-br-2xl"],["top-6 right-6","rounded-bl-2xl"],["bottom-6 left-6","rounded-tr-2xl"],["bottom-6 right-6","rounded-tl-2xl"]].map(([pos, radius], i) => (
        <div key={i} className={`absolute ${pos} w-6 h-6 pointer-events-none`}
          style={{ background: "rgba(194,122,138,0.15)", borderRadius: "50%", width: 12, height: 12 }} />
      ))}

      {/* Center login "station" */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
        <div
          className="w-80 rounded-3xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(24px)",
            border: "2px solid rgba(194,122,138,0.2)",
            animation: "boardShine 4s ease-in-out infinite",
          }}
        >
          {/* Station header */}
          <div className="px-6 py-4" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">Therapist Login</p>
                <p className="text-white font-extrabold text-base tracking-wide">Station 1</p>
              </div>
              <div className="flex gap-1.5">
                {["#FF7B7B","#FFD07B","#7BDA9E"].map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 2px 4px ${c}60` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {/* Mini match activity as branding */}
            <div className="flex items-center justify-center gap-3 mb-5 py-3 rounded-2xl" style={{ background: "#FDFAF7", border: "1px solid #F0E4E1", animation: "tryGlow 3s ease-in-out infinite" }}>
              <Shape type="circle" color="#FF7B7B" size={24} />
              <div className="flex items-center gap-1 text-xs font-bold" style={{ color: "#877870" }}>
                <span>Match</span>
                <span>→</span>
              </div>
              <Shape type="circle" color="#FF7B7B" size={24} />
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#7BDA9E", animation: "checkPop 0.5s ease-out 1s both" }}>
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            </div>

            <div className="mb-1 text-center">
              <span className="font-extrabold text-xs tracking-widest uppercase" style={{ color: "#2D2523", letterSpacing: "0.15em" }}>ABANOTEASSISTANT</span>
            </div>
            <p className="text-center text-xs mb-5" style={{ color: "#877870" }}>Sign in to begin your session</p>

            <div className="space-y-3">
              <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" placeholder="Email"
                style={{ background: "#FDFAF7", border: "1.5px solid #F0E4E1", color: "#2D2523", fontFamily: "inherit" }} />
              <input type="password" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" placeholder="Password"
                style={{ background: "#FDFAF7", border: "1.5px solid #F0E4E1", color: "#2D2523", fontFamily: "inherit" }} />
            </div>

            <button className="w-full mt-4 py-3 rounded-xl text-white text-sm font-bold"
              style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 6px 18px rgba(194,122,138,0.4)" }}>
              Start Session ✓
            </button>

            <p className="text-center text-xs mt-4" style={{ color: "#877870" }}>
              New therapist? <span className="font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>Register</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
