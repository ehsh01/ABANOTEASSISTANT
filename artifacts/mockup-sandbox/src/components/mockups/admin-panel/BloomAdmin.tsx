import { Sparkles, Building2, Users, ShieldCheck, LogOut, LayoutDashboard } from "lucide-react";

const MOCK_USERS = [
  { id: 2, email: "ehernandez2@gmail.com", companyId: 2, companyName: "ABANoteassistant", role: "super_admin", emailVerified: true },
  { id: 3, email: "reiinvestorsllc@gmail.com", companyId: 3, companyName: "Test Co", role: "user", emailVerified: true },
  { id: 4, email: "sarah.johnson@therapyplus.com", companyId: 4, companyName: "TherapyPlus ABA", role: "user", emailVerified: true },
  { id: 5, email: "m.carter@bloomaba.com", companyId: 5, companyName: "Bloom ABA Services", role: "user", emailVerified: false },
];

const MOCK_COMPANIES = [
  { id: 2, name: "ABANoteassistant", userCount: 1, freeUsage: false },
  { id: 3, name: "Test Co", userCount: 1, freeUsage: false },
  { id: 4, name: "TherapyPlus ABA", userCount: 1, freeUsage: true },
  { id: 5, name: "Bloom ABA Services", userCount: 1, freeUsage: false },
];

export function BloomAdmin() {
  return (
    <div className="min-h-screen bg-[#FDFAF7]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)",
                  boxShadow: "0 4px 10px rgba(194,122,138,0.25)"
                }}
              />
              <Sparkles className="w-4 h-4 text-white relative z-10" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.12))" }} />
            </div>
            <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase" style={{ textShadow: "0 2px 3px rgba(0,0,0,0.12)" }}>
              ABANOTEASSISTANT
            </span>
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#FCEEF1] border border-[#F0E4E1] text-[#C27A8A] text-xs font-bold tracking-wide uppercase">
              Super Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#F0E4E1] text-sm font-semibold text-[#877870] hover:text-[#2D2523] hover:border-[#C27A8A]/40 transition-all cursor-pointer bg-white"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all cursor-pointer"
              style={{
                background: "#C27A8A",
                boxShadow: "0 4px 12px rgba(194,122,138,0.25)"
              }}
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Hero header */}
      <div
        className="relative px-6 py-12 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #C87585 0%, #C06B80 50%, #B05E74 100%)" }}
      >
        <div className="absolute top-[-20%] left-[-5%] w-[40%] h-[200%] rounded-full bg-[#C27A8A] opacity-15 pointer-events-none" style={{ filter: "blur(100px)" }} />
        <div className="absolute bottom-[-20%] right-[-5%] w-[40%] h-[200%] rounded-full bg-[#a85468] opacity-10 pointer-events-none" style={{ filter: "blur(100px)" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/25 mb-4" style={{ background: "rgba(255,255,255,0.15)" }}>
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span className="text-white/90 text-xs font-semibold tracking-wide" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.45)" }}>
                  Restricted access
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.45)" }}>
                Admin Console
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-lg">
                Manage companies and user accounts. Client and note data stay private within each organization.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px]" style={{ background: "rgba(255,255,255,0.15)" }}>
                <div className="text-2xl font-extrabold text-white" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.45)" }}>
                  {MOCK_COMPANIES.length}
                </div>
                <div className="text-white/70 text-xs font-semibold mt-0.5">Companies</div>
              </div>
              <div className="backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px]" style={{ background: "rgba(255,255,255,0.15)" }}>
                <div className="text-2xl font-extrabold text-white" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.45)" }}>
                  {MOCK_USERS.length}
                </div>
                <div className="text-white/70 text-xs font-semibold mt-0.5">Users</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#F0E4E1] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FCEEF1] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#C27A8A]" />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2523] text-base" style={{ textShadow: "0 2px 3px rgba(0,0,0,0.12)" }}>
                User Accounts
              </h2>
              <p className="text-[#877870] text-xs">Every registered user and their organization — no client PHI.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFAF7]">
                  {["ID", "Email", "Company", "Role", "Verified"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold text-[#877870] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4E1]">
                {MOCK_USERS.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FDFAF7] transition-colors">
                    <td className="px-6 py-4 text-[#877870] font-mono text-xs">{u.id}</td>
                    <td className="px-6 py-4 text-[#2D2523] font-medium">{u.email}</td>
                    <td className="px-6 py-4 text-[#877870]">
                      <span className="text-xs font-mono text-[#C27A8A]">#{u.companyId}</span>
                      <span className="ml-1.5 text-[#2D2523]">{u.companyName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === "super_admin"
                          ? "bg-[#FCEEF1] text-[#C27A8A] border border-[#F0E4E1]"
                          : "bg-[#F0E4E1] text-[#877870]"
                      }`}>
                        {u.role === "super_admin" ? "Super Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        u.emailVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {u.emailVerified ? "Verified" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Companies table */}
        <div className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#F0E4E1] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FCEEF1] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#C27A8A]" />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2523] text-base" style={{ textShadow: "0 2px 3px rgba(0,0,0,0.12)" }}>
                Companies
              </h2>
              <p className="text-[#877870] text-xs">Toggle complimentary access for organizations as needed.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFAF7]">
                  {["ID", "Name", "Users", "Complimentary Access"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold text-[#877870] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4E1]">
                {MOCK_COMPANIES.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FDFAF7] transition-colors">
                    <td className="px-6 py-4 text-[#877870] font-mono text-xs">{c.id}</td>
                    <td className="px-6 py-4 text-[#2D2523] font-semibold">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-[#877870]">
                        <Users className="w-3.5 h-3.5" />
                        {c.userCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Toggle visual */}
                        <div
                          className="relative w-10 h-6 rounded-full transition-colors"
                          style={{ background: c.freeUsage ? "#C27A8A" : "#E5E7EB" }}
                        >
                          <div
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                            style={{ transform: c.freeUsage ? "translateX(20px)" : "translateX(2px)" }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${c.freeUsage ? "text-[#C27A8A]" : "text-[#877870]"}`}>
                          {c.freeUsage ? "On" : "Off"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
