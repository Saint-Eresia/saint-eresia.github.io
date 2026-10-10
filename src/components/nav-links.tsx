"use client";

import { BookOpen, Gamepad2, House, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Accueil", icon: House, match: (path: string) => path === "/" },
  { href: "/novels", label: "Novels", icon: BookOpen, match: (path: string) => path.startsWith("/novels") },
  { href: "/patchs", label: "Patchs VN", icon: Gamepad2, match: (path: string) => path.startsWith("/patchs") },
  { href: "/equipe", label: "Équipe", icon: Users, match: (path: string) => path.startsWith("/equipe") },
];
const TEAM_LINK = { href: "/gestion", label: "Gestion", icon: Settings2, match: (path: string) => path.startsWith("/gestion") };

// Navigation façon ancien site : onglet actif en pastille cramoisie soulignée.
// L’adresse courante n’est connue qu’à la requête : en attendant, les liens s’affichent sans onglet actif.
export function NavLinks({ showTeam }: { showTeam: boolean }) {
  return (
    <Suspense fallback={<Links showTeam={showTeam} pathname={null} />}>
      <ActiveLinks showTeam={showTeam} />
    </Suspense>
  );
}

function ActiveLinks({ showTeam }: { showTeam: boolean }) {
  return <Links showTeam={showTeam} pathname={usePathname()} />;
}

function Links({ showTeam, pathname }: { showTeam: boolean; pathname: string | null }) {
  const links = showTeam ? [...LINKS, TEAM_LINK] : LINKS;
  return (
    <>
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-2.5 py-2 text-sm font-semibold transition-colors lg:px-3.5",
              active
                ? "bg-accent text-primary after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:rounded-full after:bg-primary lg:after:inset-x-3.5"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="max-md:sr-only">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
