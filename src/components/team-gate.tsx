import { Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCard } from "@/components/message-card";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/viewer";

// Ne rend son contenu qu’aux membres de l’équipe. À placer dans chaque page de gestion :
// un layout ne suffit pas, car Next.js rend les pages indépendamment de leur layout.
// Les actions et l’envoi d’images refont la vérification de leur côté.
export async function TeamGate({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?suite=/gestion");
  if (!viewer.isTeam) {
    return (
      <div className="py-8">
        <MessageCard icon={<Lock />} title="Accès réservé à l’équipe">
          <p>
            Votre compte Discord n’a pas de rôle d’équipe sur le serveur Saint Eresia. Vous pouvez consulter les patchs,
            mais pas les modifier.
          </p>
          <Button asChild variant="outline" size="pill" className="mt-6">
            <Link href="/">Retour à l’accueil</Link>
          </Button>
        </MessageCard>
      </div>
    );
  }
  return children;
}
