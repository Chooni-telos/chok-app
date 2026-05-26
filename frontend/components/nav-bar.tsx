"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon?: string;
  emoji?: string;
}

const TABS: Tab[] = [
  { href: "/", label: "촉피드", icon: "/nav-feed.png" },
  { href: "/groups", label: "촉앤톡", emoji: "🔮" },
  { href: "/stats", label: "내 촉", icon: "/nav-stats.png" },
  { href: "/zener", label: "예지력측정", icon: "/nav-zener.png" },
  { href: "/ranking", label: "랭킹", icon: "/nav-ranking.png" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0b0a18]/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, icon, emoji }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0 pb-6 pt-3 text-xs transition-colors",
                active ? "text-jd-accent" : "text-jd-muted",
              )}
            >
              {icon ? (
                <img
                  src={icon}
                  alt={label}
                  className={cn("h-8 w-8 object-contain", active ? "opacity-100 brightness-150" : "opacity-40 grayscale")}
                />
              ) : (
                <span className={cn("flex h-8 w-8 items-center justify-center text-2xl", active ? "opacity-100" : "opacity-40 grayscale")}>{emoji}</span>
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
