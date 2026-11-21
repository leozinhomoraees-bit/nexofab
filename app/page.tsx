import Link from "next/link";
import { Check } from "lucide-react";
import { HeroMedia } from "./hero-media";

const corePillars = [
  ["01", "Comercial & Propostas", "Orçamentos com alternativas, link online para aprovação do cliente e histórico de revisões."],
  ["02", "Precificação & Corte", "Cálculo técnico por m², chapas, insumos, máquinas, plano de corte e margem real de lucro."],
  ["03", "Produção & Arte", "Ordens de produção automáticas após aprovação, reserva de estoque e aprovação de arte pelo cliente."],
  ["04", "Financeiro & Equipe", "Contas a pagar e receber, recibo digital, ponto de equilíbrio, DRE e acessos por função."],
];

const targetSegments = [
  ["Comunicação visual e fachadas", "Orçamentos técnicos de ACM, letras caixa, lonas, adesivos e instalação"],
  ["Gráficas e grandes formatos", "Precificação por m², cálculo de perda de mídia e pedidos sob medida"],
  ["Corte CNC e laser", "Plano de corte otimizado, tempo de máquina e reserva de chapas no estoque"],
  ["Marcenaria e mobiliário técnico", "Composição de custos, insumos, fornecedores e prazo de entrega por OS"],
  ["Displays, eventos e PDV", "Alternativas na mesma proposta para o cliente aprovar direto pelo link"],
  ["Prototipagem e impressão 3D", "Controle de horas de máquina, custos reais e fechamento financeiro"],
];

const plans = [
  {
    name: "Mensal",
    badge: "Sem fidelidade",
    price: "R$ 29,00",
    period: "/mês",
    note: "Cobrança mensal de R$ 29,00 · cancele quando quiser",
    featured: false,
  },
  {
    name: "Trimestral",
    badge: "14% OFF · Mais escolhido",
    price: "R$ 25,00",
    period: "/mês",
    note: "Cobrança trimestral de R$ 75,00 a cada 3 meses",
    featured: true,
  },
  {
    name: "Anual",
    badge: "31% OFF · Melhor valor",
    price: "R$ 20,00",
    period: "/mês",
    note: "Cobrança anual de R$ 240,00 · maior economia no ano",
    featured: false,
  },
];

