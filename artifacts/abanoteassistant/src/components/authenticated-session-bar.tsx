import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

/**
 * Always-visible session strip on authenticated routes so users can log out from any screen.
 */
export function AuthenticatedSessionBar() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    queryClient.clear();
    logout();
    setLocation("/login");
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-[300] flex h-11 items-center justify-end gap-2 sm:h-12",
        "border-b border-border/70 bg-background/95 px-3 backdrop-blur-md sm:gap-3 sm:px-4",
      )}
      role="banner"
      aria-label="Account"
    >
      {user?.email ? (
        <span
          className="mr-1 hidden max-w-[min(14rem,42vw)] truncate text-xs text-muted-foreground sm:inline"
          title={user.email}
        >
          {user.email}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold",
          "bg-primary text-primary-foreground hover:opacity-90 transition-opacity",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4 shrink-0 opacity-90" />
        <span>Log out</span>
      </button>
    </header>
  );
}

/** Push page content below the fixed session bar */
export const AUTH_SESSION_BAR_OFFSET_CLASS = "pt-11 sm:pt-12";
