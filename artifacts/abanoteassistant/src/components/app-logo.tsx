import { Link } from "wouter";
import { cn } from "@/lib/utils";

export const APP_LOGO_SRC = "/images/aba-note-assistant-logo.png";

type AppLogoProps = {
  className?: string;
  imageClassName?: string;
  href?: string | null;
  size?: "sm" | "md" | "lg" | "sidebar";
};

const SIZE_CLASS: Record<NonNullable<AppLogoProps["size"]>, string> = {
  sm: "h-9 w-auto max-w-[120px]",
  md: "h-10 w-auto max-w-[140px]",
  lg: "h-16 w-auto max-w-[220px]",
  sidebar: "h-14 w-auto max-w-[180px]",
};

export function AppLogo({ className, imageClassName, href = "/", size = "md" }: AppLogoProps) {
  const image = (
    <img
      src={APP_LOGO_SRC}
      alt="ABA Note Assistant"
      className={cn("object-contain rounded-xl", SIZE_CLASS[size], imageClassName)}
    />
  );

  const content = <div className={cn("flex items-center shrink-0", className)}>{image}</div>;

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
