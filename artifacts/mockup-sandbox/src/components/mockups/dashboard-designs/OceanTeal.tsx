import React, { useEffect, useState } from "react";
import { Sparkles, Clock, CheckCircle2, FileText, LayoutTemplate, ShieldCheck } from "lucide-react";

export default function OceanTeal() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const preventDefault = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#F5F8FA" }} className="min-h-screen w-full overflow-x-hidden text-[#64748B]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b" style={{ borderColor: "#E2ECF0" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <a href="#" onClick={preventDefault} className="flex items-center gap-2 group">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold" style={{ background: "linear-gradient(135deg, #0891B2, #0E7490)" }}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="font-bold tracking-tight text-[#1E293B]">ABANOTEASSISTANT</span>
              </a>
              
              <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                <a href="#" onClick={preventDefault} className="text-[#64748B] hover:text-[#1E293B] transition-colors">Dashboard</a>
                <a href="#" onClick={preventDefault} className="text-[#0E7490]">Notes</a>
                <a href="#" onClick={preventDefault} className="text-[#64748B] hover:text-[#1E293B] transition-colors">Clients</a>
                <a href="#" onClick={preventDefault} className="text-[#64748B] hover:text-[#1E293B] transition-colors">Admin</a>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1 text-xs font-semibold text-[#64748B]">
                <a href="#" onClick={preventDefault} className="text-[#1E293B]">EN</a>
                <span>/</span>
                <a href="#" onClick={preventDefault} className="hover:text-[#1E293B]">ES</a>
              </div>
              <div className="h-4 w-px" style={{ backgroundColor: "#E2ECF0" }}></div>
              <a href="#" onClick={preventDefault} className="text-sm font-medium text-[#64748B] hover:text-[#1E293B]">Log out</a>
              <a 
                href="#" 
                onClick={preventDefault} 
                className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "#0E7490", boxShadow: "0 4px 12px rgba(14,116,144,0.25)" }}
              >
                New Note →
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div 
        className="pt-24 pb-48 px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0C4A6E 0%, #0369A1 45%, #0891B2 100%)" }}
      >
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center px-3 py-1.5 rounded-full mb-8" style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>⚡ AI-Powered ABA Documentation</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight whitespace-pre-line leading-tight">
            {"Session notes written\nin seconds."}
          </h1>
          
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            Upload your client's behavior intervention plan and let the AI do the rest — clinical notes that meet compliance standards, every time.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a 
              href="#" 
              onClick={preventDefault}
              className="px-8 py-3.5 rounded-full font-semibold bg-white transition-transform hover:scale-105"
              style={{ color: "#0891B2" }}
            >
              ✦ Generate a Note
            </a>
            <a 
              href="#" 
              onClick={preventDefault}
              className="px-8 py-3.5 rounded-full font-semibold transition-all hover:bg-white/10"
              style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
            >
              Notes
            </a>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 pt-8 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: "#BAE6FD" }} />
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>15 min saved</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: "#BAE6FD" }} />
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>Compliance Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: "#BAE6FD" }} />
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>5,000+ notes generated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Wizard Card */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-20 mb-24">
        <div 
          className="bg-white relative overflow-hidden flex flex-col"
          style={{ 
            boxShadow: "0 40px 100px rgba(8,145,178, 0.18), 0 8px 32px rgba(8,145,178, 0.10), 0 2px 0 rgba(255,255,255,0.9) inset",
            backdropFilter: "blur(32px)",
            borderRadius: "2rem",
            minHeight: "400px"
          }}
        >
          {/* Inner top glow blob */}
          <div 
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full pointer-events-none"
            style={{ backgroundColor: "#0891B2", filter: "blur(80px)", opacity: 0.15 }}
          ></div>

          {/* Card Header & Stepper */}
          <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[#1E293B]">Select Client</h2>
              <p className="text-[#64748B]">Choose a client to generate a session note for.</p>
            </div>
            
            {/* Stepper */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white" style={{ backgroundColor: "#0E7490" }}>1</div>
              <div className="w-8 h-px" style={{ backgroundColor: "#0E7490" }}></div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-white" style={{ border: "2px solid #0E7490", color: "#0E7490" }}>2</div>
              <div className="w-8 h-px" style={{ backgroundColor: "#E0F2FE" }}></div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold" style={{ backgroundColor: "#F0F9FF", color: "#94A3B8" }}>3</div>
              <div className="w-8 h-px" style={{ backgroundColor: "#E0F2FE" }}></div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold" style={{ backgroundColor: "#F0F9FF", color: "#94A3B8" }}>4</div>
            </div>
          </div>

          {/* Card Body - Two Sub-cards */}
          <div className="p-8 grid md:grid-cols-2 gap-6 flex-grow relative z-10">
            {/* Left Sub-card */}
            <div className="p-6 rounded-2xl flex flex-col justify-center items-center text-center" style={{ backgroundColor: "#F0F9FF", border: "1px dashed #E0F2FE" }}>
              <p className="text-sm text-[#64748B] max-w-sm leading-relaxed">
                After you add clients under Clients, they appear here in the wizard so you can generate notes. Data is private to your company.
              </p>
            </div>

            {/* Right Sub-card */}
            <div className="p-6 rounded-2xl shadow-sm relative overflow-hidden" style={{ backgroundColor: "white", border: "1px solid #E2ECF0", borderLeft: "4px solid #0E7490" }}>
              <h3 className="font-semibold text-lg text-[#1E293B] mb-2">Back to Clients</h3>
              <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
                Upload your client's assessment once. The AI references their exact programs, behaviors, and goals every time.
              </p>
              <a href="#" onClick={preventDefault} className="text-sm font-semibold inline-flex items-center transition-opacity hover:opacity-80" style={{ color: "#0E7490" }}>
                Clients →
              </a>
            </div>
          </div>

          {/* Card Footer */}
          <div className="p-6 md:px-8 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 relative z-10 rounded-b-[2rem]">
            <span className="text-sm font-medium" style={{ color: "#64748B" }}>Step 1 of 8</span>
            <a 
              href="#" 
              onClick={preventDefault}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#0E7490", boxShadow: "0 4px 14px rgba(14,116,144,0.3)" }}
            >
              Next →
            </a>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: LayoutTemplate,
              title: "ABA Note Types",
              desc: "Every DTT, NET, and behavior support note format — built in."
            },
            {
              icon: Sparkles,
              title: "Smart Programs",
              desc: "AI reads your client's BIP programs and maps behaviors automatically."
            },
            {
              icon: ShieldCheck,
              title: "Instant Generation",
              desc: "From client selection to compliant session note in under 60 seconds."
            }
          ].map((feature, i) => (
            <div 
              key={i}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}
              className="bg-white rounded-2xl p-8 transition-all duration-300"
              style={{
                border: "1px solid #E0F2FE",
                boxShadow: hoveredCard === i ? "0 24px 64px rgba(8,145,178, 0.15)" : "0 4px 16px rgba(8,145,178, 0.07)",
                transform: hoveredCard === i ? "translateY(-4px)" : "none"
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300"
                style={{ 
                  backgroundColor: hoveredCard === i ? "#0E7490" : "#E0F2FE",
                  color: hoveredCard === i ? "white" : "#0E7490"
                }}
              >
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[#1E293B]">{feature.title}</h3>
              <p className="text-[#64748B] leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
