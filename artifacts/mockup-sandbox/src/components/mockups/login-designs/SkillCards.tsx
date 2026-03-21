const CARDS = [
  { label: "🔴", sub: "Red", bg: "#FFE4E4", border: "#FFBABA", x: 6, y: 10, rot: -12, dur: 7, delay: 0 },
  { label: "🔵", sub: "Blue", bg: "#E4EEFF", border: "#BACAFF", x: 78, y: 8, rot: 10, dur: 6, delay: 0.8 },
  { label: "🟡", sub: "Yellow", bg: "#FFF9E4", border: "#FFE8A1", x: 14, y: 55, rot: -8, dur: 8, delay: 1.4 },
  { label: "⬛", sub: "Square", bg: "#F0EDF8", border: "#C8BAF0", x: 70, y: 50, rot: 14, dur: 7, delay: 0.4 },
  { label: "🔺", sub: "Triangle", bg: "#E4F8EE", border: "#BAF0CF", x: 82, y: 72, rot: -6, dur: 6.5, delay: 2.1 },
  { label: "A", sub: "Letter A", bg: "#FCEEF1", border: "#F0BBCA", x: 4, y: 78, rot: 8, dur: 7.5, delay: 1.0 },
  { label: "🟢", sub: "Green", bg: "#E4F8EE", border: "#BAE8CF", x: 88, y: 28, rot: -16, dur: 9, delay: 1.8 },
  { label: "1", sub: "One", bg: "#FFF4E4", border: "#FFCF8A", x: 55, y: 82, rot: 10, dur: 6, delay: 0.6 },
  { label: "⭕", sub: "Circle", bg: "#FCEEF1", border: "#F5BFCC", x: 35, y: 6, rot: -4, dur: 8, delay: 2.4 },
];

export function SkillCards() {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center"
      style={{
        background: "linear-gradient(150deg, #FDFAF7 0%, #FFF0F3 50%, #FDF6F0 100%)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes cardFloat {
          0%, 100% { transform: translateY(0px) rotate(var(--rot)); }
          40% { transform: translateY(-16px) rotate(calc(var(--rot) + 4deg)); }
          70% { transform: translateY(-8px) rotate(calc(var(--rot) - 3deg)); }
        }
        @keyframes cardPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(194,122,138,0.12), 0 2px 6px rgba(0,0,0,0.06); }
          50% { box-shadow: 0 8px 24px rgba(194,122,138,0.22), 0 4px 10px rgba(0,0,0,0.08); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes connDot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Floating flashcards */}
      {CARDS.map((c, i) => (
        <div
          key={i}
          className="absolute pointer-events-none select-none rounded-2xl flex flex-col items-center justify-center gap-1"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            width: 72,
            height: 88,
            background: c.bg,
            border: `1.5px solid ${c.border}`,
            boxShadow: "0 4px 16px rgba(194,122,138,0.12), 0 2px 6px rgba(0,0,0,0.06)",
            ["--rot" as string]: `${c.rot}deg`,
            transform: `rotate(${c.rot}deg)`,
            animation: `cardFloat ${c.dur}s ease-in-out ${c.delay}s infinite, cardPulse ${c.dur + 1}s ease-in-out ${c.delay}s infinite`,
            zIndex: 0,
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1 }}>{c.label}</span>
          <span
            className="font-bold text-center"
            style={{ fontSize: 9, color: "#877870", letterSpacing: "0.05em", lineHeight: 1.2 }}
          >
            {c.sub}
          </span>
        </div>
      ))}

      {/* Tiny connection dots between cards */}
      {[...Array(12)].map((_, i) => (
        <div
          key={`d-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${(i * 19 + 10) % 88}%`,
            top: `${(i * 27 + 15) % 85}%`,
            width: 5,
            height: 5,
            background: "#C27A8A",
            opacity: 0.25,
            animation: `connDot ${2.5 + (i % 3)}s ease-in-out ${(i * 0.5) % 2.5}s infinite`,
          }}
        />
      ))}

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-sm mx-6 rounded-3xl"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 24px 64px rgba(194,122,138,0.2), 0 4px 20px rgba(0,0,0,0.06)",
          border: "1.5px solid #F0E4E1",
          animation: "fadeUp 0.6s ease-out both",
        }}
      >
        <div className="px-8 pt-9 pb-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative"
              style={{
                background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)",
                boxShadow: "0 8px 24px rgba(194,122,138,0.4)",
              }}
            >
              {/* Card stack icon */}
              <div className="relative w-7 h-7">
                <div className="absolute inset-0 bg-white/30 rounded-lg" style={{ transform: "rotate(-8deg) translate(-2px, 2px)" }} />
                <div className="absolute inset-0 bg-white/50 rounded-lg" style={{ transform: "rotate(4deg) translate(1px, -1px)" }} />
                <div className="absolute inset-0 bg-white rounded-lg flex items-center justify-center">
                  <span style={{ fontSize: 14 }}>⭐</span>
                </div>
              </div>
            </div>
            <span
              className="font-extrabold tracking-widest uppercase text-sm"
              style={{ color: "#2D2523", letterSpacing: "0.18em", textShadow: "0 2px 3px rgba(0,0,0,0.1)" }}
            >
              ABANOTEASSISTANT
            </span>
            <p className="text-xs mt-1 font-medium" style={{ color: "#877870" }}>Welcome back, Therapist</p>
          </div>

          {/* "Today's session" mini flashcard preview */}
          <div
            className="rounded-2xl p-3 mb-6 flex items-center gap-3"
            style={{ background: "#FFF8F5", border: "1px solid #F0E4E1" }}
          >
            <div
              className="w-10 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#FCEEF1", border: "1px solid #F0BBCA" }}
            >
              <span style={{ fontSize: 20 }}>🔴</span>
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: "#2D2523" }}>Next skill: Color matching</p>
              <p className="text-xs" style={{ color: "#877870" }}>3 trials remaining today</p>
            </div>
            <div
              className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "#FCEEF1", color: "#C27A8A" }}
            >
              DTT
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#2D2523" }}>Email</label>
              <input
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                placeholder="your@email.com"
                style={{
                  background: "#FDFAF7",
                  border: "1.5px solid #F0E4E1",
                  color: "#2D2523",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#2D2523" }}>Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                placeholder="••••••••"
                style={{
                  background: "#FDFAF7",
                  border: "1.5px solid #F0E4E1",
                  color: "#2D2523",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <button
            className="w-full mt-6 py-3.5 rounded-xl text-white text-sm font-bold tracking-wide"
            style={{
              background: "linear-gradient(135deg, #C87585 0%, #C27A8A 100%)",
              boxShadow: "0 6px 18px rgba(194,122,138,0.4)",
            }}
          >
            Sign In
          </button>

          <p className="text-center text-xs mt-5" style={{ color: "#877870" }}>
            No account?{" "}
            <span className="font-semibold cursor-pointer" style={{ color: "#C27A8A" }}>Register</span>
          </p>
        </div>
      </div>
    </div>
  );
}
