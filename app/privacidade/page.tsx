import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | NexoFab",
  description: "Política de privacidade e tratamento de dados (LGPD) da plataforma NexoFab.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050b12] px-6 py-14 text-[#e8f1f4]">
      <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0b1622] p-8 md:p-12">
        <header className="space-y-2 border-b border-white/10 pb-6">
          <Link href="/" className="inline-block text-2xl font-extrabold tracking-[-0.06em] text-white">
            <span className="text-[#c6f054]">Nexo</span>Fab
          </Link>
          <h1 className="text-3xl font-bold text-white">Política de Privacidade (LGPD)</h1>
          <p className="text-xs text-white/55">Última atualização: novembro de 2026</p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">1. Dados coletados</h2>
          <p>
            Coletamos apenas os dados necessários para autenticação, operação da empresa contratante e emissão de
            cobranças: nome, e-mail, senha criptografada, dados cadastrais da organização (incluindo CPF/CNPJ para
            faturamento) e registros operacionais inseridos voluntariamente pelos usuários autorizados.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">2. Isolamento multiempresa e segurança</h2>
          <p>
            Os dados de cada empresa são isolados no banco de dados por políticas de Row Level Security (RLS) vinculadas
            à organização ativa e à permissão do usuário autenticado. Arquivos enviados (logos, artes e documentos) são
            segregados por prefixo exclusivo da organização.
          </p>
          <p>
            Não armazenamos números completos de cartão de crédito em nossos servidores; o processamento financeiro
            ocorre diretamente no ambiente seguro do provedor de pagamentos (Asaas).
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">3. Papéis segundo a LGPD (Lei nº 13.709/2018)</h2>
          <p>
            Em relação aos dados cadastrais da conta e assinatura, o NexoFab atua como controlador. Em relação aos dados
            de clientes, fornecedores e propostas inseridos por cada empresa contratante, a própria empresa atua como
            controladora e o NexoFab atua como operador tecnológico.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-bold text-white">4. Direitos do titular</h2>
          <p>
            Os titulares podem solicitar confirmação de tratamento, correção de dados, revogação de acessos de equipe ou
            exclusão da conta, respeitadas as obrigações legais e fiscais aplicáveis.
          </p>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm">
          <Link href="/termos" className="font-semibold text-[#c6f054] hover:underline">
            Ler Termos de Uso
          </Link>
          <Link href="/" className="text-white/60 hover:text-white">
            Voltar ao início
          </Link>
        </footer>
      </article>
    </main>
  );
}
