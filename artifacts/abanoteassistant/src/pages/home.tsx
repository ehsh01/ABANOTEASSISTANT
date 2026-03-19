import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Clock, ShieldCheck, FileCheck2, LayoutTemplate, ChevronRight, CheckCircle2, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-background">

      {/* Floating crystal decorative shapes */}
      <div className="absolute top-32 left-8 w-16 h-16 bg-gradient-to-br from-[#C4B5E8]/30 to-[#6B3FA0]/30 rounded-2xl rotate-45 blur-sm pointer-events-none z-0" />
      <div className="absolute top-72 right-16 w-24 h-24 bg-gradient-to-br from-[#9B6FD4]/20 to-[#4A2080]/20 rounded-3xl rotate-12 blur-md pointer-events-none z-0" />

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#C4B5E8]/30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-[#9B6FD4] to-[#6B3FA0] rounded-lg rotate-45 shadow-[0_4px_10px_rgba(107,63,160,0.3)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-lg rotate-45" />
              <Sparkles className="w-4 h-4 text-white relative z-10" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#1A1A2E]">ABA Note Assistant</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#5E5A7A]">
            <span className="text-[#6B3FA0]">Dashboard</span>
            <span className="hover:text-[#1A1A2E] transition-colors cursor-pointer">Notes</span>
            <span className="hover:text-[#1A1A2E] transition-colors cursor-pointer">Clients</span>
          </div>

          <Link href="/wizard">
            <button className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_8px_20px_rgba(107,63,160,0.25)] hover:shadow-[0_12px_28px_rgba(107,63,160,0.35)] hover:-translate-y-0.5 flex items-center gap-2">
              New Note <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero — purple gradient ── */}
      <div className="relative pt-24 pb-52 px-6 overflow-hidden">
        {/* Hero background */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: "linear-gradient(135deg, #4A2080 0%, #9B6FD4 100%)" }}
        >
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#6B3FA0] blur-[120px] mix-blend-screen opacity-60" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#C4B5E8] blur-[120px] mix-blend-screen opacity-40" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center flex flex-col items-center">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-lg"
          >
            <Zap className="w-4 h-4 text-[#C4B5E8]" />
            <span className="text-white/90 text-sm font-semibold tracking-wide">AI-Powered Documentation</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-5xl md:text-[64px] leading-[1.08] font-extrabold text-white mb-6 tracking-[-0.03em]"
          >
            Your notes,{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #ffffff 0%, #C4B5E8 100%)" }}
            >
              written in seconds.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg md:text-xl max-w-2xl font-medium leading-relaxed mb-10"
            style={{ color: "rgba(246,243,252,0.9)" }}
          >
            Guide through a smart checklist and receive complete, professional ABA session notes — instantly generated and ready to submit.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16"
          >
            <Link href="/wizard">
              <button className="w-full sm:w-auto px-8 py-4 bg-white text-[#6B3FA0] rounded-full font-bold text-lg shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.3)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Generate Note
              </button>
            </Link>
            <button className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/30 text-white rounded-full font-bold text-lg hover:bg-white/10 backdrop-blur-sm transition-all flex items-center justify-center gap-2">
              View Past Notes
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-8 text-white/80 text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#C4B5E8]" />
              <span>15 min saved</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C4B5E8]" />
              <span>Compliant notes</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#C4B5E8]" />
              <span>5,000+ notes written</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Floating glassmorphism wizard card ── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-5xl mx-auto px-6 relative z-20 -mt-32 mb-24"
      >
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 24px 64px rgba(107,63,160,0.16), 0 1px 0 rgba(255,255,255,0.8) inset",
          }}
        >
          {/* Subtle glow behind card */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#C4B5E8]/20 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            {/* Wizard header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A2E] mb-1 tracking-tight">Select Client</h2>
                <p className="text-[#5E5A7A] text-sm">Who is this session note for?</p>
              </div>
              {/* Progress steps */}
              <div className="hidden sm:flex items-center gap-2">
                {[1,2,3,4].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all"
                      style={n === 1
                        ? { background: "#6B3FA0", color: "#fff", boxShadow: "0 4px 12px rgba(107,63,160,0.3)" }
                        : n === 2
                        ? { background: "#fff", color: "#6B3FA0", border: "2px solid #6B3FA0" }
                        : { background: "#F6F3FC", color: "#5E5A7A" }
                      }
                    >
                      {n}
                    </div>
                    {n < 4 && (
                      <div className="w-10 h-1 rounded-full" style={{ background: n === 1 ? "#6B3FA0" : "#C4B5E8" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Client cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div
                className="rounded-2xl p-6 cursor-pointer relative transition-all"
                style={{ background: "#F6F3FC", border: "2px solid #6B3FA0" }}
              >
                <div className="absolute top-4 right-4 text-[#6B3FA0]">
                  <CheckCircle2 className="w-6 h-6" style={{ fill: "#6B3FA0", color: "#fff" }} />
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-[#6B3FA0]" style={{ background: "rgba(107,63,160,0.1)" }}>JR</div>
                  <div>
                    <h3 className="font-bold text-[#1A1A2E] text-lg">James R.</h3>
                    <p className="text-[#5E5A7A] text-sm">7 yrs • Clinic Session</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[#6B3FA0] bg-white px-3 py-1.5 rounded-lg border border-[#C4B5E8]/50">
                  <Clock className="w-3.5 h-3.5" /> Last session: Yesterday
                </div>
              </div>

              <div
                className="rounded-2xl p-6 cursor-pointer hover:shadow-sm transition-all"
                style={{ background: "#fff", border: "2px solid rgba(196,181,232,0.3)" }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg text-[#5E5A7A]">SM</div>
                  <div>
                    <h3 className="font-bold text-[#1A1A2E] text-lg">Sophia M.</h3>
                    <p className="text-[#5E5A7A] text-sm">4 yrs • Home Session</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[#5E5A7A] bg-gray-50 px-3 py-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5" /> Last session: 3 days ago
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <span className="text-[#5E5A7A] font-semibold text-sm">Step 1 of 8</span>
              <Link href="/wizard">
                <button
                  className="text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5"
                  style={{ background: "#6B3FA0", boxShadow: "0 8px 20px rgba(107,63,160,0.25)" }}
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Features grid ── */}
      <div className="max-w-7xl mx-auto px-6 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {[
            {
              icon: LayoutTemplate,
              title: "Guided Wizard",
              description: "Answer simple questions about the session. Our intuitive flow ensures you never miss a required detail.",
            },
            {
              icon: Sparkles,
              title: "AI-Written Notes",
              description: "Transform brief observations into fully articulated, professional narratives that capture clinical progress perfectly.",
            },
            {
              icon: ShieldCheck,
              title: "Instant Compliance",
              description: "Notes are structured to meet insurance requirements automatically, reducing rejection risks and audit anxiety.",
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group bg-white rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{
                border: "1px solid rgba(196,181,232,0.3)",
                boxShadow: "0 2px 8px rgba(107,63,160,0.04)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(107,63,160,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(107,63,160,0.04)"; }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 group-hover:bg-[#6B3FA0]"
                style={{ background: "#F6F3FC" }}
              >
                <Icon className="w-7 h-7 text-[#6B3FA0] group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A2E] mb-3 tracking-tight">{title}</h3>
              <p className="text-[#5E5A7A] leading-relaxed">{description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
