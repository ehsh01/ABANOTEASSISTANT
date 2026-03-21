export function StarChart() {
  const stars = [
    { size: 28, x: 8, y: 12, delay: 0, dur: 6 },
    { size: 18, x: 18, y: 55, delay: 1.2, dur: 7 },
    { size: 22, x: 30, y: 25, delay: 0.5, dur: 5 },
    { size: 14, x: 42, y: 72, delay: 2.1, dur: 8 },
    { size: 32, x: 55, y: 8, delay: 0.8, dur: 6.5 },
    { size: 16, x: 65, y: 40, delay: 1.7, dur: 7.5 },
    { size: 24, x: 75, y: 68, delay: 0.3, dur: 5.5 },
    { size: 20, x: 85, y: 20, delay: 2.4, dur: 6 },
    { size: 12, x: 92, y: 55, delay: 1.0, dur: 9 },
    { size: 26, x: 5, y: 80, delay: 1.8, dur: 7 },
    { size: 18, x: 48, y: 90, delay: 0.6, dur: 8 },
    { size: 14, x: 70, y: 88, delay: 2.8, dur: 6 },
    { size: 20, x: 22, y: 88, delay: 1.4, dur: 7 },
    { size: 16, x: 88, y: 82, delay: 0.9, dur: 5.5 },
  ];

  const tokenStars = [
    { filled: true, x: 12, y: 16, delay: 0 },
    { filled: true, x: 20, y: 16, delay: 0.3 },
    { filled: true, x: 28, y: 16, delay: 0.6 },
    { filled: false, x: 36, y: 16, delay: 0 },
    { filled: false, x: 44, y: 16, delay: 0 },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center"
      style={{ background: "#FDFAF7", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes floatStar {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
          33% { transform: translateY(-18px) rotate(10deg); opacity: 1; }
          66% { transform: translateY(-8px) rotate(-6deg); opacity: 0.85; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes tokenPop {
          0% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes drift {
          0%, 100% { transform: translateX(0px) translateY(0px); }
          25% { transform: translateX(6px) translateY(-10px); }
          50% { transform: translateX(-4px) translateY(-6px); }
          75% { transform: translateX(8px) translateY(-14px); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
      `}</style>

      {/* Background stars */}
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute pointer-events-none select-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animation: `floatStar ${s.dur}s ease-in-out ${s.delay}s infinite`,
            zIndex: 0,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path
              d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"
              fill={i % 3 === 0 ? "#C27A8A" : i % 3 === 1 ? "#E8B4B8" : "#F7D6A8"}
              style={{ filter: `drop-shadow(0 2px 6px ${i % 3 === 0 ? "rgba(194,122,138,0.4)" : i % 3 === 1 ? "rgba(232,180,184,0.4)" : "rgba(247,214,168,0.4)"}` }}
            />
          </svg>
        </div>
      ))}

      {/* Small sparkle dots scattered */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`dot-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${(i * 17 + 3) % 95}%`,
            top: `${(i * 23 + 7) % 90}%`,
            width: i % 3 === 0 ? 6 : 4,
            height: i % 3 === 0 ? 6 : 4,
            background: i % 4 === 0 ? "#C27A8A" : i % 4 === 1 ? "#E8B4B8" : i % 4 === 2 ? "#F7D6A8" : "#D4A5B0",
            animation: `shimmer ${3 + (i % 4)}s ease-in-out ${(i * 0.4) % 3}s infinite`,
            opacity: 0.5,
          }}
        />
      ))}

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-sm mx-6 rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 60px rgba(194,122,138,0.18), 0 4px 20px rgba(0,0,0,0.06)",
          border: "1px solid rgba(240,228,225,0.8)",
        }}
      >
        {/* Card top accent */}
        <div style={{ height: 5, background: "linear-gradient(90deg, #C87585, #E8B4B8, #F7D6A8, #E8B4B8, #C87585)" }} />

        <div className="px-8 pt-8 pb-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)",
                boxShadow: "0 8px 20px rgba(194,122,138,0.35)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" />
              </svg>
            </div>
            <span
              className="font-extrabold tracking-widest uppercase text-sm"
              style={{ color: "#2D2523", letterSpacing: "0.18em", textShadow: "0 2px 3px rgba(0,0,0,0.1)" }}
            >
              ABANOTEASSISTANT
            </span>
            <p className="text-xs mt-1 font-medium" style={{ color: "#877870" }}>Sign in to your account</p>
          </div>

          {/* Token star chart */}
          <div
            className="rounded-xl px-4 py-3 mb-6 flex items-center justify-between"
            style={{ background: "#FFF8F5", border: "1px solid #F0E4E1" }}
          >
            <span className="text-xs font-semibold" style={{ color: "#877870" }}>Today's progress</span>
            <div className="flex gap-1.5">
              {tokenStars.map((s, i) => (
                <svg
                  key={i}
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  style={{ animation: s.filled ? `tokenPop 2s ease-in-out ${s.delay}s infinite` : "none" }}
                >
                  <path
                    d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"
                    fill={s.filled ? "#C27A8A" : "none"}
                    stroke={s.filled ? "#C27A8A" : "#D4A5B0"}
                    strokeWidth={s.filled ? 0 : 1.5}
                  />
                </svg>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#2D2523" }}>Email</label>
              <input
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
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
            className="w-full mt-6 py-3.5 rounded-xl text-white text-sm font-bold tracking-wide transition-all"
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
