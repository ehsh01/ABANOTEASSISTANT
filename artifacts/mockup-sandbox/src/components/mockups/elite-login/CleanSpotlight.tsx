import { useState, useEffect } from "react";

const NOTE = `Client participated in a 60-min ABA session. DTT conducted across color identification (87%, 21/24 trials), shape matching (64%, 16/25 trials), and manding via PECS (79%, 11/14 trials). Gestural prompting faded successfully on color ID. One episode of task refusal at 35-min mark (22 sec) — redirected with preferred fidget item. No SIB observed. Client demonstrated positive affect throughout. Recommend advancing color ID to independent criterion next session.`;

const TARGETS = [
  { label: "Color ID", pct: 87, prev: 72, color: "#C27A8A" },
  { label: "Manding", pct: 79, prev: 65, color: "#8EA8D8" },
  { label: "Shape Match", pct: 64, prev: 58, color: "#7DC4A0" },
];

const CLIENTS = [
  { initials: "MT", name: "Marcus T.", age: 6, sessions: 14, color: "#C27A8A" },
  { initials: "LR", name: "Lily R.", age: 8, sessions: 22, color: "#8EA8D8" },
  { initials: "JK", name: "Jordan K.", age: 5, sessions: 8, color: "#7DC4A0" },
];

type Tab = "clients" | "session" | "note";

