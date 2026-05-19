import React, { useState } from 'react';
import { 
  Menu, Search, Bell, User, Plus, 
  Clock, FileText, CheckCircle, 
  BrainCircuit, Zap, FileSearch,
  ChevronRight, ArrowRight
} from 'lucide-react';

export default function SlateIndigo() {
  const [activeStep, setActiveStep] = useState(1);
  const [activeCard, setActiveCard] = useState<number | null>(1);

  return (
    <div style={{ fontFamily: '"Inter", sans-serif', backgroundColor: '#F8F9FC' }} className="min-h-screen w-full pb-20 font-sans text-slate-900">
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E2E8F0] px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4F46E5] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">NoteFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="text-[#4F46E5] pb-5 border-b-2 border-[#4F46E5] pt-5">Dashboard</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Notes</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Clients</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Admin</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 border-r border-slate-200 pr-4">
            <button className="text-slate-900">EN</button>
            <span className="text-slate-300">/</span>
            <button className="hover:text-slate-900">ES</button>
          </div>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900">Log out</button>
          <button className="bg-[#4F46E5] hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div 
        className="relative pt-20 pb-48 px-6 text-center"
        style={{
          background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 50%, #6366F1 100%)'
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span className="text-xs font-medium text-white tracking-wide uppercase">System Operational</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Session notes written <br className="hidden md:block"/> in seconds.
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-10">
            Streamline your clinical documentation with AI-powered note generation designed specifically for ABA therapy.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <button className="bg-white text-[#4F46E5] font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-50 transition-colors shadow-lg flex items-center gap-2">
              Generate a Note
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-8 py-3.5 rounded-xl transition-colors backdrop-blur-sm">
              View Notes
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 pt-8 border-t border-white/10 text-white/80">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-200" />
              <div className="text-left">
                <div className="font-bold text-white text-xl">15 min</div>
                <div className="text-xs text-white/60 uppercase tracking-wider font-semibold">Saved per session</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-indigo-200" />
              <div className="text-left">
                <div className="font-bold text-white text-xl">100%</div>
                <div className="text-xs text-white/60 uppercase tracking-wider font-semibold">Compliance Rate</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-200" />
              <div className="text-left">
                <div className="font-bold text-white text-xl">5,000+</div>
                <div className="text-xs text-white/60 uppercase tracking-wider font-semibold">Notes Generated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Wizard Card */}
      <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-10 mb-20">
        <div 
          className="bg-white rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden border border-white/50"
          style={{
            boxShadow: '0 32px 80px rgba(79,70,229,0.12), 0 1px 0 rgba(255,255,255,0.9) inset'
          }}
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Select Client</h2>
              <p className="text-sm text-slate-500">Choose who this session note is for.</p>
            </div>
            
            {/* Steps Indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step === activeStep 
                      ? 'bg-[#4F46E5] text-white shadow-md' 
                      : step < activeStep 
                        ? 'bg-indigo-100 text-[#4F46E5]'
                        : 'bg-[#E2E8F0] text-slate-400'
                  }`}>
                    {step < activeStep ? <CheckCircle className="w-4 h-4" /> : step}
                  </div>
                  {i < 3 && (
                    <div className={`w-8 h-0.5 mx-1 ${
                      step < activeStep ? 'bg-[#4F46E5]' : 'bg-[#E2E8F0]'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search clients..." 
              className="w-full bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl py-3 pl-12 pr-4 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all"
            />
          </div>

          {/* Sub-cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {[
              { id: 1, name: 'Alex Johnson', age: '7 y/o', diagnosis: 'ASD Level 1', lastSession: 'Yesterday' },
              { id: 2, name: 'Sarah Miller', age: '5 y/o', diagnosis: 'ASD Level 2', lastSession: 'Oct 12' }
            ].map((client) => (
              <div 
                key={client.id}
                onClick={() => setActiveCard(client.id)}
                className={`p-5 rounded-2xl cursor-pointer transition-all border ${
                  activeCard === client.id 
                    ? 'bg-white border-l-4 border-l-[#4F46E5] border-y-[#E2E8F0] border-r-[#E2E8F0] shadow-md ring-1 ring-[#4F46E5]/10' 
                    : 'bg-[#F8F9FC] border-[#E2E8F0] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                    activeCard === client.id ? 'bg-indigo-100 text-[#4F46E5]' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{client.name}</h3>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{client.age}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>{client.diagnosis}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-400 mt-3 bg-white inline-block px-2 py-1 rounded border border-slate-100 shadow-sm">
                      Last session: {client.lastSession}
                    </div>
                  </div>
                  {activeCard === client.id && (
                    <div className="w-6 h-6 rounded-full bg-[#4F46E5] text-white flex items-center justify-center">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-[#E2E8F0]">
            <span className="text-sm font-medium text-slate-500">Step 1 of 4</span>
            <button className="bg-[#4F46E5] hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="max-w-6xl mx-auto px-6 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileSearch className="w-6 h-6 text-[#4F46E5]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">ABA Note Types</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Support for SOAP, DAP, and comprehensive narrative formats tailored to clinical requirements and insurance standards.
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-6 h-6 text-[#4F46E5]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Smart Programs</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Automatically pull active skill acquisition and behavior reduction programs directly into your session notes.
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-[#4F46E5]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Instant Generation</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Transform brief bullet points and raw data into polished, compliant clinical documentation in seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
