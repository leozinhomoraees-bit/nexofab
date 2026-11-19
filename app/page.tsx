import { QuoteForm } from "./quote-form";
import { HeroMedia } from "./hero-media";

const processes = [
  ["01", "Grandes formatos", "Impressão para projetos de pequeno a grande porte, com materiais e acabamentos sob medida."],
  ["02", "Router CNC", "Cortes precisos em ACM, MDF, PVC, acrílico e projetos especiais."],
  ["03", "Corte a laser", "Corte e gravação com acabamento limpo para peças e comunicação visual."],
  ["04", "Impressão 3D", "Protótipos, peças técnicas e objetos personalizados sob medida."],
];

const projectPaths = [
  ["Fachadas e letreiros", "ACM, lona, letras caixa e iluminação"],
  ["Plotagem", "Vitrines, paredes, placas e veículos"],
  ["Sinalização", "Ambientes, segurança e orientação"],
  ["PDV e eventos", "Displays, painéis e peças promocionais"],
  ["Peças sob medida", "Corte CNC, laser e gravação"],
  ["Protótipos", "Impressão 3D e validação de ideias"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07111d] text-white">
      <nav className="site-nav">
        <a className="brand nexofab-wordmark" href="#inicio" aria-label="NexoFab — início"><span>Nexo</span>Fab</a>
        <div className="nav-links" aria-label="Navegação principal">
          <a href="#servicos">Serviços</a><a href="#solucoes">Soluções</a>
          <a href="#portfolio">Projetos</a><a href="#contato">Contato</a>
        </div>
        <a className="nav-cta" href="#orcamento">Pedir orçamento</a>
      </nav>
      <section id="inicio" className="hero">
        <HeroMedia />
        <div className="hero-shade" /><div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow"><span /> Gestão conectada de ponta a ponta</p>
          <h1>Do arquivo à<br /><em>matéria.</em></h1>
          <p className="hero-copy">Da fachada ao protótipo: impressão, corte e fabricação combinados para transformar sua ideia em uma solução pronta para usar.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#orcamento">Solicitar orçamento</a>
            <a className="secondary-button" href="#portfolio">Conhecer possibilidades</a>
          </div>
          <div className="hero-proof">
            <div><strong>Sob medida</strong><span>cada projeto começa pela aplicação</span></div>
            <div><strong>4 tecnologias</strong><span>processos que trabalham juntos</span></div>
            <div><strong>De ponta a ponta</strong><span>produção, acabamento e instalação</span></div>
          </div>
        </div>
        <div className="hero-capability" aria-label="Tecnologias disponíveis">
          <span>Produção conectada</span>
          <b>Impressão <i /> CNC <i /> Laser <i /> 3D</b>
        </div>
        <p className="vertical-label">IMPRESSÃO · CORTE · FORMA · ACABAMENTO</p>
      </section>
      <section id="servicos" className="process-strip" aria-label="Nossos processos">
        {processes.map(([number, title, description]) => (
          <article key={title}><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></article>
        ))}
      </section>

      <section className="project-paths" aria-labelledby="project-paths-title">
        <div className="project-paths-intro">
          <p className="section-kicker">Comece pela necessidade</p>
          <h2 id="project-paths-title">O que você precisa produzir?</h2>
          <p>Não é necessário saber o material ou a máquina. Conte onde será usado e nós indicamos o processo adequado.</p>
        </div>
        <div className="project-paths-grid">
          {projectPaths.map(([title, description], index) => (
            <a href="#orcamento" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><b>{title}</b><small>{description}</small></div>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </div>
      </section>

      <section id="solucoes" className="section solutions-section">
        <div className="section-heading"><div><p className="section-kicker">Capacidade conectada</p><h2>Uma oficina.<br />Muitas possibilidades.</h2></div><p>Combinamos impressão, corte e fabricação para entregar desde uma peça única até projetos completos de comunicação visual.</p></div>
        <div className="solution-grid">
          <article className="solution-card feature"><span>01 / COMUNICAÇÃO VISUAL</span><h3>Sua marca ocupando o espaço certo.</h3><p>Fachadas, sinalização, painéis, plotagem, banners, displays e ambientação produzidos com consistência de cor e acabamento.</p><ul><li>Fachadas e letreiros</li><li>Plotagem e vitrines</li><li>Sinalização interna e externa</li><li>Materiais para eventos e PDV</li></ul></article>
          <article className="solution-card"><span>02 / FABRICAÇÃO DIGITAL</span><h3>Geometrias que saem da tela.</h3><p>Router CNC e laser para projetos de arquitetos, designers, indústrias, lojas e criadores.</p><b>ACM · MDF · PVC · ACRÍLICO · MADEIRA</b></article>
          <article className="solution-card"><span>03 / PROTOTIPAGEM</span><h3>Teste antes de produzir em escala.</h3><p>Impressão 3D para validar encaixes, formas, peças técnicas e ideias personalizadas.</p><b>PLA · PETG · PEÇAS TÉCNICAS · MOCKUPS</b></article>
        </div>
      </section>

      <section id="portfolio" className="section portfolio-section">
        <div className="section-heading light"><div><p className="section-kicker">Do problema à entrega</p><h2>Projetos feitos para<br />funcionar de verdade.</h2></div><p>Nem todo projeto cabe em um catálogo. Nossa força está em entender a aplicação, combinar processos e encontrar uma solução viável.</p></div>
        <div className="project-grid">
          <article className="project-card orange"><span>FACHADAS</span><strong>Presença que começa antes da porta.</strong><small>ACM · impressão · corte CNC · instalação</small></article>
          <article className="project-card cyan"><span>PDV & EVENTOS</span><strong>Estruturas que montam, comunicam e resistem.</strong><small>Displays · painéis · adesivos · peças especiais</small></article>
          <article className="project-card blue"><span>PRODUTO & INDÚSTRIA</span><strong>Protótipos e componentes sob medida.</strong><small>Impressão 3D · laser · usinagem</small></article>
        </div>
      </section>

      <section className="workflow-section">
        <div><p className="section-kicker">Processo sem surpresa</p><h2>Você sabe onde<br />o projeto está.</h2></div>
        <ol><li><span>01</span><div><b>Briefing técnico</b><p>Entendemos uso, medidas, prazo e acabamento.</p></div></li><li><span>02</span><div><b>Orçamento claro</b><p>Especificações e condições reunidas em uma proposta.</p></div></li><li><span>03</span><div><b>Prova e produção</b><p>Aprovação antes de ocupar máquina e material.</p></div></li><li><span>04</span><div><b>Entrega ou instalação</b><p>Conferência final e fechamento do serviço.</p></div></li></ol>
      </section>

      <section id="orcamento" className="section quote-section">
        <div className="quote-intro"><p className="section-kicker">Orçamento guiado</p><h2>Conte o essencial.<br />Nós cuidamos do técnico.</h2><p>Escolha o tipo de produção e informe o que já sabe. Se material ou acabamento ainda forem dúvida, nossa equipe recomenda a melhor opção.</p><div className="quote-note"><b>Projeto complexo?</b><span>Envie a ideia mesmo assim. Fachadas, instalações e peças especiais passam por análise técnica.</span></div></div>
        <QuoteForm />
      </section>

      <section className="visitor-faq" aria-labelledby="visitor-faq-title">
        <div className="visitor-faq-heading">
          <p className="section-kicker">Antes de começar</p>
          <h2 id="visitor-faq-title">Dúvidas que não precisam atrasar seu projeto.</h2>
          <a href="#orcamento">Enviar minha ideia <span aria-hidden="true">→</span></a>
        </div>
        <div className="visitor-faq-list">
          <details open>
            <summary>Não sei qual material escolher. Posso pedir orçamento?</summary>
            <p>Sim. Informe a aplicação, as medidas aproximadas e se o uso será interno ou externo. A recomendação técnica entra na análise.</p>
          </details>
          <details>
            <summary>Vocês fazem projetos que combinam mais de um processo?</summary>
            <p>Sim. Fachadas, displays, sinalização e peças especiais podem reunir impressão, corte, estrutura, acabamento e instalação.</p>
          </details>
          <details>
            <summary>Preciso ter o arquivo pronto?</summary>
            <p>Não necessariamente. Envie o que já tiver — referência, foto, medidas ou descrição — para avaliarmos o próximo passo.</p>
          </details>
          <details>
            <summary>Como recebo a proposta?</summary>
            <p>Depois da análise, você recebe uma proposta com especificações, valores e condições para aprovar com clareza.</p>
          </details>
        </div>
      </section>

      <section id="contato" className="contact-section">
        <div><p className="section-kicker">Operação conectada</p><h2>Vamos colocar<br />sua ideia em produção?</h2></div>
        <div className="contact-meta"><p><span>ATENDIMENTO</span>Atendimento conforme sua empresa</p><p><span>HORÁRIO</span>Segunda a sexta · horário comercial</p></div>
      </section>
      <footer><a className="brand nexofab-wordmark" href="#inicio"><span>Nexo</span>Fab</a><p>Gestão conectada para fabricação</p><small>© {new Date().getFullYear()} NexoFab</small></footer>
    </main>
  );
}