export function CleanSpotlight() {
  const [tab, setTab] = useState<Tab>("clients");
  const [chars, setChars] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const cycle = setInterval(() => {
      setTab(t => {
        if (t === "clients") return "session";
        if (t === "session") {
          setChars(0);
          setTyping(true);
          let i = 0;
          const iv = setInterval(() => {
            i += 7;
            setChars(Math.min(i, NOTE.length));
            if (i >= NOTE.length) { clearInterval(iv); setTyping(false); }
          }, 20);
          return "note";
        }
        return "clients";
      });
    }, 3800);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FDFAF7" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes subtleFloat { 0%,100%{transform:translateY(0) rotate(-0.5deg)} 50%{transform:translateY(-6px) rotate(-0.5deg)} }
        @keyframes barFill { from{width:0} to{width:var(--pct)} }
        @keyframes shimmerText { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes dotBounce { 0%,100%{transform:translateY(0)} 33%{transform:translateY(-4px)} }
      `}</style>

      {/* LEFT — Login */}
      <div className="w-[44%] flex flex-col justify-center px-16 py-14 flex-shrink-0" style={{ borderRight: "1px solid #F0E4E1" }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-14">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)", boxShadow: "0 4px 14px rgba(194,122,138,0.35)" }}>
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="white" />
            </svg>
          </div>
          <span className="font-extrabold tracking-widest text-xs uppercase" style={{ color: "#2D2523", letterSpacing: "0.18em" }}>ABANOTEASSISTANT</span>
        </div>

        {/* Headline */}
        <div className="mb-10">
          <h1 style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1, color: "#2D2523", letterSpacing: "-0.02em", marginBottom: 14 }}>
            Good to see<br />you again.
          </h1>
          <p style={{ color: "#877870", fontSize: 14, lineHeight: 1.7 }}>
            Sign in to generate your session notes and access your client profiles.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-3.5 mb-5">
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#2D2523", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Email
            </label>
            <input className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
              placeholder="yourname@clinic.com"
              style={{ background: "white", border: "1.5px solid #EDE0DC", color: "#2D2523", fontFamily: "inherit", transition: "border-color 0.2s", boxShadow: "0 1px 3px rgba(45,37,35,0.05)" }} />
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#2D2523", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Password
              </label>
              <span style={{ fontSize: 12, color: "#C27A8A", cursor: "pointer", fontWeight: 600 }}>Forgot?</span>
            </div>
            <input type="password" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
              placeholder="••••••••"
              style={{ background: "white", border: "1.5px solid #EDE0DC", color: "#2D2523", fontFamily: "inherit", boxShadow: "0 1px 3px rgba(45,37,35,0.05)" }} />
          </div>
        </div>

        <button className="w-full py-4 rounded-xl text-white font-bold text-sm mb-6"
          style={{ background: "linear-gradient(135deg,#C87585,#A85870)", boxShadow: "0 6px 22px rgba(194,100,120,0.4)", letterSpacing: "0.02em" }}>
          Sign In →
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: "#F0E4E1" }} />
          <span style={{ fontSize: 12, color: "#C4B0AC" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "#F0E4E1" }} />
        </div>

        <button className="w-full py-3.5 rounded-xl font-semibold text-sm mb-8"
          style={{ background: "white", border: "1.5px solid #EDE0DC", color: "#2D2523", boxShadow: "0 1px 4px rgba(45,37,35,0.06)" }}>
          Create a free account
        </button>

        {/* Trust signals */}
        <div className="flex items-center gap-4">
          {[["🔒", "Private & secure"], ["✦", "For RBTs & BCBAs"], ["⚡", "30-sec notes"]].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span style={{ fontSize: 10 }}>{icon}</span>
              <span style={{ fontSize: 11, color: "#C4B0AC", fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Product showcase */}
      <div className="flex-1 flex flex-col" style={{ background: "#F8F3F0" }}>
        {/* Tab nav */}
        <div className="flex items-center gap-1 px-10 pt-10 pb-6">
          {(["clients", "session", "note"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer"
              style={{
                background: t === tab ? "white" : "transparent",
                color: t === tab ? "#2D2523" : "#C4B0AC",
                boxShadow: t === tab ? "0 2px 8px rgba(45,37,35,0.08)" : "none",
              }}>
              {t === "clients" ? "👶 Clients" : t === "session" ? "📊 Session" : "⚡ Note"}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#7DC4A0", animation: "dotBounce 1.2s ease-in-out 0s infinite" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "#7DC4A0", animation: "dotBounce 1.2s ease-in-out 0.15s infinite" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "#7DC4A0", animation: "dotBounce 1.2s ease-in-out 0.3s infinite" }} />
            <span style={{ fontSize: 11, color: "#7DC4A0", fontWeight: 700, marginLeft: 4 }}>Live Preview</span>
          </div>
        </div>

        {/* Panel */}
        <div className="flex-1 px-10 pb-10">
          <div className="h-full rounded-2xl overflow-hidden" style={{ background: "white", boxShadow: "0 8px 40px rgba(45,37,35,0.1)", border: "1px solid #EDE0DC" }}>

            {/* Chrome */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#2D2523", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["#FF5F56","#FFBD2E","#27C93F"].map((c,i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              <div className="flex-1 mx-3 px-3 py-1 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", maxWidth: 300 }}>
                {tab === "clients" ? "abanoteassistant.app/clients" : tab === "session" ? "abanoteassistant.app/wizard" : "abanoteassistant.app/notes/draft"}
              </div>
            </div>

            {/* Content */}
            <div className="p-7" style={{ animation: "slideIn 0.35s ease-out both" }} key={tab}>

              {tab === "clients" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#2D2523" }}>Your Clients</h2>
                      <p style={{ fontSize: 12, color: "#877870", marginTop: 2 }}>3 active · Next session in 22 min</p>
                    </div>
                    <button className="px-4 py-2 rounded-xl text-white text-xs font-bold"
                      style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)" }}>+ Add Client</button>
                  </div>
                  <div className="space-y-3">
                    {CLIENTS.map((c, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer"
                        style={{ background: i === 0 ? "#FFF8F5" : "#FDFAF7", border: `1.5px solid ${i === 0 ? "#F0C8C8" : "#F0E4E1"}` }}>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                          style={{ background: `linear-gradient(135deg,${c.color}99,${c.color})` }}>{c.initials}</div>
                        <div className="flex-1">
                          <p style={{ fontWeight: 700, fontSize: 14, color: "#2D2523" }}>{c.name}</p>
                          <p style={{ fontSize: 12, color: "#877870" }}>Age {c.age} · ASD · {c.sessions} sessions logged</p>
                        </div>
                        {i === 0 && <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: "#FCEEF1", color: "#C27A8A" }}>Next up</span>}
                        <span style={{ color: "#C4B0AC", fontSize: 18 }}>›</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "session" && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm"
                      style={{ background: "linear-gradient(135deg,#e6b3c0,#C27A8A)" }}>MT</div>
                    <div>
                      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2D2523" }}>Marcus T. · March 21, 2026</h2>
                      <p style={{ fontSize: 12, color: "#877870" }}>60-minute DTT session</p>
                    </div>
                  </div>

                  <p style={{ fontSize: 11, fontWeight: 700, color: "#877870", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Program Performance</p>
                  <div className="space-y-4 mb-6">
                    {TARGETS.map((t, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-1.5">
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#2D2523" }}>{t.label}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 12, color: "#877870" }}>{t.prev}% →</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.pct}%</span>
                            <span style={{ fontSize: 11, color: "#7DC4A0", fontWeight: 700 }}>+{t.pct - t.prev}%</span>
                          </div>
                        </div>
                        <div style={{ height: 8, background: "#F0E4E1", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${t.pct}%`, background: `linear-gradient(90deg,${t.color}80,${t.color})`, borderRadius: 999, transition: "width 1s ease-out" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="px-6 py-3 rounded-xl text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)", boxShadow: "0 4px 14px rgba(194,122,138,0.38)" }}>
                    ✦ Generate Clinical Note
                  </button>
                </div>
              )}

              {tab === "note" && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2D2523" }}>Clinical Session Note</h2>
                      <p style={{ fontSize: 12, color: "#877870" }}>Marcus T. · March 21, 2026 · Generated by AI</p>
                    </div>
                    {typing && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                        style={{ background: "#FCEEF1", color: "#C27A8A", animation: "shimmerText 1s ease-in-out infinite" }}>
                        ✦ Writing...
                      </span>
                    )}
                    {!typing && chars >= NOTE.length && (
                      <div className="flex gap-2" style={{ animation: "fadeIn 0.4s ease-out both" }}>
                        <button className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#F0E4E1", color: "#877870" }}>Copy</button>
                        <button className="px-3 py-1.5 rounded-xl text-white text-xs font-bold" style={{ background: "linear-gradient(135deg,#C87585,#C27A8A)" }}>Save</button>
                      </div>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl" style={{ background: "#FDFAF7", border: "1.5px solid #F0E4E1", minHeight: 180 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.85, color: "#2D2523" }}>
                      {NOTE.slice(0, chars)}
                      {typing && <span style={{ borderRight: "2px solid #C27A8A", marginLeft: 1, animation: "blink 0.7s ease-in-out infinite" }}>&nbsp;</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
