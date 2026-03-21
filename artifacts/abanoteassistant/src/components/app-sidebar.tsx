import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users, FileText, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Notes", href: "/notes", icon: FileText },
];

function getInitials(email: string) {
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    queryClient.clear();
    logout();
    setLocation("/login");
  }

  const navItems = [
    ...NAV_ITEMS,
    ...(user?.role === "super_admin" ? [{ label: "Admin", href: "/admin", icon: Settings }] : []),
  ];

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-[200] flex flex-col"
      style={{ width: 220, background: "#C27A8A" }}
    >
      {/* Logo */}
      <div
        className="flex flex-col gap-1 px-5 py-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}
      >
        <Link href="/">
          <span
            className="font-extrabold tracking-widest uppercase cursor-pointer"
            style={{ fontSize: 10, color: "#fff", letterSpacing: "0.12em" }}
          >
            ABANOTEASSISTANT
          </span>
        </Link>
        <div
          style={{
            width: 36,
            height: 2,
            background: "linear-gradient(90deg, rgba(255,255,255,0.7), transparent)",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/"
              ? location === "/" || location === ""
              : location.startsWith(href);

          return (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                  isActive
                    ? "border-l-[3px] border-white"
                    : "border-l-[3px] border-transparent",
                )}
                style={{
                  background: isActive ? "rgba(0,0,0,0.15)" : "transparent",
                }}
              >
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.6)" }}
                />
                <span
                  className="text-sm"
                  style={{
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                  }}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div
        className="px-4 py-4 flex flex-col gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
          >
            {user?.email ? getInitials(user.email) : "?"}
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-semibold truncate"
              style={{ color: "#fff" }}
              title={user?.email}
            >
              {user?.email ?? ""}
            </p>
            <p className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.65)" }}>
              {user?.role === "super_admin" ? "Super Admin" : "Therapist"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          style={{
            background: "rgba(0,0,0,0.12)",
            color: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          aria-label="Log out"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}

export const SIDEBAR_WIDTH = 220;
