import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/viewer";
import { LogoutButton } from "./auth-buttons";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-6xl items-center gap-3 px-4 sm:gap-7 sm:px-6">
        <Link href="/" className="text-xl font-extrabold tracking-tight whitespace-nowrap sm:text-2xl">
          Saint Eresia
        </Link>
        <Suspense fallback={<HeaderContent showTeam={false} />}>
          <ViewerHeader />
        </Suspense>
      </div>
    </header>
  );
}

async function ViewerHeader() {
  const viewer = await getViewer();
  return <HeaderContent showTeam={!!viewer?.isTeam} viewer={viewer} />;
}

function HeaderContent({
  showTeam,
  viewer,
}: {
  showTeam: boolean;
  viewer?: Awaited<ReturnType<typeof getViewer>>;
}) {
  return (
    <>
      <nav aria-label="Navigation principale" className="flex items-center gap-0.5">
        <NavLinks showTeam={showTeam} />
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {viewer ? (
          <>
            <span className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1">
              {viewer.image ? (
                <img src={viewer.image} alt="" width={28} height={28} className="size-7 rounded-full" />
              ) : (
                <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                  {viewer.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-32 truncate text-sm font-semibold md:inline">{viewer.name}</span>
            </span>
            <LogoutButton className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
          </>
        ) : viewer === null ? (
          <Button asChild variant="outline" className="h-10 rounded-full px-4 font-semibold">
            <Link href="/connexion">Connexion</Link>
          </Button>
        ) : null}
      </div>
    </>
  );
}
