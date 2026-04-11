import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Clock, ShieldCheck, FileCheck2, LayoutTemplate, ChevronRight, Zap, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/hooks/use-translation";
import { useLanguageStore } from "@/store/language-store";
import { useQueryClient } from "@tanstack/react-query";

function HomeLanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  return (
    <div
      className="flex items-center rounded-xl overflow-hidden border border-[#F0E4E1] bg-[#FDFAF7]"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className="px-3 py-1.5 text-xs font-bold transition-all"
        style={{
          background: language === "en" ? "#C27A8A" : "transparent",
          color: language === "en" ? "#fff" : "#877870",
        }}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("es")}
        className="px-3 py-1.5 text-xs font-bold transition-all"
        style={{
          background: language === "es" ? "#C27A8A" : "transparent",
          color: language === "es" ? "#fff" : "#877870",
        }}
      >
        ES
      </button>
    </div>
  );
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const t = useT();

  function handleLogout() {
    queryClient.clear();
    logout();
    setLocation("/login");
  }

  const features = [
    {
      icon: LayoutTemplate,
      title: t.home.feature1Title,
      description: t.home.feature1Desc,
    },
    {
      icon: Sparkles,
      title: t.home.feature2Title,
      description: t.home.feature2Desc,
    },
    {
      icon: ShieldCheck,
      title: t.home.feature3Title,
      description: t.home.feature3Desc,
    },
  ];

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-background">

      {/* Floating botanical decorative shapes */}
      <div className="absolute top-32 left-8 w-16 h-16 bg-gradient-to-br from-[#e6b3c0]/30 to-[#C27A8A]/30 rounded-2xl rotate-45 blur-sm pointer-events-none z-0" />
      <div className="absolute top-72 right-16 w-24 h-24 bg-gradient-to-br from-[#d9a3b0]/20 to-[#b06a79]/20 rounded-3xl rotate-12 blur-md pointer-events-none z-0" />

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-lg shadow-[0_4px_10px_rgba(194,122,138,0.25)]"
                style={{ background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-lg" />
              <Sparkles className="w-4 h-4 text-white relative z-10 pop-icon-white" />
            </div>
            <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase pop-text">ABANOTEASSISTANT</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#877870]">
            <span className="text-[#C27A8A]">{t.nav.dashboard}</span>
            <Link href="/notes"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">{t.nav.notes}</span></Link>
            <Link href="/clients"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">{t.nav.clients}</span></Link>
            {user?.role === "super_admin" ? (
              <Link href="/admin"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">{t.nav.admin}</span></Link>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <HomeLanguageToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#877870] hover:text-[#2D2523] hover:bg-[#F0E4E1] transition-all"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.logOut}</span>
            </button>
            <Link href="/wizard">
              <button className="bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:shadow-[0_12px_28px_rgba(194,122,138,0.35)] hover:-translate-y-0.5 flex items-center gap-2">
                {t.nav.newNote} <ChevronRight className="w-4 h-4 pop-icon-white" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero — warm dusty rose gradient ── */}
      <div className="relative pt-24 pb-52 px-6 overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{ background: "linear-gradient(160deg, #C87585 0%, #C06B80 50%, #B05E74 100%)" }}
        >
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#C27A8A] blur-[120px] opacity-15" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#a85468] blur-[120px] opacity-10" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-lg"
          >
            <Zap className="w-4 h-4 text-[#FCEEF1] pop-icon-white" />
            <span className="text-white/90 text-sm font-semibold tracking-wide pop-text-white">{t.home.eyebrow}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-5xl md:text-[64px] leading-[1.08] font-extrabold text-white mb-6 tracking-[-0.03em] pop-text-white whitespace-pre-line"
          >
            {t.home.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg md:text-xl max-w-2xl font-medium leading-relaxed mb-10 pop-text-white"
            style={{ color: "rgba(253,250,247,0.9)" }}
          >
            {t.home.subHeadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16"
          >
            <>
              <Link href="/wizard">
                <button className="w-full sm:w-auto px-8 py-4 bg-white text-[#C27A8A] rounded-full font-bold text-lg shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.3)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 pop-icon" />
                  {t.home.ctaNote}
                </button>
              </Link>
              <Link to="/notes">
                <button className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/30 text-white rounded-full font-bold text-lg hover:bg-white/10 backdrop-blur-sm transition-all flex items-center justify-center gap-2">
                  {t.nav.notes}
                </button>
              </Link>
            </>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-8 text-white/80 text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#FCEEF1] pop-icon-white" />
              <span className="pop-text-white">15 min saved</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#FCEEF1] pop-icon-white" />
              <span className="pop-text-white">{t.home.statAcc}</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#FCEEF1] pop-icon-white" />
              <span className="pop-text-white">5,000+ {t.home.statNotes.toLowerCase()}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Floating wizard card ── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-5xl mx-auto px-6 relative z-20 -mt-32 mb-24"
      >
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 24px 64px rgba(194,122,138,0.14), 0 1px 0 rgba(255,255,255,0.8) inset",
          }}
        >
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#e6b3c0]/15 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[#2D2523] mb-1 tracking-tight">{t.wizard.stepSelectClient}</h2>
                <p className="text-[#877870] text-sm">{t.wizard.selectClientPrompt}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {[1,2,3,4].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all"
                      style={n === 1
                        ? { background: "#C27A8A", color: "#fff", boxShadow: "0 4px 12px rgba(194,122,138,0.3)" }
                        : n === 2
                        ? { background: "#fff", color: "#C27A8A", border: "2px solid #C27A8A" }
                        : { background: "#FDFAF7", color: "#877870" }
                      }
                    >
                      {n}
                    </div>
                    {n < 4 && (
                      <div className="w-10 h-1 rounded-full" style={{ background: n === 1 ? "#C27A8A" : "#F0E4E1" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div
                className="rounded-2xl p-6 relative transition-all"
                style={{ background: "#FDFAF7", border: "2px solid rgba(240,228,225,0.8)" }}
              >
                <p className="text-[#877870] text-sm leading-relaxed">
                  {t.home.wizardCardHint.split("{clients}")[0]}
                  <strong className="text-[#2D2523]">{t.nav.clients}</strong>
                  {t.home.wizardCardHint.split("{clients}")[1]}
                </p>
              </div>
              <Link href="/clients" className="block">
                <div
                  className="rounded-2xl p-6 h-full flex flex-col justify-center cursor-pointer hover:shadow-sm transition-all"
                  style={{ background: "#fff", border: "2px solid #C27A8A" }}
                >
                  <h3 className="font-bold text-[#2D2523] text-lg mb-2">{t.clientDetail.backToClients.replace("← ", "")}</h3>
                  <p className="text-[#877870] text-sm mb-4">{t.home.feature1Desc}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#C27A8A]">
                    {t.nav.clients} <ChevronRight className="w-4 h-4 pop-icon" />
                  </span>
                </div>
              </Link>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-[#F0E4E1]">
              <span className="text-[#877870] font-semibold text-sm">Step 1 of 8</span>
              <Link href="/wizard">
                <button
                  className="text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5"
                  style={{ background: "#C27A8A", boxShadow: "0 8px 20px rgba(194,122,138,0.25)" }}
                >
                  {t.wizard.next} <ChevronRight className="w-5 h-5 pop-icon-white" />
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
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group bg-white rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{
                border: "1px solid rgba(240,228,225,0.6)",
                boxShadow: "0 2px 8px rgba(194,122,138,0.05)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(194,122,138,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(194,122,138,0.05)"; }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 group-hover:bg-[#C27A8A]"
                style={{ background: "#FDFAF7" }}
              >
                <Icon className="w-7 h-7 text-[#C27A8A] group-hover:text-white transition-colors duration-300 pop-icon" />
              </div>
              <h3 className="text-xl font-bold text-[#2D2523] mb-3 tracking-tight">{title}</h3>
              <p className="text-[#877870] leading-relaxed">{description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
