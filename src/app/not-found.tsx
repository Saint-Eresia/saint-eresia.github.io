import { SearchX } from "lucide-react";
import Link from "next/link";
import { MessageCard } from "@/components/message-card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="px-4 py-20">
      <MessageCard icon={<SearchX />} title="Page introuvable">
        <p>Cette page n’existe pas ou n’existe plus.</p>
        <Button asChild size="pill" className="mt-6">
          <Link href="/">Retour à l’accueil</Link>
        </Button>
      </MessageCard>
    </div>
  );
}
