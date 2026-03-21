import { useState } from "react";

const THERAPISTS = [
  { name: "Elena H.", initials: "EH", color: "#C27A8A", bg: "linear-gradient(135deg,#e6b3c0,#C27A8A)", sessions: 3 },
  { name: "Marcus W.", initials: "MW", color: "#8EA8D8", bg: "linear-gradient(135deg,#b8cef0,#8EA8D8)", sessions: 2 },
  { name: "Priya S.", initials: "PS", color: "#7DC4A0", bg: "linear-gradient(135deg,#a8dfc2,#7DC4A0)", sessions: 4 },
  { name: "Jordan K.", initials: "JK", color: "#B5A0D4", bg: "linear-gradient(135deg,#d0c0ec,#B5A0D4)", sessions: 1 },
];

const PIN_DOTS = [0, 1, 2, 3];

const STAR_POS = [
  { x: 8, y: 10, s: 18, d: 0 }, { x: 85, y: 8, s: 14, d: 1 },
  { x: 5, y: 82, s: 20, d: 0.7 }, { x: 90, y: 78, s: 16, d: 1.5 },
  { x: 50, y: 4, s: 12, d: 2 },
];

export function WhoSignsIn() {
  const [selected, setSelected] = useState<number | null>(null);
  const [pinFilled, setPinFilled] = useState(2);

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg,#FDF6FA 0%,#FDFAF7 60%,#F8F6FD 100%)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes floatStar { 0%,100%{transform:translateY(0)rotate(0deg)} 50%{transform:translateY(-10px)rotate(6deg)} }
        @keyframes cardPop { from{opacity:0;transform:translateY(16px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ringPulse { 0%,100%{box-shadow:0 0 0 0 rgba(194,122,138,0.3)} 50%{box-shadow:0 0 0 8px rgba(194,122,138,0.1)} }
        @keyframes pinBounce { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
      `}</style>

      {/* Bg stars */}
      {STAR_POS.map((s, i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${s.x}%`, top: `${s.y}%`, animation: `floatStar 7s ease-in-out ${s.d}s infinite` }}>
          <svg width={s.s} height={s.s} viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#E8B4B8" opacity={0.5} />
          </svg>
        </div>
      ))}

      {/* Logo */}
      <div className="flex flex-col items-center mb-8" style={{ animation: "cardPop 0.5s ease-out both" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)", boxShadow: "0 6px 18px rgba(194,122,138,0.35)" }}>
          <svg viewBox="0 0 24 24" className="w-6 h-6"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" /></svg>
        </div>
        <span className="font-extrabold tracking-widest uppercase text-xs" style={{ color: "#2D2523", letterSpacing: "0.18em" }}>ABANOTEASSISTANT</span>
      </div>

      {selected === null ? (
        /* Step 1: Who's signing in */
        <div style={{ animation: "fadeSlide 0.5s ease-out 0.1s both" }}>
          <p className="text-center text-xl font-extrabold mb-1.5" style={{ color: "#2D2523" }}>Who's signing in?</p>
          <p className="text-center text-xs mb-8" style={{ color: "#877870" }}>Tap your name to continue</p>

          <div className="grid grid-cols-2 gap-4 px-4">
            {THERAPISTS.map((t, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className="flex flex-col items-center gap-3 p-5 rounded-3xl transition-all cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: "1.5px solid #F0E4E1",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 4px 16px rgba(194,122,138,0.08)",
                  animation: `cardPop 0.5s ease-out ${0.15 + i * 0.08}s both`,
                }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0"
                  style={{ background: t.bg, boxShadow: `0 6px 18px ${t.color}40` }}>
                  {t.initials}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: "#2D2523" }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#877870" }}>{t.sessions} sessions today</p>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: "#877870" }}>
            Not listed? <span className="font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>Sign in with email</span>
          </p>
        </div>
      ) : (
        /* Step 2: PIN entry */
        <div className="flex flex-col items-center" style={{ animation: "fadeSlide 0.4s ease-out both" }}>
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold text-white mb-4"
            style={{ background: THERAPISTS[selected].bg, boxShadow: `0 8px 24px ${THERAPISTS[selected].color}50`, animation: "ringPulse 2.5s ease-in-out infinite" }}>
            {THERAPISTS[selected].initials}
          </div>
          <p className="font-bold text-lg mb-0.5" style={{ color: "#2D2523" }}>Hi, {THERAPISTS[selected].name.split(".")[0]}!</p>
          <p className="text-xs mb-8" style={{ color: "#877870" }}>Enter your PIN to continue</p>

          {/* PIN dots */}
          <div className="flex gap-4 mb-8">
            {PIN_DOTS.map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full"
                style={{
                  background: i < pinFilled ? "linear-gradient(135deg,#C87585,#C27A8A)" : "transparent",
                  border: i < pinFilled ? "none" : "2px solid #D4A5B0",
                  boxShadow: i < pinFilled ? "0 2px 8px rgba(194,122,138,0.4)" : "none",
                  animation: i < pinFilled ? `pinBounce 0.3s ease-out ${i * 0.08}s both` : "none",
                }} />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
              <button key={i}
                onClick={() => { if (k === "⌫") setPinFilled(Math.max(0, pinFilled - 1)); else if (k !== "") setPinFilled(Math.min(4, pinFilled + 1)); }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold transition-all"
                style={{
                  background: k === "" ? "transparent" : "rgba(255,255,255,0.85)",
                  border: k === "" ? "none" : "1.5px solid #F0E4E1",
                  color: k === "⌫" ? "#877870" : "#2D2523",
                  backdropFilter: "blur(8px)",
                  boxShadow: k !== "" && k !== "" ? "0 2px 8px rgba(194,122,138,0.08)" : "none",
                  cursor: k === "" ? "default" : "pointer",
                }}>
                {k}
              </button>
            ))}
          </div>

          <button className="w-52 py-3.5 rounded-xl text-white text-sm font-bold"
            style={{ background: pinFilled >= 4 ? "linear-gradient(135deg,#C87585,#C27A8A)" : "#D4A5B0", boxShadow: pinFilled >= 4 ? "0 6px 18px rgba(194,122,138,0.4)" : "none", transition: "all 0.3s" }}>
            Unlock
          </button>

          <button onClick={() => setSelected(null)} className="mt-4 text-xs font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>
            ← Not you?
          </button>
        </div>
      )}
    </div>
  );
}
