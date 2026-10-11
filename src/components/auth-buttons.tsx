"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function DiscordLoginButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-discord px-6 font-semibold text-on-discord transition-colors hover:bg-discord-hover focus-visible:ring-3 focus-visible:ring-discord/50 focus-visible:outline-none disabled:opacity-60"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({ provider: "discord", callbackURL });
        if (error) setPending(false);
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
      </svg>
      {pending ? "Redirection vers Discord…" : "Se connecter avec Discord"}
    </button>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      title="Déconnexion"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {/* Sur petit écran, seule l’icône est affichée pour que l’en-tête tienne en largeur. */}
      <LogOut className="size-4 sm:hidden" aria-hidden />
      <span className="max-sm:sr-only">Déconnexion</span>
    </button>
  );
}
