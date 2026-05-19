import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  FileText, 
  LayoutTemplate, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';

export default function WarmStone() {
  useEffect(() => {
    // Inject Google Font
    const link1 = document.createElement('link');
    link1.rel = 'preconnect';
    link1.href = 'https://fonts.googleapis.com';
    
    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = 'anonymous';
    
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

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const preventDefault = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div 
      className="min-h-screen w-full font-['Inter',_sans-serif]"
      style={{ backgroundColor: '#FAF9F7' }}
    >
      {/* Sticky Navbar */}
      <nav 
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #EAE6DF' }}
      >
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 font-bold text-[#1C1008] tracking-tight">
            <div 
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)' }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            ABANOTEASSISTANT
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#" onClick={preventDefault} style={{ color: '#78350F' }}>Dashboard</a>
            <a href="#" onClick={preventDefault} style={{ color: '#78716C' }} className="hover:text-[#1C1008] transition-colors">Notes</a>
            <a href="#" onClick={preventDefault} style={{ color: '#78716C' }} className="hover:text-[#1C1008] transition-colors">Clients</a>
            <a href="#" onClick={preventDefault} style={{ color: '#78716C' }} className="hover:text-[#1C1008] transition-colors">Admin</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm font-medium" style={{ color: '#78716C' }}>
            <span style={{ color: '#1C1008' }}>EN</span> / ES
          </div>
          <div className="w-px h-4 bg-[#EAE6DF]"></div>
          <a href="#" onClick={preventDefault} className="text-sm font-medium hover:text-[#1C1008] transition-colors" style={{ color: '#78716C' }}>Log out</a>
          <button 
            onClick={preventDefault}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ 
              backgroundColor: '#78350F', 
              color: 'white',
              boxShadow: '0 4px 12px rgba(120,53,15,0.22)'
            }}
          >
            New Note <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative pt-24 pb-48 px-6 text-center"
        style={{ 
          background: 'linear-gradient(145deg, #1C1008 0%, #431407 50%, #78350F 100%)'
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <div 
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-8"
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.9)'
            }}
          >
            ⚡ AI-Powered ABA Documentation
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6 whitespace-pre-line">
            {'Session notes written\nin seconds.'}
          </h1>
          
          <p 
            className="text-lg md:text-xl max-w-2xl mb-10 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.82)' }}
          >
            Upload your client's behavior intervention plan and let the AI do the rest — clinical notes that meet compliance standards, every time.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <button 
              onClick={preventDefault}
              className="px-8 py-3.5 rounded-full font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
              style={{ backgroundColor: 'white', color: '#78350F' }}
            >
              ✦ Generate a Note
            </button>
            <button 
              onClick={preventDefault}
              className="px-8 py-3.5 rounded-full font-semibold transition-all hover:bg-white/10"
              style={{ 
                backgroundColor: 'transparent', 
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white' 
              }}
            >
              Notes
            </button>
          </div>

          <div className="flex items-center justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: '#FDE68A' }} />
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>15 min saved</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: '#FDE68A' }} />
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Compliance Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: '#FDE68A' }} />
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>5,000+ notes generated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Wizard Card */}
      <section className="max-w-5xl mx-auto px-6 relative z-10 -mt-32 mb-20">
        <div 
          className="relative overflow-hidden"
          style={{
            backgroundColor: 'white',
            borderRadius: '2rem',
            boxShadow: '0 40px 100px rgba(120,53,15,0.18), 0 8px 32px rgba(120,53,15,0.10), 0 2px 0 rgba(255,255,255,0.9) inset',
            backdropFilter: 'blur(32px)'
          }}
        >
          {/* Inner Glow Blob */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 rounded-full pointer-events-none"
            style={{
              backgroundColor: '#F59E0B',
              filter: 'blur(80px)',
              opacity: 0.15
            }}
          />

          <div className="relative p-8 md:p-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#1C1008' }}>Select Client</h2>
                <p style={{ color: '#78716C' }}>Choose a client to generate a session note for.</p>
              </div>

              {/* Stepper */}
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-sm" style={{ backgroundColor: '#78350F', color: 'white' }}>1</div>
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: '#78350F' }}></div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2" style={{ backgroundColor: 'white', borderColor: '#78350F', color: '#78350F' }}>2</div>
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: '#FEF3C7' }}></div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold" style={{ backgroundColor: '#FFFBEB', color: '#94A3B8' }}>3</div>
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: '#FEF3C7' }}></div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold" style={{ backgroundColor: '#FFFBEB', color: '#94A3B8' }}>4</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <div 
                className="p-6 rounded-2xl border"
                style={{ backgroundColor: '#FFFBEB', borderColor: 'rgba(253,230,138,0.5)' }}
              >
                <p className="leading-relaxed" style={{ color: '#78716C' }}>
                  After you add clients under Clients, they appear here in the wizard so you can generate notes. Data is private to your company.
                </p>
              </div>

              <div 
                className="p-6 rounded-2xl relative"
                style={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #EAE6DF',
                  borderLeft: '4px solid #78350F',
                  boxShadow: '0 4px 16px rgba(120,53,15,0.04)'
                }}
              >
                <h3 className="font-bold mb-2" style={{ color: '#1C1008' }}>Back to Clients</h3>
                <p className="mb-4 leading-relaxed" style={{ color: '#78716C' }}>
                  Upload your client's assessment once. The AI references their exact programs, behaviors, and goals every time.
                </p>
                <a 
                  href="#" 
                  onClick={preventDefault}
                  className="font-medium hover:underline inline-flex items-center gap-1"
                  style={{ color: '#78350F' }}
                >
                  Clients <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6" style={{ borderTop: '1px solid #EAE6DF' }}>
              <span className="font-medium" style={{ color: '#78716C' }}>Step 1 of 8</span>
              <button 
                onClick={preventDefault}
                className="px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-transform hover:-translate-y-0.5"
                style={{ 
                  backgroundColor: '#78350F', 
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(120,53,15,0.28)'
                }}
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className="grid md:grid-cols-3 gap-6">
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
          ].map((feature, i) => {
            const isHovered = hoveredCard === i;
            return (
              <div 
                key={i}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                className="p-8 rounded-2xl cursor-pointer"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #EAE6DF',
                  boxShadow: isHovered 
                    ? '0 24px 64px rgba(120,53,15,0.15)' 
                    : '0 4px 16px rgba(120,53,15,0.07)',
                  transform: isHovered ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300"
                  style={{
                    backgroundColor: isHovered ? '#78350F' : '#FEF3C7'
                  }}
                >
                  <feature.icon 
                    className="w-6 h-6 transition-colors duration-300" 
                    style={{ color: isHovered ? 'white' : '#92400E' }} 
                  />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: '#1C1008' }}>
                  {feature.title}
                </h3>
                <p className="leading-relaxed" style={{ color: '#78716C' }}>
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
