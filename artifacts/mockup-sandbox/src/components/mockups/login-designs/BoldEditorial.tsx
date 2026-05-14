import React, { useState } from 'react';

export function BoldEditorial() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center bg-[#0F0D0E] text-white overflow-hidden relative"
      style={{
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <link rel="stylesheet" media="print" onLoad={(e) => { (e.target as HTMLLinkElement).media = 'all' }} href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,800;1,400&family=Inter:wght@300;400;500&display=swap" />
      
      {/* Abstract decorative background elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C27A8A] rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#C27A8A] rounded-full mix-blend-multiply filter blur-[120px] opacity-[0.07] pointer-events-none -translate-x-1/4 translate-y-1/4"></div>

      <div className="max-w-7xl w-full mx-auto px-6 lg:px-12 xl:px-24 flex flex-col lg:flex-row items-center lg:items-start justify-between z-10 gap-16 lg:gap-8">
        
        {/* Left Column: Brand & Typography */}
        <div className="w-full lg:w-7/12 flex flex-col pt-12 lg:pt-24 relative">
          <div className="absolute -left-12 lg:-left-24 top-12 lg:top-24 w-1 lg:w-2 h-32 lg:h-64 bg-[#C27A8A]"></div>
          
          <div className="mb-4 text-[#C27A8A] uppercase tracking-[0.2em] text-xs font-semibold">
            ABA Note Assistant
          </div>
          
          <h1 
            className="text-5xl md:text-7xl lg:text-[8rem] leading-[1.05] tracking-tight mb-8"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Clinical <br />
            <span className="italic text-gray-400 font-normal">Excellence.</span>
          </h1>
          
          <p className="text-gray-400 text-lg md:text-xl max-w-md font-light leading-relaxed">
            A professional tool for ABA therapists to write clinical notes faster, with unmatched precision.
          </p>
        </div>

        {/* Right Column: The Form */}
        <div className="w-full lg:w-4/12 flex flex-col justify-center">
          <div className="border-l-4 border-[#C27A8A] pl-8 lg:pl-12 py-4">
            <h2 
              className="text-3xl md:text-4xl mb-12"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Sign In
            </h2>

            <form className="flex flex-col gap-8" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-gray-500 font-medium">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent border-b border-gray-700 pb-3 text-lg text-white focus:outline-none focus:border-[#C27A8A] transition-colors placeholder:text-gray-700"
                  placeholder="name@practice.com"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-gray-500 font-medium">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent border-b border-gray-700 pb-3 text-lg text-white focus:outline-none focus:border-[#C27A8A] transition-colors placeholder:text-gray-700"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit"
                className="mt-6 w-full bg-[#C27A8A] text-white py-4 px-8 text-sm uppercase tracking-widest font-semibold hover:bg-[#a86877] transition-all duration-300 transform hover:-translate-y-1"
              >
                Sign In
              </button>
            </form>

            <div className="mt-12 flex flex-col gap-4 text-sm text-gray-500 font-light">
              <a href="#" className="hover:text-white transition-colors flex items-center gap-2 w-fit group">
                <span className="w-4 h-[1px] bg-gray-600 group-hover:bg-white group-hover:w-6 transition-all"></span>
                No account? Register
              </a>
              <a href="#" className="hover:text-white transition-colors flex items-center gap-2 w-fit group">
                <span className="w-4 h-[1px] bg-gray-600 group-hover:bg-white group-hover:w-6 transition-all"></span>
                See plans
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
