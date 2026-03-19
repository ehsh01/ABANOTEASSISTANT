import React, { useEffect } from 'react';
import { Leaf, Clock, ShieldCheck, Compass, Sparkles, UserCircle, ChevronRight, Check } from 'lucide-react';

export function Bloom() {
  useEffect(() => {
    // Add Google Fonts for Playfair Display
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="bloom-theme min-h-screen flex flex-col items-center w-full bg-[#FDFAF7] text-[#2D2523] font-sans overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .bloom-theme {
          --color-bg: #FDFAF7;
          --color-primary: #C27A8A;
          --color-primary-light: #e6b3c0;
          --color-secondary: #7BA07B;
          --color-secondary-light: #b5ceb5;
          --color-card: #FFFFFF;
          --color-text: #2D2523;
          --color-text-muted: #877870;
          --color-border: #F0E4E1;
        }
        
        .bloom-theme h1, .bloom-theme h2, .bloom-theme h3, .bloom-theme h4, .bloom-theme h5, .bloom-theme h6, .bloom-theme .font-serif {
          font-family: 'Playfair Display', serif;
        }

        .bloom-shadow {
          box-shadow: 0 10px 40px -10px rgba(194, 122, 138, 0.15), 0 4px 6px -4px rgba(194, 122, 138, 0.05);
        }

        .shimmer-btn {
          position: relative;
          overflow: hidden;
        }
        
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            to bottom right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0) 40%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: rotate(30deg) translate(-50%, -50%);
          animation: shimmer 4s infinite linear;
          pointer-events: none;
        }

        @keyframes shimmer {
          0% {
            transform: rotate(30deg) translate(-100%, -50%);
          }
          100% {
            transform: rotate(30deg) translate(100%, -50%);
          }
        }

        .botanical-blob {
          border-radius: 41% 59% 46% 54% / 41% 45% 55% 59%;
        }
        .botanical-blob-2 {
          border-radius: 54% 46% 63% 37% / 46% 54% 46% 54%;
        }
      `}} />

      {/* Navigation */}
      <nav className="w-full bg-white border-b border-[#F0E4E1] sticky top-0 z-50 transition-all duration-300 shadow-[0_4px_20px_-15px_rgba(194,122,138,0.1)]">
        <div className="max-w-[1280px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-[#FDFAF7] flex items-center justify-center text-[#C27A8A] border border-[#F0E4E1] group-hover:bg-[#C27A8A] group-hover:text-white transition-colors duration-300 botanical-blob">
              <Leaf size={20} strokeWidth={1.5} />
            </div>
            <span className="font-serif text-2xl font-semibold text-[#2D2523] tracking-tight">ABA Note Assistant</span>
          </div>

          <div className="flex items-center gap-6">
            <button className="text-[#877870] hover:text-[#C27A8A] transition-colors font-medium">Dashboard</button>
            <button className="text-[#877870] hover:text-[#C27A8A] transition-colors font-medium">Clients</button>
            <div className="h-6 w-px bg-[#F0E4E1] mx-2"></div>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-[#2D2523]">Dr. Rebecca</span>
                <span className="text-xs text-[#877870]">BCBA</span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#FDFAF7] border-2 border-[#F0E4E1] flex items-center justify-center text-[#C27A8A] font-serif font-semibold text-lg hover:border-[#C27A8A] transition-colors shadow-sm">
                DR
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="w-full max-w-[1280px] px-6 pt-16 pb-24 flex-1">
        
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 mb-24 relative">
          
          {/* Background Decorative Elements */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[#fff0f3] to-transparent rounded-full opacity-60 -z-10 blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[#f2f9f2] to-transparent rounded-full opacity-60 -z-10 blur-3xl pointer-events-none translate-y-1/4 -translate-x-1/4"></div>

          {/* Left Column: Copy & CTA */}
          <div className="w-full lg:w-[55%] flex flex-col z-10 relative">
            
            {/* Soft decorative motif */}
            <div className="absolute -left-12 -top-12 text-[#e6b3c0] opacity-40 -z-10 rotate-12">
              <svg width="120" height="120" viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 0C50 27.6142 27.6142 50 0 50C27.6142 50 50 72.3858 50 100C50 72.3858 72.3858 50 100 50C72.3858 50 50 27.6142 50 0Z" />
              </svg>
            </div>

            <div className="inline-flex items-center gap-2 text-[#7BA07B] text-sm font-bold uppercase tracking-widest mb-6 py-1.5 px-4 bg-[#f2f9f2] rounded-full w-fit border border-[#e1eee1]">
              <Sparkles size={14} className="text-[#7BA07B]" />
              AI-Powered Documentation
            </div>
            
            <h1 className="font-serif text-[56px] leading-[1.15] text-[#2D2523] mb-6 font-medium">
              Clinical notes,<br />
              <span className="italic text-[#C27A8A]">beautifully done.</span>
            </h1>
            
            <p className="text-[19px] leading-[1.7] text-[#877870] mb-10 max-w-[540px] font-light">
              Save hours every session. Our AI guides you through a gentle checklist and writes professional, compliant notes — so you can focus on what matters most.
            </p>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-12">
              <button className="shimmer-btn bg-[#C27A8A] text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-[#b06a79] hover:-translate-y-0.5 transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(194,122,138,0.5)] flex items-center gap-2">
                Create Note with AI
                <Sparkles size={18} />
              </button>
              <button className="px-8 py-4 rounded-full font-medium text-lg text-[#2D2523] border border-[#F0E4E1] bg-white hover:bg-[#FDFAF7] hover:border-[#C27A8A] hover:text-[#C27A8A] hover:-translate-y-0.5 transition-all duration-300 shadow-sm flex items-center gap-2">
                View Past Notes
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2 bg-white border border-[#F0E4E1] py-2 px-4 rounded-full shadow-sm text-sm font-medium text-[#877870]">
                <div className="w-6 h-6 rounded-full bg-[#fcf2f4] text-[#C27A8A] flex items-center justify-center">
                  <Clock size={12} strokeWidth={2.5} />
                </div>
                15 min saved per session
              </div>
              <div className="inline-flex items-center gap-2 bg-white border border-[#F0E4E1] py-2 px-4 rounded-full shadow-sm text-sm font-medium text-[#877870]">
                <div className="w-6 h-6 rounded-full bg-[#f2f9f2] text-[#7BA07B] flex items-center justify-center">
                  <ShieldCheck size={12} strokeWidth={2.5} />
                </div>
                HIPAA-compliant structure
              </div>
            </div>
          </div>

          {/* Right Column: Floating Mockup */}
          <div className="w-full lg:w-[45%] relative z-10 flex justify-center lg:justify-end">
            
            {/* Blob behind the card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[400px] bg-[#C27A8A] opacity-5 botanical-blob-2 blur-xl z-0"></div>
            
            <div className="w-[380px] bg-white rounded-[32px] bloom-shadow p-8 relative z-10 border border-[#F0E4E1]/50 transform hover:-translate-y-2 transition-transform duration-500">
              
              {/* Header inside card */}
              <div className="flex justify-between items-center mb-8 border-b border-[#F0E4E1] pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#f2f9f2] flex items-center justify-center text-[#7BA07B] font-serif font-medium text-lg border border-[#e1eee1]">
                    JR
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-[#2D2523] leading-tight">James R.</h3>
                    <p className="text-sm text-[#877870]">8 yrs • In-Clinic Session</p>
                  </div>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C27A8A]">Session Progress</span>
                  <span className="text-xs font-medium text-[#877870]">Step 2 of 4</span>
                </div>
                <div className="flex gap-2">
                  <div className="h-1.5 flex-1 bg-[#C27A8A] rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-[#C27A8A] rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-[#F0E4E1] rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-[#F0E4E1] rounded-full"></div>
                </div>
              </div>

              {/* Programs */}
              <div className="mb-6">
                <h4 className="font-medium text-[#2D2523] mb-4 flex items-center gap-2">
                  Programs Targeted
                </h4>
                <div className="flex flex-col gap-3">
                  <div className="bg-[#FDFAF7] border border-[#F0E4E1] p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#C27A8A] shadow-sm">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-medium text-[#2D2523]">Expressive Labeling</span>
                    </div>
                    <span className="text-xs font-semibold text-[#877870] bg-white px-2 py-1 rounded-lg shadow-sm border border-[#F0E4E1]">80%</span>
                  </div>
                  <div className="bg-[#FDFAF7] border border-[#F0E4E1] p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#C27A8A] shadow-sm">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-medium text-[#2D2523]">Peer Play</span>
                    </div>
                    <span className="text-xs font-semibold text-[#877870] bg-white px-2 py-1 rounded-lg shadow-sm border border-[#F0E4E1]">2/3 prompts</span>
                  </div>
                  <div className="bg-white border border-[#e1eee1] p-3 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7BA07B]"></div>
                    <div className="flex items-center gap-3 pl-2">
                      <div className="w-8 h-8 rounded-full border border-dashed border-[#7BA07B] flex items-center justify-center text-[#7BA07B]">
                        <span className="w-2 h-2 rounded-full bg-[#7BA07B]"></span>
                      </div>
                      <span className="text-sm font-medium text-[#2D2523]">Transitions</span>
                    </div>
                    <span className="text-xs font-medium text-[#7BA07B] animate-pulse">In progress...</span>
                  </div>
                </div>
              </div>

              {/* AI Typing Indicator */}
              <div className="bg-[#fcf2f4] p-4 rounded-2xl border border-[#F0E4E1] mt-6 flex items-start gap-3">
                <Sparkles size={16} className="text-[#C27A8A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-[#877870] italic">AI is drafting narrative based on your inputs...</p>
                  <div className="flex gap-1 mt-2">
                    <div className="w-1.5 h-1.5 bg-[#C27A8A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-[#C27A8A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-[#C27A8A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>

        {/* Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-white p-8 rounded-[32px] bloom-shadow border border-[#F0E4E1]/30 hover:-translate-y-1 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#f2f9f2] flex items-center justify-center text-[#7BA07B] mb-6 group-hover:scale-110 transition-transform duration-300 botanical-blob">
              <Compass size={24} strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-2xl font-semibold text-[#2D2523] mb-3">Smart Guidance</h3>
            <p className="text-[#877870] leading-relaxed font-light">
              Answer simple questions throughout your session. Our gentle AI builds your clinical narrative effortlessly as you go.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-[32px] bloom-shadow border border-[#F0E4E1]/30 hover:-translate-y-1 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#fcf2f4] flex items-center justify-center text-[#C27A8A] mb-6 group-hover:scale-110 transition-transform duration-300 botanical-blob-2">
              <Clock size={24} strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-2xl font-semibold text-[#2D2523] mb-3">Saves Time</h3>
            <p className="text-[#877870] leading-relaxed font-light">
              Reclaim your evenings. RBTs save an average of 15 minutes per session, letting you focus entirely on your clients.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-[32px] bloom-shadow border border-[#F0E4E1]/30 hover:-translate-y-1 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#f4f2f7] flex items-center justify-center text-[#8a7ba0] mb-6 group-hover:scale-110 transition-transform duration-300 botanical-blob">
              <ShieldCheck size={24} strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-2xl font-semibold text-[#2D2523] mb-3">Always Compliant</h3>
            <p className="text-[#877870] leading-relaxed font-light">
              Rest easy knowing every note is formatted to strict ABA guidelines and fully HIPAA-compliant by default.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
