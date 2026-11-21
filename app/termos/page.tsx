import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso | NexoFab",
  description: "Termos de uso da plataforma SaaS multiempresa NexoFab.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050b12] px-6 py-14 text-[#e8f1f4]">
      <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0b1622] p-8 md:p-12">
        <header className="space-y-2 border-b border-white/10 pb-6">
          <Link href="/" className="inline-block text-2xl font-extrabold tracking-[-0.06em] text-white">
            <span className="text-[#c6f054]">Nexo</span>Fab
          </Link>
          <h1 className="text-3xl font-bold text-white">Termos de Uso</h1>
          <p className="text-xs text-white/55">Última atualização: novembro de 2026</p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">1. Objeto da plataforma</h2>
          <p>
            O NexoFab é uma plataforma de software como serviço (SaaS) multiempresa voltada à gestão de orçamentos,
            precificação técnica, planos de corte, produção, aprovação de artes, estoque e controle financeiro.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">2. Cadastro, organizações e equipe</h2>
          <p>
            Cada empresa cadastrada opera em ambiente logicamente isolado. O proprietário e os administradores são
            responsáveis pelos convites emitidos, funções atribuídas aos membros e guarda das credenciais de acesso.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">3. Período de teste e assinatura</h2>
          <p>
            Novas organizações recebem 7 (sete) dias de avaliação gratuita sem exigência prévia de cartão de crédito.
            Após o teste, a continuidade das operações de gravação depende da contratação de um dos ciclos vigentes
            (mensal, trimestral ou anual), respeitando o limite de usuários ativos do plano contratado.
          </p>
          <p>
            Em caso de término do período de teste, atraso após carência ou cancelamento, o acesso passa a modo somente
            leitura para preservar integralmente os registros cadastrados até a regularização.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">4. Cobrança e cancelamento</h2>
          <p>
            Os pagamentos são processados por intermediador externo autorizado (Asaas), mediante PIX, boleto bancário ou
            cartão de crédito. O cancelamento interrompe renovações futuras, mantendo o acesso até o fim do período já
            pago.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">5. Propriedade dos dados e disponibilidade</h2>
          <p>
            Todos os dados inseridos pela empresa contratante pertencem exclusivamente a ela. O NexoFab emprega boas
            práticas de segurança, controle de acesso em nível de linha (RLS) e backups gerenciados, reservando-se o
            direito de realizar manutenções programadas para evolução e estabilidade do serviço.
          </p>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm">
          <Link href="/privacidade" className="font-semibold text-[#c6f054] hover:underline">
            Ler Política de Privacidade
          </Link>
          <Link href="/" className="text-white/60 hover:text-white">
            Voltar ao início
          </Link>
        </footer>
      </article>
    </main>
  );
}
