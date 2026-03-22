import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import {
  useListAdminCompanies,
  useListAdminUsers,
  usePatchAdminCompany,
  type AdminCompany,
  type AdminUserAccount,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Building2, Users, ShieldCheck, ChevronRight, LogOut, LayoutDashboard } from "lucide-react";

export default function AdminPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [, setLocation] = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const usersQuery = useListAdminUsers({
    query: {
      enabled: !!token && user?.role === "super_admin",
      queryKey: ["/api/admin/users", token, user?.role],
    },
  });

  const listQuery = useListAdminCompanies({
    query: {
      enabled: !!token && user?.role === "super_admin",
      queryKey: ["/api/admin/companies", token, user?.role],
    },
  });

  const patchMutation = usePatchAdminCompany({
    mutation: {
      onSuccess: () => {
        listQuery.refetch();
        toast({ title: "Updated company access" });
      },
      onError: (err: Error & { data?: { error?: string } }) => {
        toast({
          title: "Update failed",
          description: err?.data?.error ?? err.message,
          variant: "destructive",
        });
      },
    },
  });

  if (!token) return <Redirect to="/login" />;
  if (user?.role !== "super_admin") return <Redirect to="/" />;

  const userCount = usersQuery.data?.data.length ?? 0;
  const companyCount = listQuery.data?.data.length ?? 0;

  return (
    <div className="min-h-screen bg-[#FDE8EE]">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-lg shadow-[0_4px_10px_rgba(194,122,138,0.25)]"
                style={{ background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-lg" />
              <Sparkles className="w-4 h-4 text-white relative z-10 pop-icon-white" />
            </div>
            <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase pop-text">ABANOTEASSISTANT</span>
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#FCEEF1] border border-[#F0E4E1] text-[#C27A8A] text-xs font-bold tracking-wide uppercase">Super Admin</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#F0E4E1] text-sm font-semibold text-[#877870] hover:text-[#2D2523] hover:border-[#C27A8A]/40 transition-all"
            >
              <LayoutDashboard className="w-4 h-4 pop-icon" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                queryClient.clear();
                logout();
                setLocation("/login");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C27A8A] hover:bg-[#b06a79] text-white text-sm font-semibold transition-all shadow-[0_4px_12px_rgba(194,122,138,0.25)]"
            >
              <LogOut className="w-4 h-4 pop-icon-white" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero header ── */}
      <div
        className="relative px-6 py-12 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #C87585 0%, #C06B80 50%, #B05E74 100%)" }}
      >
        <div className="absolute top-[-20%] left-[-5%] w-[40%] h-[200%] rounded-full bg-[#C27A8A] blur-[100px] opacity-15 pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[40%] h-[200%] rounded-full bg-[#a85468] blur-[100px] opacity-10 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-white pop-icon-white" />
                <span className="text-white/90 text-xs font-semibold tracking-wide pop-text-white">Restricted access</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight pop-text-white">Admin Console</h1>
              <p className="text-white/70 text-sm mt-1 max-w-lg">
                Manage companies and user accounts. Client and note data stay private within each organization.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px]">
                <div className="text-2xl font-extrabold text-white pop-text-white">{companyCount}</div>
                <div className="text-white/70 text-xs font-semibold mt-0.5">Companies</div>
              </div>
              <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px]">
                <div className="text-2xl font-extrabold text-white pop-text-white">{userCount}</div>
                <div className="text-white/70 text-xs font-semibold mt-0.5">Users</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#F0E4E1] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FCEEF1] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#C27A8A] pop-icon" />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2523] text-base pop-text">User Accounts</h2>
              <p className="text-[#877870] text-xs">Every registered user and their organization — no client PHI.</p>
            </div>
          </div>

          {usersQuery.isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-[#877870]">Loading accounts…</div>
          ) : usersQuery.isError ? (
            <div className="px-6 py-10 text-center text-sm text-rose-500">Could not load accounts.</div>
          ) : (
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
                  {usersQuery.data?.data.map((u: AdminUserAccount) => (
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
                          u.emailVerified
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {u.emailVerified ? "Verified" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Companies table */}
        <div className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#F0E4E1] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FCEEF1] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#C27A8A] pop-icon" />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2523] text-base pop-text">Companies</h2>
              <p className="text-[#877870] text-xs">Toggle complimentary access for organizations as needed.</p>
            </div>
          </div>

          {listQuery.isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-[#877870]">Loading companies…</div>
          ) : listQuery.isError ? (
            <div className="px-6 py-10 text-center text-sm text-rose-500">Could not load companies.</div>
          ) : (
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
                  {listQuery.data?.data.map((c: AdminCompany) => (
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
                          <Switch
                            checked={c.freeUsage}
                            disabled={patchMutation.isPending}
                            onCheckedChange={(checked) => {
                              patchMutation.mutate({
                                companyId: c.id,
                                data: { freeUsage: checked },
                              });
                            }}
                          />
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
          )}
        </div>

      </div>
    </div>
  );
}
