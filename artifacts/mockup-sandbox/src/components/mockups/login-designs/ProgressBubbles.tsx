const BUBBLES = [
  { icon: "✓", size: 52, x: 8, startY: 88, dur: 8, delay: 0, color: "#C27A8A", bg: "rgba(194,122,138,0.12)", border: "rgba(194,122,138,0.3)" },
  { icon: "⭐", size: 38, x: 18, startY: 92, dur: 11, delay: 1.5, color: "#E8A87C", bg: "rgba(232,168,124,0.12)", border: "rgba(232,168,124,0.3)" },
  { icon: "✓", size: 44, x: 30, startY: 95, dur: 9, delay: 0.7, color: "#8EA8D8", bg: "rgba(142,168,216,0.12)", border: "rgba(142,168,216,0.3)" },
  { icon: "🎯", size: 60, x: 62, startY: 90, dur: 12, delay: 2.2, color: "#C27A8A", bg: "rgba(194,122,138,0.1)", border: "rgba(194,122,138,0.25)" },
  { icon: "⭐", size: 46, x: 72, startY: 94, dur: 10, delay: 0.3, color: "#B5A0D4", bg: "rgba(181,160,212,0.12)", border: "rgba(181,160,212,0.3)" },
  { icon: "✓", size: 34, x: 82, startY: 88, dur: 7.5, delay: 1.0, color: "#7DC4A0", bg: "rgba(125,196,160,0.12)", border: "rgba(125,196,160,0.3)" },
  { icon: "🌟", size: 56, x: 90, startY: 93, dur: 13, delay: 3.0, color: "#E8C97C", bg: "rgba(232,201,124,0.12)", border: "rgba(232,201,124,0.3)" },
  { icon: "✓", size: 30, x: 45, startY: 97, dur: 9, delay: 2.8, color: "#C27A8A", bg: "rgba(194,122,138,0.1)", border: "rgba(194,122,138,0.25)" },
  { icon: "⭐", size: 42, x: 55, startY: 92, dur: 8, delay: 1.9, color: "#D4A0C0", bg: "rgba(212,160,192,0.12)", border: "rgba(212,160,192,0.3)" },
  { icon: "🎯", size: 36, x: 5, startY: 96, dur: 14, delay: 4.0, color: "#A0C4D8", bg: "rgba(160,196,216,0.1)", border: "rgba(160,196,216,0.25)" },
];

const MILESTONES = [
  { label: "Color ID", done: true },
  { label: "Shape Match", done: true },
  { label: "Imitation", done: false },
  { label: "Manding", done: false },
];

export function ProgressBubbles() {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center"
      style={{
        background: "linear-gradient(180deg, #FDF6FA 0%, #FDFAF7 60%, #F8F0FA 100%)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes rise {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          5% { opacity: 1; }
          90% { opacity: 0.7; }
          100% { transform: translateY(-110vh) translateX(var(--drift)) scale(0.85); opacity: 0; }
        }
        @keyframes wobble {
          0%, 100% { border-radius: 50%; }
          25% { border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%; }
          50% { border-radius: 52% 48% 48% 52% / 48% 52% 48% 52%; }
          75% { border-radius: 50% 50% 52% 48% / 50% 50% 48% 52%; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(194,122,138,0.15), inset 0 1px 0 rgba(255,255,255,0.5); }
          50% { box-shadow: 0 8px 32px rgba(194,122,138,0.28), inset 0 1px 0 rgba(255,255,255,0.7); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes milePop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Rising bubbles */}
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center pointer-events-none select-none"
          style={{
            left: `${b.x}%`,
            bottom: 0,
            width: b.size,
            height: b.size,
            background: b.bg,
            border: `1.5px solid ${b.border}`,
            color: b.color,
            fontSize: b.size * 0.42,
            lineHeight: 1,
            ["--drift" as string]: `${(i % 2 === 0 ? 1 : -1) * (i * 12 + 8)}px`,
            animation: `rise ${b.dur}s linear ${b.delay}s infinite, wobble ${3 + (i % 3)}s ease-in-out infinite, glow ${4 + (i % 2)}s ease-in-out ${b.delay}s infinite`,
            backdropFilter: "blur(6px)",
            zIndex: 0,
          }}
        >
          {b.icon}
        </div>
      ))}

      {/* Soft radial glows */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(194,122,138,0.08) 0%, transparent 70%)",
          top: "10%",
          left: "-10%",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 350,
          height: 350,
          background: "radial-gradient(circle, rgba(181,160,212,0.08) 0%, transparent 70%)",
          bottom: "15%",
          right: "-5%",
        }}
      />

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-sm mx-6 rounded-3xl"
        style={{
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(28px)",
          boxShadow: "0 24px 64px rgba(194,122,138,0.18), 0 2px 12px rgba(0,0,0,0.05)",
          border: "1.5px solid rgba(240,228,225,0.9)",
          animation: "slideUp 0.7s ease-out both",
        }}
      >
        {/* Progress bar at top */}
        <div className="h-1.5 rounded-t-3xl overflow-hidden" style={{ background: "#F0E4E1" }}>
          <div
            className="h-full rounded-t-3xl"
            style={{
              width: "58%",
              background: "linear-gradient(90deg, #C87585, #E8B4B8)",
              boxShadow: "0 0 8px rgba(194,122,138,0.4)",
            }}
          />
        </div>

        <div className="px-8 pt-7 pb-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)",
                boxShadow: "0 8px 24px rgba(194,122,138,0.4)",
                animation: "glow 3s ease-in-out infinite",
              }}
            >
              <span style={{ fontSize: 26 }}>🌟</span>
            </div>
            <span
              className="font-extrabold tracking-widest uppercase text-sm"
              style={{ color: "#2D2523", letterSpacing: "0.18em", textShadow: "0 2px 3px rgba(0,0,0,0.1)" }}
            >
              ABANOTEASSISTANT
            </span>
            <p className="text-xs mt-1 font-medium" style={{ color: "#877870" }}>Every session makes a difference</p>
          </div>

          {/* Milestone tracker */}
          <div
            className="rounded-2xl p-3.5 mb-6"
            style={{ background: "#FFF8F5", border: "1px solid #F0E4E1" }}
          >
            <p className="text-xs font-bold mb-2.5" style={{ color: "#877870" }}>Skill milestones this week</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MILESTONES.map((m, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1"
                  style={{ animation: m.done ? `milePop 0.5s ease-out ${i * 0.15}s both` : "none" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: m.done ? "linear-gradient(135deg, #C87585, #C27A8A)" : "transparent",
                      border: m.done ? "none" : "1.5px dashed #D4A5B0",
                      color: m.done ? "white" : "#D4A5B0",
                      boxShadow: m.done ? "0 4px 10px rgba(194,122,138,0.3)" : "none",
                    }}
                  >
                    {m.done ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 8, color: m.done ? "#C27A8A" : "#D4A5B0", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                    {m.label}
                  </span>
                </div>
              ))}
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
