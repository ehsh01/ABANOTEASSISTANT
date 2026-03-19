import React, { useEffect } from 'react';
import { 
  Plus, 
  ArrowRight, 
  Play, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  Download, 
  User, 
  Calendar,
  Activity
} from 'lucide-react';

export function Aurora() {
  useEffect(() => {
    // Inject Google Fonts: Space Grotesk
    const linkId = 'aurora-google-fonts';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans overflow-x-hidden text-[#0F1623]">
      {/* --- HERO & NAV SECTION --- */}
      <div className="relative bg-[#0F1623] text-white selection:bg-[#14B8A6] selection:text-white pb-24">
        
        {/* Ambient Aurora Glows */}
        <div className="absolute top-0 right-0 w-[800px] h-[600px] overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#14B8A6] opacity-30 blur-[120px] mix-blend-screen" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#F97316] opacity-20 blur-[100px] mix-blend-screen" />
          <div className="absolute top-[10%] right-[30%] w-[450px] h-[450px] rounded-full bg-[#8B5CF6] opacity-20 blur-[120px] mix-blend-screen" />
        </div>

        {/* Navigation */}
        <nav className="relative z-10 px-6 lg:px-12 py-6 flex items-center justify-between max-w-[1440px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#0A877A] flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.4)]">
              <span className="font-['Space_Grotesk'] font-bold text-xl tracking-tight text-white">A</span>
            </div>
            <span className="font-['Space_Grotesk'] font-bold text-xl tracking-tight text-white">
              ABA Note Assistant
            </span>
          </div>
          <button className="flex items-center gap-2 bg-[#14B8A6] hover:bg-[#119d8e] text-[#0F1623] font-semibold px-4 py-2.5 rounded-lg transition-all shadow-[0_4px_14px_rgba(20,184,166,0.3)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.4)]">
            <Plus size={18} />
            <span>New Session Note</span>
          </button>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 lg:px-12 pt-16 lg:pt-24 flex flex-col lg:flex-row items-center gap-16">
          
          {/* Left Column */}
          <div className="flex-1 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/10 text-[#14B8A6] font-medium text-sm mb-6">
              <Sparkles size={14} />
              <span>AI Documentation Tool</span>
            </div>
            
            <h1 className="font-['Space_Grotesk'] text-5xl lg:text-[72px] leading-[1.05] font-bold tracking-tight mb-6">
              Write better notes. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#F97316]">Faster.</span>
            </h1>
            
            <p className="text-[#9CA3AF] text-lg lg:text-xl leading-relaxed mb-10 max-w-xl">
              Purpose-built for ABA therapists. Guide through a smart session checklist and get a complete, professional note in under 2 minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
              <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#14B8A6] hover:bg-[#119d8e] text-[#0F1623] font-semibold px-10 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.4)] hover:shadow-[0_0_30px_rgba(20,184,166,0.6)] group">
                Start a Note
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold border-2 border-white/20 hover:border-white/40 hover:bg-white/5 transition-all">
                <Play size={18} fill="currentColor" />
                See How It Works
              </button>
            </div>
            
            <div className="flex items-center gap-6 text-sm font-medium text-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#14B8A6]" />
                <span>2 min</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#14B8A6]" />
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#14B8A6]" />
                <span>15 min saved</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#14B8A6]" />
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#14B8A6]" />
                <span>Clinically accurate</span>
              </div>
            </div>
          </div>

          {/* Right Column - Floating Card */}
          <div className="flex-1 w-full max-w-[500px] lg:max-w-none perspective-1000">
            <div className="bg-[#1C2333] border border-white/10 rounded-2xl p-6 lg:p-8 shadow-2xl transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-500 relative overflow-hidden">
              {/* Card top gradient line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#14B8A6] to-[#F97316]" />
              
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="font-['Space_Grotesk'] text-xl font-bold text-white mb-1">James R. • 8 yrs old</h3>
                  <p className="text-[#9CA3AF] text-sm flex items-center gap-2">
                    <Calendar size={14} /> Today, 2:00 PM - 4:00 PM
                  </p>
                </div>
                <div className="bg-[#14B8A6]/20 text-[#14B8A6] px-3 py-1 rounded-lg text-xs font-bold">
                  Drafting
                </div>
              </div>

              {/* Fake UI steps */}
              <div className="space-y-6">
                {[
                  { label: 'Environment & Setting', active: false, completed: true },
                  { label: 'Behaviors Targeted', active: true, completed: false },
                  { label: 'Interventions Used', active: false, completed: false },
                  { label: 'Response & Progress', active: false, completed: false },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
                      ${step.completed ? 'bg-[#14B8A6] border-[#14B8A6]' : 
                        step.active ? 'border-[#14B8A6] text-[#14B8A6]' : 'border-white/20 text-white/40'}`}>
                      {step.completed ? <CheckCircle2 size={16} className="text-[#0F1623]" /> : <span className="text-sm font-bold">{idx + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${step.active ? 'text-white' : step.completed ? 'text-white/80' : 'text-white/40'}`}>
                        {step.label}
                      </div>
                      {step.active && (
                        <div className="h-1.5 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#14B8A6] to-[#F97316] w-[45%] rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <button className="text-[#9CA3AF] hover:text-white text-sm font-medium transition-colors">
                  Save Draft
                </button>
                <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- LIGHT BODY SECTION --- */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
        
        {/* Recent Notes */}
        <div className="mb-24">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-[#0F1623] mb-2">Your recent notes</h2>
              <p className="text-[#6B7280]">Pick up where you left off or review past sessions.</p>
            </div>
            <button className="text-[#14B8A6] font-semibold hover:text-[#0f9485] flex items-center gap-1">
              View all <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Sarah M.', date: 'Oct 24, 2023', duration: '120 mins', status: 'Draft', color: 'orange' },
              { name: 'David L.', date: 'Oct 23, 2023', duration: '90 mins', status: 'Completed', color: 'teal' },
              { name: 'Emma W.', date: 'Oct 21, 2023', duration: '120 mins', status: 'Completed', color: 'teal' },
            ].map((note, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-[12px] p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-[#14B8A6]/30 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[#6B7280]">
                      <User size={20} />
                    </div>
                    <div>
                      <h4 className="font-['Space_Grotesk'] font-bold text-[#0F1623] text-lg leading-tight group-hover:text-[#14B8A6] transition-colors">{note.name}</h4>
                      <p className="text-sm text-[#6B7280]">{note.date}</p>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md text-xs font-bold
                    ${note.color === 'orange' ? 'bg-[#F97316]/10 text-[#F97316]' : 'bg-[#14B8A6]/10 text-[#14B8A6]'}
                  `}>
                    {note.status}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-5">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} /> {note.duration}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-gray-300" />
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} /> Clinic
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-sm font-medium text-[#0F1623] group-hover:text-[#14B8A6] transition-colors">
                    {note.status === 'Draft' ? 'Continue editing' : 'View note'}
                  </span>
                  <ArrowRight size={16} className="text-gray-400 group-hover:text-[#14B8A6] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Feature 1 */}
          <div className="flex flex-col items-start">
            <div className="w-12 h-12 rounded-xl bg-[#14B8A6]/10 text-[#14B8A6] flex items-center justify-center mb-5 shadow-[0_4px_14px_rgba(20,184,166,0.15)]">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#0F1623] mb-3">Guided 8-Step Wizard</h3>
            <p className="text-[#6B7280] leading-relaxed">
              Never miss a crucial detail. Our step-by-step flow ensures your notes meet all insurance and clinical requirements effortlessly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-start">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#F97316] text-white flex items-center justify-center mb-5 shadow-[0_4px_14px_rgba(249,115,22,0.2)]">
              <Sparkles size={24} />
            </div>
            <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#0F1623] mb-3">AI-Generated Clinical Language</h3>
            <p className="text-[#6B7280] leading-relaxed">
              Input shorthand observations and let our AI translate them into professional, objective clinical terminology instantly.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-start">
            <div className="w-12 h-12 rounded-xl bg-[#0F1623]/5 text-[#0F1623] flex items-center justify-center mb-5">
              <Download size={24} />
            </div>
            <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#0F1623] mb-3">One-Click Save & Export</h3>
            <p className="text-[#6B7280] leading-relaxed">
              Export your finalized notes directly to your agency's format or copy them securely into your existing EHR system.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
