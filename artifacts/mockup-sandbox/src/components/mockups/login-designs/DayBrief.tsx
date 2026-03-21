const SESSIONS = [
  { time: "9:00 AM", child: "Marcus T.", skill: "Manding", status: "next" },
  { time: "10:30 AM", child: "Lily R.", skill: "Color ID", status: "upcoming" },
  { time: "1:00 PM", child: "Jordan K.", skill: "Imitation", status: "upcoming" },
];

const STAR_POSITIONS = [
  { x: 5, y: 8, size: 20, delay: 0, dur: 7 }, { x: 88, y: 6, size: 14, delay: 1.2, dur: 6 },
  { x: 15, y: 75, size: 16, delay: 0.5, dur: 8 }, { x: 82, y: 80, size: 22, delay: 2, dur: 7 },
  { x: 50, y: 5, size: 12, delay: 1.8, dur: 5.5 }, { x: 94, y: 45, size: 18, delay: 0.8, dur: 9 },
  { x: 3, y: 42, size: 10, delay: 2.5, dur: 6.5 },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const today = new Date().getDay();
const todayIdx = today === 0 ? 4 : today === 6 ? 4 : today - 1;

export function DayBrief() {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex"
      style={{ background: "#FDFAF7", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes floatS { 0%,100%{transform:translateY(0)rotate(0)} 50%{transform:translateY(-12px)rotate(8deg)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(194,122,138,0)} 50%{box-shadow:0 0 0 8px rgba(194,122,138,0.12)} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeDot { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes sessionSlide { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Background stars */}
      {STAR_POSITIONS.map((s, i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${s.x}%`, top: `${s.y}%`, animation: `floatS ${s.dur}s ease-in-out ${s.delay}s infinite` }}>
          <svg width={s.size} height={s.size} viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill={i % 2 === 0 ? "#E8B4B8" : "#F7D6A8"} opacity={0.5} />
          </svg>
        </div>
      ))}

      {/* LEFT: Day brief panel */}
      <div
        className="flex-1 flex flex-col justify-center px-10 py-10"
        style={{ animation: "slideInLeft 0.6s ease-out both" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)", boxShadow: "0 4px 12px rgba(194,122,138,0.35)" }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" /></svg>
          </div>
          <span className="font-extrabold text-xs tracking-widest uppercase" style={{ color: "#2D2523", letterSpacing: "0.18em" }}>ABANOTEASSISTANT</span>
        </div>

        {/* Day header */}
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C27A8A" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long" })}, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
          <h1 className="text-3xl font-extrabold" style={{ color: "#2D2523", lineHeight: 1.15 }}>
            Good morning,<br />
            <span style={{ color: "#C27A8A" }}>ready to start?</span>
          </h1>
        </div>

        {/* Week strip */}
        <div className="flex gap-2 mt-5 mb-7">
          {days.map((d, i) => (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold" style={{ color: i === todayIdx ? "#C27A8A" : "#877870" }}>{d}</span>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
                style={{
                  background: i < todayIdx ? "linear-gradient(135deg,#C87585,#C27A8A)" : i === todayIdx ? "rgba(194,122,138,0.12)" : "transparent",
                  border: i === todayIdx ? "2px solid #C27A8A" : "1.5px solid #F0E4E1",
                  color: i < todayIdx ? "white" : i === todayIdx ? "#C27A8A" : "#D4A5B0",
                  animation: i === todayIdx ? "pulseGlow 2.5s ease-in-out infinite" : "none",
                }}
              >
                {i < todayIdx ? "✓" : i === todayIdx ? "●" : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Today's sessions */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#877870" }}>Today's sessions</p>
          <div className="space-y-2.5">
            {SESSIONS.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  background: i === 0 ? "linear-gradient(135deg,rgba(200,117,133,0.1),rgba(232,180,184,0.08))" : "rgba(255,255,255,0.7)",
                  border: i === 0 ? "1.5px solid rgba(194,122,138,0.3)" : "1px solid #F0E4E1",
                  animation: `sessionSlide 0.5s ease-out ${0.3 + i * 0.1}s both`,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: i === 0 ? "#C27A8A" : "#D4A5B0", animation: i === 0 ? `fadeDot 2s ease-in-out infinite` : "none" }} />
                <span className="text-xs font-bold w-16 flex-shrink-0" style={{ color: "#877870" }}>{s.time}</span>
                <span className="text-sm font-bold flex-1" style={{ color: "#2D2523" }}>{s.child}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#FCEEF1", color: "#C27A8A" }}>{s.skill}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px my-12" style={{ background: "linear-gradient(180deg, transparent, #F0E4E1 20%, #F0E4E1 80%, transparent)" }} />

      {/* RIGHT: Auth form */}
      <div
        className="w-80 flex flex-col justify-center px-10 py-10"
        style={{ animation: "slideInRight 0.6s ease-out 0.1s both" }}
      >
        <p className="text-sm font-bold mb-1" style={{ color: "#2D2523" }}>That's you, right?</p>
        <p className="text-xs mb-7" style={{ color: "#877870" }}>Confirm your identity to access your sessions.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#2D2523" }}>Email</label>
            <input className="w-full px-4 py-3 rounded-xl text-sm outline-none" placeholder="your@email.com"
              style={{ background: "#FDFAF7", border: "1.5px solid #F0E4E1", color: "#2D2523", fontFamily: "inherit" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#2D2523" }}>Password</label>
            <input type="password" className="w-full px-4 py-3 rounded-xl text-sm outline-none" placeholder="••••••••"
              style={{ background: "#FDFAF7", border: "1.5px solid #F0E4E1", color: "#2D2523", fontFamily: "inherit" }} />
          </div>
        </div>

        <button className="w-full mt-6 py-3.5 rounded-xl text-white text-sm font-bold"
          style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 6px 18px rgba(194,122,138,0.4)" }}>
          Start My Day
        </button>

        <p className="text-center text-xs mt-5" style={{ color: "#877870" }}>
          No account? <span className="font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>Register</span>
        </p>
      </div>
    </div>
  );
}
