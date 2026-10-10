import { LogIn, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DiscordLoginButton } from "@/components/auth-buttons";
import { MessageCard } from "@/components/message-card";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage({ searchParams }: PageProps<"/connexion">) {
  return (
    <div className="px-4 py-20">
      <Suspense fallback={<div className="mx-auto h-72 max-w-md animate-pulse rounded-2xl bg-muted" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Login({ searchParams }: { searchParams: PageProps<"/connexion">["searchParams"] }) {
  const viewer = await getViewer();
  if (viewer) {
    return (
      <MessageCard icon={<UserCheck />} title="Vous êtes connecté">
        <p>Connecté en tant que {viewer.name}.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline" size="pill">
            <Link href="/">Accueil</Link>
          </Button>
          {viewer.isTeam && (
            <Button asChild size="pill">
              <Link href="/gestion">Gérer les patchs</Link>
            </Button>
          )}
        </div>
      </MessageCard>
    );
  }

  // Page de retour après connexion : uniquement un chemin interne.
  const next = (await searchParams).suite;
  const callbackURL = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <MessageCard icon={<LogIn />} title="Connexion">
      <p>
        Connectez-vous avec Discord. Les membres de l’équipe pourront gérer les patchs ; les autres comptes peuvent
        seulement les consulter.
      </p>
      <div className="mt-7">
        <DiscordLoginButton callbackURL={callbackURL} />
      </div>
    </MessageCard>
  );
}