const includedFeatures = [
  "7 dias de teste grátis sem cadastrar cartão",
  "Todos os módulos liberados (Comercial, Precificação, Produção, Estoque e Financeiro)",
  "Até 10 usuários ativos por empresa com controle de permissões",
  "Proposta online, aprovação de arte e recibo digital com a identidade da sua marca",
  "Isolamento completo por empresa e pagamento via PIX, boleto ou cartão",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07111d] text-white">
      <nav className="site-nav">
        <a className="brand nexofab-wordmark" href="#inicio" aria-label="NexoFab — início"><span>Nexo</span>Fab</a>
        <div className="nav-links" aria-label="Navegação principal">
          <a href="#modulos">Módulos</a>
          <a href="#segmentos">Para quem é</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
        </div>
        <div className="nav-actions">
          <Link className="nav-login-link" href="/login">Entrar</Link>
          <Link className="nav-cta" href="/cadastro">Testar 7 dias grátis</Link>
        </div>
      </nav>

      <section id="inicio" className="hero">
        <HeroMedia />
        <div className="hero-shade" /><div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow"><span /> SaaS multiempresa para fabricação e comunicação visual</p>
          <h1>Do orçamento<br />ao <em>caixa.</em></h1>
          <p className="hero-copy">
            O sistema completo para gerenciar orçamentos, precificação técnica, plano de corte, ordens de produção,
            aprovação de arte, estoque e financeiro da sua empresa — em um só lugar.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/cadastro">Começar 7 dias grátis</Link>
            <a className="secondary-button" href="#planos">Ver planos</a>
          </div>
          <div className="hero-proof">
            <div><strong>7 dias grátis</strong><span>teste completo sem cartão de crédito</span></div>
            <div><strong>Até 10 usuários</strong><span>acesso por função para toda a equipe</span></div>
            <div><strong>Sua identidade</strong><span>propostas, artes e recibos com sua logo</span></div>
          </div>
        </div>
        <div className="hero-capability" aria-label="Módulos integrados">
          <span>Operação conectada</span>
          <b>Orçamentos <i /> Precificação <i /> Produção <i /> Financeiro</b>
        </div>
        <p className="vertical-label">ORÇAMENTO · PREÇO · PRODUÇÃO · FINANCEIRO</p>
      </section>

      <section id="modulos" className="process-strip" aria-label="Pilares da plataforma">
        {corePillars.map(([number, title, description]) => (
          <article key={title}><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></article>
        ))}
      </section>

      <section id="segmentos" className="project-paths" aria-labelledby="project-paths-title">
        <div className="project-paths-intro">
          <p className="section-kicker">Feito para quem produz sob medida</p>
          <h2 id="project-paths-title">Um sistema que entende medidas, chapas, máquinas e margem.</h2>
          <p>Nada de planilhas soltas ou ERPs genéricos. O NexoFab nasceu da rotina real de comunicação visual, corte e fabricação.</p>
        </div>
        <div className="project-paths-grid">
          {targetSegments.map(([title, description], index) => (
            <Link href="/cadastro" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><b>{title}</b><small>{description}</small></div>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="section solutions-section">
        <div className="section-heading">
          <div><p className="section-kicker">Gestão integrada</p><h2>Menos retrabalho.<br />Mais lucro por pedido.</h2></div>
          <p>Quando o cliente aprova a proposta pelo link, o pedido entra automaticamente na fila de produção com reserva de material e previsão financeira.</p>
        </div>
        <div className="solution-grid">
          <article className="solution-card feature">
            <span>01 / COMERCIAL & PROPOSTA ONLINE</span>
            <h3>Orçamentos rápidos que fecham mais vendas.</h3>
            <p>Envie propostas profissionais com a sua marca, alternativas de preço no mesmo link e histórico de revisões aprovadas.</p>
            <ul>
              <li>Link público de aprovação para o cliente</li>
              <li>Precificação automática com margem e perda</li>
              <li>Plano de corte enviado direto para o orçamento</li>
              <li>Venda rápida de balcão com baixa de estoque</li>
            </ul>
          </article>
          <article className="solution-card">
            <span>02 / CHÃO DE FÁBRICA</span>
            <h3>Produção previsível do briefing à entrega.</h3>
            <p>Acompanhe etapas, responsáveis, aprovação de arte online pelo cliente, reservas de insumos e custos reais por OS.</p>
            <b>OS · ARTE ONLINE · ESTOQUE · CUSTO REAL</b>
          </article>
          <article className="solution-card">
            <span>03 / FINANCEIRO & EQUIPE</span>
            <h3>Clareza total no caixa e nas permissões.</h3>
            <p>Contas a pagar e receber, recibo digital, ponto de equilíbrio, DRE gerencial e convites individuais por setor.</p>
            <b>PIX · BOLETO · DRE · MULTIUSUÁRIO</b>
          </article>
        </div>
      </section>

      <section className="workflow-section">
        <div><p className="section-kicker">Comece em minutos</p><h2>Da criação da conta<br />ao primeiro orçamento.</h2></div>
        <ol>
          <li><span>01</span><div><b>Crie sua conta grátis</b><p>Cadastre seu nome, e-mail e senha sem precisar de cartão de crédito.</p></div></li>
          <li><span>02</span><div><b>Configure sua empresa</b><p>Adicione logo, dados fiscais e já libere 7 dias de acesso completo.</p></div></li>
          <li><span>03</span><div><b>Convide sua equipe</b><p>Envie links seguros por função para comercial, produção, estoque e financeiro.</p></div></li>
          <li><span>04</span><div><b>Assine no ciclo ideal</b><p>Escolha mensal, trimestral ou anual com PIX, boleto ou cartão pelo Asaas.</p></div></li>
        </ol>
      </section>

      <section id="planos" className="section saas-pricing-section" aria-labelledby="pricing-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Planos transparentes</p>
            <h2 id="pricing-title">Um plano completo.<br />Escolha o melhor ciclo.</h2>
          </div>
          <p>Todos os módulos liberados desde o primeiro dia, com até 10 usuários ativos por empresa e 7 dias grátis para testar na prática.</p>
        </div>

        <div className="saas-pricing-grid">
          {plans.map((plan) => (
            <article key={plan.name} className={plan.featured ? "saas-plan-card featured" : "saas-plan-card"}>
              <div className="saas-plan-top">
                <span className="saas-plan-badge">{plan.badge}</span>
                <h3>Plano Completo · {plan.name}</h3>
              </div>
              <div className="saas-plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>
              <p className="saas-plan-note">{plan.note}</p>
              <Link href="/cadastro" className={plan.featured ? "primary-button saas-plan-cta" : "secondary-button saas-plan-cta"}>
                Começar 7 dias grátis
              </Link>
            </article>
          ))}
        </div>

        <ul className="saas-included-list">
          {includedFeatures.map((item) => (
            <li key={item}><Check className="size-4" /><span>{item}</span></li>
          ))}
        </ul>
      </section>

      <section id="duvidas" className="visitor-faq" aria-labelledby="visitor-faq-title">
        <div className="visitor-faq-heading">
          <p className="section-kicker">Perguntas frequentes</p>
          <h2 id="visitor-faq-title">Tudo claro antes de começar seu teste grátis.</h2>
          <Link href="/cadastro">Criar minha conta grátis <span aria-hidden="true">→</span></Link>
        </div>
        <div className="visitor-faq-list">
          <details open>
            <summary>Preciso cadastrar cartão de crédito para os 7 dias grátis?</summary>
            <p>Não. Você cria sua conta, cadastra sua empresa e testa todos os módulos por 7 dias sem informar cartão.</p>
          </details>
          <details>
            <summary>O que acontece se os 7 dias terminarem antes de eu assinar?</summary>
            <p>Nenhum dado é perdido. A empresa entra em modo somente leitura para consulta e volta a operar normalmente assim que a assinatura for ativada.</p>
          </details>
          <details>
            <summary>Quantas pessoas da minha equipe podem usar o sistema?</summary>
            <p>O Plano Completo inclui até 10 usuários ativos por empresa, com convites individuais por e-mail e controle de funções (administrador, comercial, produção, estoque e financeiro).</p>
          </details>
          <details>
            <summary>Quais formas de pagamento são aceitas?</summary>
            <p>Você pode assinar nos ciclos mensal, trimestral ou anual pagando por PIX, boleto bancário ou cartão de crédito com segurança via Asaas.</p>
          </details>
        </div>
      </section>

      <section id="contato" className="contact-section">
        <div>
          <p className="section-kicker">Pronto para organizar sua operação?</p>
          <h2>Teste o NexoFab na sua<br />empresa por 7 dias grátis.</h2>
        </div>
        <div className="contact-meta saas-final-cta">
          <Link className="primary-button" href="/cadastro">Criar conta grátis</Link>
          <Link className="secondary-button" href="/login">Já tenho conta</Link>
        </div>
      </section>

      <footer>
        <a className="brand nexofab-wordmark" href="#inicio"><span>Nexo</span>Fab</a>
        <p>SaaS multiempresa para orçamentos, precificação, produção, estoque e financeiro</p>
        <small>© {new Date().getFullYear()} NexoFab</small>
      </footer>
    </main>
  );
}
