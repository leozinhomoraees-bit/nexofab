import Link from "next/link";
import { Button } from "@/components/ui/button";
import "./portal.css";

export default function PublicPortalNotFound() {
  return (
    <main className="portal-not-found">
      <section className="portal-not-found-card">
        <h1>Portal de orçamento indisponível</h1>
        <p>
          O link acessado não existe, está desativado no momento ou a empresa ainda não publicou o
          portal de orçamentos.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Voltar para o NexoFab</Link>
        </Button>
      </section>
    </main>
  );
}
