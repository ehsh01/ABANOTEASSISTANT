import React, { useState, useEffect } from 'react';
import { Sparkles, LayoutTemplate, ShieldCheck, Clock, CheckCircle2, FileText, Globe } from 'lucide-react';

export default function ForestSage() {
  useEffect(() => {
    const link1 = document.createElement('link');
    link1.rel = 'preconnect';
    link1.href = 'https://fonts.googleapis.com';
    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = 'true';
    const link3 = document.createElement('link');
    link3.rel = 'stylesheet';
    link3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    
    document.head.appendChild(link1);
    document.head.appendChild(link2);
    document.head.appendChild(link3);
    
    return () => {
      document.head.removeChild(link1);
      document.head.removeChild(link2);
      document.head.removeChild(link3);
    };
  }, []);

  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const preventDefault = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div style={{ fontFamily: '"Inter", sans-serif', backgroundColor: '#F6F7F4' }} className="min-h-screen w-full text-[#4B6358] overflow-x-hidden">
      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FFFFFF] border-b border-[#E4EAE0] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="#" onClick={preventDefault} className="flex items-center gap-2 text-[#1A2E1A] font-bold text-lg tracking-tight">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#166534] to-[#15803D] text-white">
              <Sparkles size={18} />
            </div>
            ABANOTEASSISTANT
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#" onClick={preventDefault} className="text-[#166534]">Dashboard</a>
            <a href="#" onClick={preventDefault} className="text-[#4B6358] hover:text-[#1A2E1A] transition-colors">Notes</a>
            <a href="#" onClick={preventDefault} className="text-[#4B6358] hover:text-[#1A2E1A] transition-colors">Clients</a>
            <a href="#" onClick={preventDefault} className="text-[#4B6358] hover:text-[#1A2E1A] transition-colors">Admin</a>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={preventDefault} className="flex items-center gap-1 text-sm font-medium text-[#4B6358] hover:text-[#1A2E1A] transition-colors">
            <Globe size={16} />
            EN / ES
          </button>
          <div className="flex items-center gap-4">
            <a href="#" onClick={preventDefault} className="text-sm font-medium text-[#4B6358] hover:text-[#1A2E1A] transition-colors">Log out</a>
            <button onClick={preventDefault} className="bg-[#166534] text-white text-sm font-medium px-4 py-2 rounded-full transition-transform hover:scale-105 active:scale-95" style={{ boxShadow: '0 4px 12px rgba(22,101,52,0.22)' }}>
              New Note →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-48 px-6 text-center" style={{ background: 'linear-gradient(145deg, #052E16 0%, #14532D 50%, #166534 100%)' }}>
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-white/90 text-sm font-medium mb-8 backdrop-blur-sm">
            ⚡ AI-Powered ABA Documentation
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6 whitespace-pre-line">
            {'Session notes written\nin seconds.'}
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
            Upload your client's behavior intervention plan and let the AI do the rest — clinical notes that meet compliance standards, every time.
          </p>
          <div className="flex items-center gap-4 mb-16">
            <button onClick={preventDefault} className="bg-white text-[#166534] font-semibold px-8 py-3.5 rounded-full hover:bg-opacity-90 transition-all hover:scale-105 active:scale-95">
              ✦ Generate a Note
            </button>
            <button onClick={preventDefault} className="bg-transparent border border-white/30 text-white font-medium px-8 py-3.5 rounded-full hover:bg-white/10 transition-all">
              Notes
            </button>
          </div>
          
          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 items-center">
            <div className="flex items-center gap-3">
              <Clock className="text-[#BBF7D0]" size={24} />
              <span className="text-white/80 font-medium">15 min saved</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#BBF7D0]" size={24} />
              <span className="text-white/80 font-medium">Compliance Rate</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="text-[#BBF7D0]" size={24} />
              <span className="text-white/80 font-medium">5,000+ notes generated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 -mt-32 relative z-10 pb-24">
        {/* Wizard Card */}
        <div 
          className="bg-white w-full rounded-[2rem] p-8 md:p-12 mb-16 relative overflow-hidden"
          style={{
            boxShadow: '0 40px 100px rgba(22,101,52, 0.18), 0 8px 32px rgba(22,101,52, 0.10), 0 2px 0 rgba(255,255,255,0.9) inset',
            backdropFilter: 'blur(32px)'
          }}
        >
          {/* Inner Glow Blob */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#22C55E] opacity-10 blur-[80px] rounded-full pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-6">
              <div>
                <h2 className="text-2xl font-bold text-[#1A2E1A] mb-2">Select Client</h2>
                <p className="text-[#4B6358]">Choose a client to generate a session note for.</p>
              </div>
              
              {/* Stepper */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#166534] text-white flex items-center justify-center text-sm font-bold">1</div>
                <div className="w-8 h-0.5 bg-[#166534]"></div>
                <div className="w-8 h-8 rounded-full bg-white border-2 border-[#166534] text-[#166534] flex items-center justify-center text-sm font-bold">2</div>
                <div className="w-8 h-0.5 bg-[#DCFCE7]"></div>
                <div className="w-8 h-8 rounded-full bg-[#F0FDF4] text-[#94A3B8] flex items-center justify-center text-sm font-bold">3</div>
                <div className="w-8 h-0.5 bg-[#DCFCE7]"></div>
                <div className="w-8 h-8 rounded-full bg-[#F0FDF4] text-[#94A3B8] flex items-center justify-center text-sm font-bold">4</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-10">
              {/* Left Sub-card */}
              <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-6 flex items-start gap-4">
                <p className="text-[#4B6358] text-sm leading-relaxed">
                  After you add clients under Clients, they appear here in the wizard so you can generate notes. Data is private to your company.
                </p>
              </div>

              {/* Right Sub-card */}
              <div className="bg-white border border-[#E4EAE0] border-l-4 border-l-[#166534] rounded-2xl p-6 shadow-sm">
                <h3 className="text-[#1A2E1A] font-semibold mb-2">Back to Clients</h3>
                <p className="text-[#4B6358] text-sm leading-relaxed mb-4">
                  Upload your client's assessment once. The AI references their exact programs, behaviors, and goals every time.
                </p>
                <a href="#" onClick={preventDefault} className="text-[#166534] font-medium text-sm hover:underline">
                  Clients →
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-[#E4EAE0]">
              <span className="text-[#4B6358] font-medium text-sm">Step 1 of 8</span>
              <button onClick={preventDefault} className="bg-[#166534] text-white font-medium px-6 py-2.5 rounded-full transition-transform hover:scale-105 active:scale-95" style={{ boxShadow: '0 4px 12px rgba(22,101,52,0.28)' }}>
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <LayoutTemplate size={24} />,
              title: "ABA Note Types",
              desc: "Every DTT, NET, and behavior support note format — built in."
            },
            {
              icon: <Sparkles size={24} />,
              title: "Smart Programs",
              desc: "AI reads your client's BIP programs and maps behaviors automatically."
            },
            {
              icon: <ShieldCheck size={24} />,
              title: "Instant Generation",
              desc: "From client selection to compliant session note in under 60 seconds."
            }
          ].map((feature, idx) => (
            <div 
              key={idx}
              className="bg-white border rounded-2xl p-8 cursor-pointer"
              style={{
                borderColor: '#E4EAE0',
                boxShadow: hoveredFeature === idx ? '0 24px 64px rgba(22,101,52, 0.15)' : '0 4px 16px rgba(22,101,52, 0.07)',
                transform: hoveredFeature === idx ? 'translateY(-4px)' : 'translateY(0)',
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={() => setHoveredFeature(idx)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors duration-250"
                style={{
                  backgroundColor: hoveredFeature === idx ? '#166534' : '#DCFCE7',
                  color: hoveredFeature === idx ? 'white' : '#166534'
                }}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-[#1A2E1A] mb-3">{feature.title}</h3>
              <p className="text-[#4B6358] leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
