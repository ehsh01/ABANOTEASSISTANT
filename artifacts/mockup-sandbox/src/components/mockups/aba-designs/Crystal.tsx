import React, { useEffect } from 'react';
import { Sparkles, PlayCircle, Clock, ShieldCheck, FileCheck2, User, ChevronRight, Zap, CheckCircle2, LayoutTemplate } from 'lucide-react';

export function Crystal() {
  useEffect(() => {
    // Add Plus Jakarta Sans font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div 
      className="min-h-screen w-full relative overflow-hidden"
      style={{ 
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#F6F3FC',
        color: '#1A1A2E'
      }}
    >
      {/* Decorative crystals floating in background */}
      <div className="absolute top-40 left-10 w-16 h-16 bg-gradient-to-br from-[#C4B5E8]/30 to-[#6B3FA0]/30 rounded-2xl rotate-45 blur-sm z-0"></div>
      <div className="absolute top-80 right-20 w-24 h-24 bg-gradient-to-br from-[#9B6FD4]/20 to-[#4A2080]/20 rounded-3xl rotate-12 blur-md z-0"></div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#C4B5E8]/30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Crystal SVG */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-[#9B6FD4] to-[#6B3FA0] rounded-lg rotate-45 shadow-[0_4px_10px_rgba(107,63,160,0.3)]"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-lg rotate-45"></div>
              <Sparkles className="w-4 h-4 text-white relative z-10" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#1A1A2E]">
              ABA Note Assistant
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#5E5A7A]">
            <a href="#" className="text-[#6B3FA0] font-semibold">Dashboard</a>
            <a href="#" className="hover:text-[#1A1A2E] transition-colors">Notes</a>
            <a href="#" className="hover:text-[#1A1A2E] transition-colors">Clients</a>
            <a href="#" className="hover:text-[#1A1A2E] transition-colors">Reports</a>
          </div>

          <button className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_8px_20px_rgba(107,63,160,0.25)] hover:shadow-[0_10px_25px_rgba(107,63,160,0.35)] hover:-translate-y-0.5 flex items-center gap-2">
            <span>New Note</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-24 pb-48 px-6 overflow-hidden">
        {/* Hero Background Gradient */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            background: 'linear-gradient(135deg, #4A2080 0%, #9B6FD4 100%)',
          }}
        >
          {/* Subtle noise/texture overlay could go here */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-30"></div>
          
          {/* Large decorative glowing orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#6B3FA0] blur-[120px] mix-blend-screen opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#C4B5E8] blur-[120px] mix-blend-screen opacity-40"></div>
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center flex flex-col items-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-lg">
            <Zap className="w-4 h-4 text-[#C4B5E8]" />
            <span className="text-white/90 text-sm font-semibold tracking-wide">AI-Powered</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-[64px] leading-[1.1] font-extrabold text-white mb-6 tracking-[-0.03em] drop-shadow-sm">
            Your notes, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#C4B5E8]">written in seconds.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-[#F6F3FC]/90 max-w-2xl font-medium leading-relaxed mb-10">
            Guide through a smart checklist and receive complete, professional ABA session notes — instantly generated and ready to submit.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-[#6B3FA0] rounded-full font-bold text-lg shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.3)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Generate Note
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/30 text-white rounded-full font-bold text-lg hover:bg-white/10 backdrop-blur-sm transition-all flex items-center justify-center gap-2">
              <PlayCircle className="w-5 h-5" />
              Watch Demo
            </button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-white/80 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#C4B5E8]" />
              <span>15 min saved</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-white/30"></div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C4B5E8]" />
              <span>Compliant notes</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-white/30"></div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#C4B5E8]" />
              <span>5,000+ notes written</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Card UI */}
      <div className="max-w-5xl mx-auto px-6 relative z-20 -mt-32 mb-20">
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-8 shadow-[0_20px_60px_rgba(107,63,160,0.15)] relative overflow-hidden">
          {/* Card subtle background glow */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#C4B5E8]/20 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10">
            {/* Wizard Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2 tracking-tight">Select Client</h2>
                <p className="text-[#5E5A7A] text-sm">Who is this session note for?</p>
              </div>
              
              {/* Progress Steps */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6B3FA0] text-white flex items-center justify-center font-bold text-sm shadow-[0_4px_12px_rgba(107,63,160,0.3)]">1</div>
                <div className="w-12 h-1 bg-[#6B3FA0] rounded-full"></div>
                <div className="w-8 h-8 rounded-full bg-white border-2 border-[#6B3FA0] text-[#6B3FA0] flex items-center justify-center font-bold text-sm">2</div>
                <div className="w-12 h-1 bg-[#C4B5E8]/50 rounded-full"></div>
                <div className="w-8 h-8 rounded-full bg-gray-100 text-[#5E5A7A] flex items-center justify-center font-bold text-sm">3</div>
                <div className="w-12 h-1 bg-[#C4B5E8]/50 rounded-full"></div>
                <div className="w-8 h-8 rounded-full bg-gray-100 text-[#5E5A7A] flex items-center justify-center font-bold text-sm">4</div>
              </div>
            </div>

            {/* Client Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {/* Client 1 - Selected */}
              <div className="bg-[#F6F3FC] border-2 border-[#6B3FA0] rounded-2xl p-6 cursor-pointer relative shadow-sm transition-all hover:shadow-md">
                <div className="absolute top-4 right-4 text-[#6B3FA0]">
                  <CheckCircle2 className="w-6 h-6 fill-[#6B3FA0] text-white" />
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#6B3FA0]/10 flex items-center justify-center text-[#6B3FA0] font-bold text-lg">
                    JR
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1A2E] text-lg">James R.</h3>
                    <p className="text-[#5E5A7A] text-sm">7 yrs • Clinic Session</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#6B3FA0] bg-white px-3 py-1.5 rounded-lg inline-flex border border-[#C4B5E8]/50">
                  <Clock className="w-3.5 h-3.5" /> Last session: Yesterday
                </div>
              </div>

              {/* Client 2 - Unselected */}
              <div className="bg-white border-2 border-[#C4B5E8]/30 rounded-2xl p-6 cursor-pointer hover:border-[#C4B5E8] transition-all hover:shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-[#5E5A7A] font-bold text-lg">
                    SM
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1A2E] text-lg">Sophia M.</h3>
                    <p className="text-[#5E5A7A] text-sm">4 yrs • Home Session</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#5E5A7A] bg-gray-50 px-3 py-1.5 rounded-lg inline-flex">
                  <Clock className="w-3.5 h-3.5" /> Last session: 3 days ago
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <button className="text-[#5E5A7A] font-semibold hover:text-[#1A1A2E] transition-colors px-4 py-2">
                Cancel
              </button>
              <button className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-8 py-3 rounded-xl font-bold shadow-[0_8px_20px_rgba(107,63,160,0.25)] hover:shadow-[0_12px_25px_rgba(107,63,160,0.35)] transition-all hover:-translate-y-0.5 flex items-center gap-2">
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-8 border border-[#C4B5E8]/30 shadow-sm hover:shadow-xl hover:shadow-[#6B3FA0]/5 transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#F6F3FC] flex items-center justify-center mb-6 group-hover:bg-[#6B3FA0] transition-colors duration-300">
              <LayoutTemplate className="w-7 h-7 text-[#6B3FA0] group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A2E] mb-3 tracking-tight">Guided Wizard</h3>
            <p className="text-[#5E5A7A] leading-relaxed">
              Answer simple questions about the session. Our intuitive flow ensures you never miss a required detail.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-8 border border-[#C4B5E8]/30 shadow-sm hover:shadow-xl hover:shadow-[#6B3FA0]/5 transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#F6F3FC] flex items-center justify-center mb-6 group-hover:bg-[#6B3FA0] transition-colors duration-300 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#9B6FD4]/20 to-[#6B3FA0]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Sparkles className="w-7 h-7 text-[#6B3FA0] group-hover:text-white transition-colors duration-300 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A2E] mb-3 tracking-tight">AI-Written Notes</h3>
            <p className="text-[#5E5A7A] leading-relaxed">
              Transform brief observations into fully articulated, professional narratives that capture clinical progress perfectly.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-8 border border-[#C4B5E8]/30 shadow-sm hover:shadow-xl hover:shadow-[#6B3FA0]/5 transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#F6F3FC] flex items-center justify-center mb-6 group-hover:bg-[#6B3FA0] transition-colors duration-300">
              <ShieldCheck className="w-7 h-7 text-[#6B3FA0] group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A2E] mb-3 tracking-tight">Instant Compliance</h3>
            <p className="text-[#5E5A7A] leading-relaxed">
              Notes are structured to meet insurance requirements automatically, reducing rejection risks and audit anxiety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
