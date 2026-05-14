/**
 * Reusable client-avatar circle.
 *
 * Renders an `<img>` of the AI-generated cartoon avatar (`client.avatarUrl` is a signed URL minted by
 * the backend) when available, falling back to the legacy initials gradient circle. When `onRegenerate`
 * is provided, the circle becomes a button — clicking it triggers the avatar regeneration flow and
 * shows a spinner overlay while the request is in flight.
 *
 * The component intentionally accepts a minimal "client" shape (just the fields it actually needs) so
 * it composes with both the API `Client` type and the in-progress wizard state without coupling.
 */

import { Sparkles, Loader2 } from "lucide-react";
import { resolveApiUrl } from "@workspace/api-client-react";

export type ClientAvatarSubject = {
  /** API-provided signed URL (`/api/clients/:id/avatar?...`) or null when no avatar is on file. */
  avatarUrl?: string | null;
  /** Cache-busting key surfaced from the backend; used to force `<img>` reload after regeneration. */
  avatarUpdatedAt?: string | null;
  /** First name for the initials fallback. */
  firstName?: string | null;
  /** Last name for the initials fallback. */
  lastName?: string | null;
  /** Backup name field used when first/last aren't populated yet. */
  name?: string | null;
};

export type ClientAvatarSize = "sm" | "md" | "lg" | "xl";

export type ClientAvatarProps = {
  client: ClientAvatarSubject;
  size?: ClientAvatarSize;
  /**
   * When provided, the avatar becomes a button that calls this function on click. The wizard / edit
   * pages pass a regenerate handler here; the clients list / detail header omit it (read-only).
   */
  onRegenerate?: () => void;
  /** True while a regenerate mutation is in flight; disables clicks and shows a spinner overlay. */
  isRegenerating?: boolean;
  /** Optional extra Tailwind classes (e.g. ring colors when the avatar is the primary visual). */
  className?: string;
  /** Optional title text for the wand overlay (defaults to "Generate avatar"). */
  hoverLabel?: string;
};

const SIZE_CLASSES: Record<ClientAvatarSize, { container: string; text: string; icon: string; sparkles: string }> = {
  sm: { container: "w-10 h-10", text: "text-sm", icon: "w-4 h-4", sparkles: "w-3.5 h-3.5" },
  md: { container: "w-12 h-12", text: "text-lg", icon: "w-5 h-5", sparkles: "w-4 h-4" },
  lg: { container: "w-14 h-14", text: "text-xl", icon: "w-6 h-6", sparkles: "w-4 h-4" },
  xl: { container: "w-24 h-24", text: "text-3xl", icon: "w-8 h-8", sparkles: "w-5 h-5" },
};

function initialsOf(c: ClientAvatarSubject): string {
  const first = (c.firstName ?? "").trim();
  const last = (c.lastName ?? "").trim();
  if (first || last) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  }
  const fallback = (c.name ?? "").trim();
  if (!fallback) return "";
  const parts = fallback.split(/\s+/).filter(Boolean);
  const f = parts[0]?.[0] ?? "";
  const l = parts[1]?.[0] ?? "";
  return `${f}${l}`.toUpperCase() || (f.toUpperCase() || "");
}

export function ClientAvatar({
  client,
  size = "md",
  onRegenerate,
  isRegenerating = false,
  className,
  hoverLabel,
}: ClientAvatarProps) {
  const sz = SIZE_CLASSES[size];
  // The signed URL embeds an `?v=…` query param tied to `avatarUpdatedAt`; React still re-renders <img>
  // on URL change, but we add the timestamp as a key insurance against any stale http-cache surprises.
  const resolvedUrl = client.avatarUrl ? resolveApiUrl(client.avatarUrl) : null;
  const hasImage = Boolean(resolvedUrl);
  const initials = initialsOf(client);

  const baseClass = [
    sz.container,
    "rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0",
    "transition-shadow",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const initialsBg = {
    background: "linear-gradient(135deg, #C27A8A 0%, #e8c4cc 100%)",
  } as const;

  const inner = hasImage ? (
    <img
      key={client.avatarUpdatedAt ?? resolvedUrl ?? undefined}
      src={resolvedUrl ?? undefined}
      alt={`${client.firstName ?? client.name ?? "Client"} avatar`}
      className="w-full h-full object-cover"
      draggable={false}
    />
  ) : (
    <span className={`${sz.text} pop-text-white`}>{initials || "?"}</span>
  );

  // No regenerate handler: render a plain decorative circle (used in the clients list cards).
  if (!onRegenerate) {
    return (
      <div
        className={baseClass}
        style={hasImage ? undefined : initialsBg}
        aria-hidden="true"
      >
        {inner}
      </div>
    );
  }

  // With a regenerate handler: render a clickable button with a wand-icon overlay on hover.
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (isRegenerating) return;
        onRegenerate();
      }}
      disabled={isRegenerating}
      title={hoverLabel ?? (hasImage ? "Regenerate avatar with AI" : "Generate avatar with AI")}
      aria-label={hoverLabel ?? (hasImage ? "Regenerate avatar with AI" : "Generate avatar with AI")}
      className={`relative group/avatar ${baseClass} ${
        isRegenerating
          ? "cursor-wait"
          : "cursor-pointer hover:ring-2 hover:ring-[#C27A8A]/50 hover:shadow-md"
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C27A8A]`}
      style={hasImage ? undefined : initialsBg}
    >
      {inner}
      {/* Hover overlay (dim + wand icon) */}
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 text-white transition-opacity ${
          isRegenerating ? "opacity-100" : "opacity-0 group-hover/avatar:opacity-100"
        }`}
      >
        {isRegenerating ? (
          <Loader2 className={`${sz.icon} animate-spin`} />
        ) : (
          <Sparkles className={sz.sparkles} />
        )}
      </span>
    </button>
  );
}

export default ClientAvatar;
