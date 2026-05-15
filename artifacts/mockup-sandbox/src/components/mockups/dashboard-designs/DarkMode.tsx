import React, { useState } from 'react';
import { 
  Bot, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Globe, 
  Plus,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Zap,
  Activity,
  BrainCircuit,
  FileCheck2
} from 'lucide-react';

export default function DarkModeDashboard() {
  const [activeClient, setActiveClient] = useState<string | null>('client-1');

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div 
        className="min-h-screen w-full text-white overflow-x-hidden font-sans"
        style={{ 
          backgroundColor: '#0A0A0F',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {/* Sticky Navbar */}
        <nav 
          className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
          style={{ 
            backgroundColor: '#0A0A0F',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center border border-[#22D3EE]/20">
              <Bot className="w-5 h-5 text-[#22D3EE]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">ABA Note Assistant</span>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-white text-sm font-medium transition-colors">Dashboard</a>
            <a href="#" className="text-white/50 hover:text-white/80 text-sm font-medium transition-colors">Notes</a>
            <a href="#" className="text-white/50 hover:text-white/80 text-sm font-medium transition-colors">Clients</a>
            <a href="#" className="text-white/50 hover:text-white/80 text-sm font-medium transition-colors">Admin</a>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-5">
            <button className="flex items-center gap-1 text-white/50 hover:text-white/80 text-sm font-medium transition-colors">
              <Globe className="w-4 h-4" />
              <span>EN</span>
            </button>
            <button className="text-white/50 hover:text-white/80 text-sm font-medium transition-colors flex items-center gap-1">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
            <button 
              className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#22D3EE', color: '#0A0A0F' }}
            >
              <Plus className="w-4 h-4" />
              New Note
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="relative pb-24">
          
          {/* Hero Section */}
          <div 
            className="relative pt-24 pb-48 px-6 flex flex-col items-center text-center overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, #0A0A0F 0%, #0F172A 50%, #0A0A0F 100%)' 
            }}
          >
            {/* Background Glow */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
              style={{
                background: '#0E7490',
                opacity: 0.2,
                filter: 'blur(120px)',
                borderRadius: '50%'
              }}
            />

            {/* Eyebrow */}
            <div 
              className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span className="text-xs font-semibold tracking-wide text-[#22D3EE] uppercase">V2.0 Now Live</span>
            </div>

            {/* Headline */}
            <h1 className="relative z-10 text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl text-white">
              Session notes written in <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] to-[#38BDF8]">seconds.</span>
            </h1>

            {/* Subtitle */}
            <p className="relative z-10 text-lg md:text-xl max-w-2xl mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Stop spending hours on documentation. Generate compliant, accurate ABA therapy notes instantly with AI trained for behavior analysts.
            </p>

            {/* CTA Buttons */}
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-16">
              <button 
                className="px-8 py-4 rounded-xl font-bold text-base flex items-center gap-2 shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]"
                style={{ backgroundColor: '#22D3EE', color: '#0A0A0F' }}
              >
                <Zap className="w-5 h-5" />
                Generate a Note
              </button>
              <button 
                className="px-8 py-4 rounded-xl font-semibold text-base flex items-center gap-2 transition-all hover:bg-white/10"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              >
                <FileText className="w-5 h-5 text-white/70" />
                View Notes
              </button>
            </div>

            {/* Stats Bar */}
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-8 md:gap-16 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#22D3EE]" />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>15 min saved per note</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#22D3EE]" />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>100% Compliance Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#22D3EE]" />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>5,000+ notes generated</span>
              </div>
            </div>
          </div>

          {/* Floating Wizard Card */}
          <div className="relative z-20 max-w-4xl mx-auto px-6 -mt-32 mb-24">
            <div 
              className="rounded-3xl overflow-hidden relative"
              style={{ 
                backgroundColor: '#111827',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset',
                backdropFilter: 'blur(20px)'
              }}
            >
              {/* Wizard Header */}
              <div className="p-8 border-b border-white/5">
                <h2 className="text-2xl font-bold text-white mb-6">Select Client</h2>
                
                {/* Step Indicator */}
                <div className="flex items-center w-full max-w-md">
                  {[1, 2, 3, 4].map((step, idx) => (
                    <React.Fragment key={step}>
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${step === 1 ? 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' : ''}`}
                        style={
                          step === 1 
                            ? { backgroundColor: '#22D3EE', color: '#0A0A0F' }
                            : { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
                        }
                      >
                        {step}
                      </div>
                      {idx < 3 && (
                        <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Wizard Body */}
              <div className="p-8 bg-black/20">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Client Card 1 */}
                  <button 
                    onClick={() => setActiveClient('client-1')}
                    className="text-left rounded-2xl p-5 transition-all relative overflow-hidden group"
                    style={{ 
                      backgroundColor: '#1A2234',
                      border: activeClient === 'client-1' ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      borderLeft: activeClient === 'client-1' ? '4px solid #22D3EE' : '4px solid transparent',
                    }}
                  >
                    {activeClient === 'client-1' && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#22D3EE]/5 blur-3xl rounded-full" />
                    )}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                        AJ
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">Alex Johnson</h3>
                        <p style={{ color: 'rgba(255,255,255,0.5)' }} className="text-sm">9 years old</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <Activity className="w-4 h-4 text-[#22D3EE]/70" />
                      <span>3 active programs</span>
                    </div>
                  </button>

                  {/* Client Card 2 */}
                  <button 
                    onClick={() => setActiveClient('client-2')}
                    className="text-left rounded-2xl p-5 transition-all relative overflow-hidden group hover:border-white/20"
                    style={{ 
                      backgroundColor: '#1A2234',
                      border: activeClient === 'client-2' ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      borderLeft: activeClient === 'client-2' ? '4px solid #22D3EE' : '4px solid transparent',
                    }}
                  >
                     {activeClient === 'client-2' && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#22D3EE]/5 blur-3xl rounded-full" />
                    )}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                        MS
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">Maya Smith</h3>
                        <p style={{ color: 'rgba(255,255,255,0.5)' }} className="text-sm">6 years old</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <Activity className="w-4 h-4 text-[#22D3EE]/70" />
                      <span>5 active programs</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Wizard Footer */}
              <div className="p-6 border-t border-white/5 flex items-center justify-between bg-black/40">
                <span className="font-medium text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Step 1 of 8
                </span>
                <button 
                  className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-transform hover:scale-105"
                  style={{ backgroundColor: '#22D3EE', color: '#0A0A0F' }}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Feature Cards Grid */}
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-6">
              
              {/* Feature 1 */}
              <div 
                className="rounded-2xl p-8 transition-transform hover:-translate-y-1 duration-300"
                style={{ 
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'rgba(34,211,238,0.1)' }}
                >
                  <FileCheck2 className="w-6 h-6 text-[#22D3EE]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">ABA Note Types</h3>
                <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Support for SOAP, direct therapy, parent training, and supervision notes. Tailored exactly to your clinic's format.
                </p>
              </div>

              {/* Feature 2 */}
              <div 
                className="rounded-2xl p-8 transition-transform hover:-translate-y-1 duration-300"
                style={{ 
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'rgba(34,211,238,0.1)' }}
                >
                  <BrainCircuit className="w-6 h-6 text-[#22D3EE]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Smart Programs</h3>
                <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  AI automatically links observed behaviors and interventions to the client's specific active acquisition programs.
                </p>
              </div>

              {/* Feature 3 */}
              <div 
                className="rounded-2xl p-8 transition-transform hover:-translate-y-1 duration-300"
                style={{ 
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'rgba(34,211,238,0.1)' }}
                >
                  <Zap className="w-6 h-6 text-[#22D3EE]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Instant Generation</h3>
                <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Jot down rough bullet points or dictate securely. Watch as it transforms into a polished, insurance-ready narrative.
                </p>
              </div>

            </div>
          </div>

        </main>
      </div>
    </>
  );
}
