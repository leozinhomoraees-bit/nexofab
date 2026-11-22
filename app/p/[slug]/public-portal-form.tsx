"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PUBLIC_PORTAL_MATERIALS, PUBLIC_PORTAL_SERVICES } from "@/lib/public-portal";
import { whatsappUrl } from "@/lib/whatsapp";

type Props = {
  slug: string;
  tradeName: string;
  whatsapp: string | null;
};

type SubmittedResult = {
  quoteNumber: number | null;
  tradeName: string;
  whatsapp: string | null;
  service: string;
  customerName: string;
};

export function PublicPortalForm({ slug, tradeName, whatsapp }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [service, setService] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [material, setMaterial] = useState<string>("A definir");
  const [details, setDetails] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<SubmittedResult | null>(null);

  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  function resetForm() {
    setStep(1);
    setService("");
    setDimensions("");
    setQuantity("1");
    setMaterial("A definir");
    setDetails("");
    setCustomerName("");
    setCompany("");
    setPhone("");
    setEmail("");
    setWebsite("");
    setError("");
    setSubmitted(null);
    startedAtRef.current = Date.now();
  }

  function nextStep() {
    setError("");
    if (step === 1) {
      if (!service.trim()) {
        setError("Escolha o tipo de serviço para continuar.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const parsedQty = Number.parseInt(quantity, 10);
      if (!Number.isFinite(parsedQty) || parsedQty < 1) {
        setError("Informe uma quantidade válida (mínimo 1).");
        return;
      }
      setStep(3);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          dimensions,
          quantity: Number.parseInt(quantity, 10) || 1,
          material,
          details,
          customerName,
          company,
          phone,
          email,
          website,
          formStartedAt: startedAtRef.current ?? Date.now(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        quoteNumber?: number | null;
        tradeName?: string | null;
        whatsapp?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível enviar sua solicitação. Tente novamente.");
      }

      setSubmitted({
        quoteNumber: payload.quoteNumber ?? null,
        tradeName: payload.tradeName || tradeName,
        whatsapp: payload.whatsapp ?? whatsapp,
        service,
        customerName,
      });
    } catch (caught) {
      setError((caught as Error).message || "Não foi possível enviar agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    const protocolText = submitted.quoteNumber ? ` #${submitted.quoteNumber}` : "";
    const waLink = whatsappUrl(
      submitted.whatsapp,
      `Olá, ${submitted.tradeName}! Acabei de enviar a solicitação de orçamento${protocolText} (${submitted.service}) pelo portal. Meu nome é ${submitted.customerName}.`,
    );

    return (
      <div className="portal-success" role="status">
        <span className="portal-success-icon">
          <CheckCircle2 />
        </span>
        {submitted.quoteNumber && (
          <span className="portal-protocol">PROTOCOLO #{submitted.quoteNumber}</span>
        )}
        <h3>Solicitação enviada com sucesso!</h3>
        <p>
          A equipe da <b>{submitted.tradeName}</b> recebeu os detalhes do seu pedido de{" "}
          <b>{submitted.service}</b> e retornará pelo contato informado.
        </p>
        <div className="portal-success-actions">
          {waLink && (
            <Button asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                Falar no WhatsApp agora
              </a>
            </Button>
          )}
          <Button type="button" variant="outline" onClick={resetForm}>
            Solicitar outro orçamento
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="portal-form" onSubmit={handleSubmit}>
      <div className="portal-steps" aria-label="Progresso do orçamento">
        <div className={`portal-step-pill ${step === 1 ? "active" : "done"}`}>
          <span>{step > 1 ? <Check size={13} /> : "1"}</span>
          Serviço
        </div>
        <div className={`portal-step-pill ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
          <span>{step > 2 ? <Check size={13} /> : "2"}</span>
          Especificações
        </div>
        <div className={`portal-step-pill ${step === 3 ? "active" : ""}`}>
          <span>3</span>
          Seu contato
        </div>
      </div>

      <div className="portal-step-heading">
        <small>ETAPA {step} DE 3</small>
        <strong>
          {step === 1
            ? "O que você precisa produzir?"
            : step === 2
              ? "Conte as medidas e os detalhes do projeto"
              : "Como podemos retornar com o seu orçamento?"}
        </strong>
      </div>

      {step === 1 && (
        <div className="portal-service-grid">
          {PUBLIC_PORTAL_SERVICES.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`portal-service-card ${service === item.value ? "selected" : ""}`}
              onClick={() => {
                setService(item.value);
                setError("");
              }}
            >
              <b>{item.title}</b>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="portal-fields">
          <label>
            Dimensões aproximadas
            <Input
              value={dimensions}
              onChange={(event) => setDimensions(event.target.value)}
              placeholder="Ex.: 1,20 × 2,00 m ou 30 × 40 cm"
              maxLength={120}
            />
          </label>
          <label>
            Quantidade
            <Input
              type="number"
              min={1}
              max={1000000}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
          <label className="wide">
            Material preferencial
            <select
              className="portal-select"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            >
              {PUBLIC_PORTAL_MATERIALS.map((item) => (
                <option key={item} value={item}>
                  {item === "A definir" ? "Quero uma recomendação da equipe" : item}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Detalhes do projeto
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Informe onde será aplicado, acabamento desejado, se precisa de instalação e o prazo esperado."
              rows={4}
              maxLength={1800}
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="portal-fields">
          <label>
            Seu nome *
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="Como devemos te chamar?"
            />
          </label>
          <label>
            Empresa (opcional)
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              maxLength={120}
              autoComplete="organization"
              placeholder="Nome da sua empresa"
            />
          </label>
          <label>
            WhatsApp / telefone *
            <Input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              minLength={8}
              maxLength={40}
              autoComplete="tel"
              placeholder="(00) 90000-0000"
            />
          </label>
          <label>
            E-mail (opcional)
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={180}
              autoComplete="email"
              placeholder="voce@empresa.com.br"
            />
          </label>

          <div className="portal-hp" aria-hidden="true">
            <label htmlFor="portal-website">
              Website
              <input
                id="portal-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
          </div>

          <p className="portal-consent">
            <ShieldCheck />
            <span>
              Ao enviar, você autoriza <b>{tradeName}</b> a entrar em contato sobre este orçamento.
              Nenhum pagamento é cobrado nesta etapa.
            </span>
          </p>
        </div>
      )}

      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}

      <div className="portal-nav">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("");
              setStep((current) => (current === 3 ? 2 : 1));
            }}
            disabled={sending}
          >
            <ChevronLeft />
            Voltar
          </Button>
        ) : (
          <span />
        )}

        {step < 3 ? (
          <Button type="button" onClick={nextStep} disabled={step === 1 && !service}>
            Continuar
            <ChevronRight />
          </Button>
        ) : (
          <Button type="submit" disabled={sending}>
            {sending ? <LoaderCircle className="spin" /> : null}
            {sending ? "Enviando pedido..." : "Enviar solicitação de orçamento"}
          </Button>
        )}
      </div>
    </form>
  );
}
