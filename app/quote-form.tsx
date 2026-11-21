"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const services = [
  ["grandes-formatos", "Grandes formatos", "Banners, adesivos, lonas e painéis"],
  ["cnc", "Router CNC", "ACM, MDF, PVC, acrílico e madeira"],
  ["laser", "Corte a laser", "Corte e gravação de precisão"],
  ["impressao-3d", "Impressão 3D", "Peças, protótipos e personalizados"],
  ["projeto-especial", "Projeto especial", "Fachadas, displays e soluções combinadas"],
];

export function QuoteForm() {
  const [step, setStep] = useState(1);
  const [service, setService] = useState("");
  const [material, setMaterial] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  useEffect(() => {
    const context = typeof document === "undefined" ? undefined : (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: unknown) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "start_quote_request", title: "Iniciar orçamento",
      description: "Abre o orçamento guiado da empresa no serviço escolhido.",
      inputSchema: { type: "object", properties: { service: { type: "string", enum: services.map(([value]) => value) } }, required: ["service"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = (input as { service?: string })?.service;
        if (!services.some(([item]) => item === value)) throw new Error("Serviço inválido");
        setService(value!); setStep(2); document.getElementById("orcamento")?.scrollIntoView({ behavior: "smooth" });
        return { status: "ready", service: value, next: "Preencha as especificações e o contato na tela." };
      },
    }, { signal: controller.signal })).catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/orcamentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, service, material }) });
    setStatus(response.ok ? "success" : "error");
  }

  if (status === "success") return (
    <div className="quote-success"><CheckCircle2 size={42} /><p className="section-kicker">Solicitação registrada</p><h3>Seu projeto já entrou no nosso radar.</h3><p>Nossa equipe vai conferir as especificações e retornar pelo contato informado.</p><Button onClick={() => { setStep(1); setService(""); setStatus("idle"); }} variant="outline">Solicitar outro orçamento</Button></div>
  );

  return (
    <form className="quote-panel" onSubmit={submit}>
      <div className="quote-progress"><span style={{ width: `${step * 33.333}%` }} /></div>
      <div className="quote-head"><span>ETAPA {step} DE 3</span><strong>{step === 1 ? "O que vamos produzir?" : step === 2 ? "Quais são as especificações?" : "Como falamos com você?"}</strong></div>
      {step === 1 && <div className="service-options">{services.map(([value, title, desc]) => <button type="button" key={value} className={service === value ? "selected" : ""} onClick={() => setService(value)}><b>{title}</b><small>{desc}</small></button>)}</div>}
      {step === 2 && <div className="quote-fields">
        <label>Dimensões aproximadas<Input name="dimensions" placeholder="Ex.: 1,20 × 2,00 m" /></label>
        <label>Quantidade<Input name="quantity" type="number" min="1" defaultValue="1" /></label>
        <label>Material<Select value={material} onValueChange={setMaterial}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione ou deixe para definirmos" /></SelectTrigger><SelectContent><SelectItem value="A definir">Quero uma recomendação</SelectItem><SelectItem value="ACM">ACM</SelectItem><SelectItem value="MDF">MDF</SelectItem><SelectItem value="Acrílico">Acrílico</SelectItem><SelectItem value="Vinil adesivo">Vinil adesivo</SelectItem><SelectItem value="Lona">Lona</SelectItem><SelectItem value="PLA/PETG">PLA / PETG</SelectItem></SelectContent></Select></label>
        <label className="wide">Detalhes do projeto<Textarea name="details" placeholder="Conte onde será usado, acabamento desejado, prazo e outras informações importantes." /></label>
      </div>}
      {step === 3 && <div className="quote-fields">
        <label>Nome<Input name="customerName" required autoComplete="name" /></label><label>Empresa<Input name="company" autoComplete="organization" /></label>
        <label>WhatsApp<Input name="phone" required type="tel" autoComplete="tel" placeholder="(00) 90000-0000" /></label><label>E-mail<Input name="email" type="email" autoComplete="email" /></label>
        <p className="wide form-note">Ao enviar, você autoriza nosso contato sobre este orçamento. Nenhum pagamento será realizado nesta etapa.</p>
      </div>}
      {status === "error" && <p className="form-error" role="alert">Não conseguimos salvar agora. Confira os dados e tente novamente.</p>}
      <div className="quote-nav">{step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}><ChevronLeft /> Voltar</Button>}<span />{step < 3 ? <Button type="button" disabled={!service} onClick={() => setStep(step + 1)}>Continuar <ChevronRight /></Button> : <Button type="submit" disabled={status === "sending"}>{status === "sending" ? "Enviando..." : "Enviar para análise"}</Button>}</div>
    </form>
  );
}
