const SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_BASE_URL = "https://api.asaas.com/v3";

export type AsaasEnvironment = "sandbox" | "production";
export type AsaasBillingType = "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
export type AsaasCycle = "MONTHLY" | "QUARTERLY" | "YEARLY";

type AsaasErrorPayload = {
  errors?: Array<{ code?: string; description?: string }>;
};

export function getAsaasEnvironment(): AsaasEnvironment {
  return process.env.ASAAS_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function isAsaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY?.trim());
}

function getAsaasBaseUrl() {
  return getAsaasEnvironment() === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

function getAsaasApiKey() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) throw new Error("Integração Asaas não configurada no servidor.");
  return apiKey;
}

async function asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      access_token: getAsaasApiKey(),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as T & AsaasErrorPayload) : ({} as T & AsaasErrorPayload);
  if (!response.ok) {
    const detail = parsed.errors?.[0]?.description || `Erro ${response.status} na comunicação com o Asaas.`;
    throw new Error(detail);
  }
  return parsed;
}

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

export function isValidCpfOrCnpjLength(value: string | null | undefined) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

export async function ensureAsaasCustomer(input: {
  existingCustomerId?: string | null;
  name: string;
  cpfCnpj: string;
  email?: string | null;
  phone?: string | null;
  externalReference: string;
}): Promise<string> {
  if (input.existingCustomerId) {
    try {
      const existing = await asaasRequest<{ id: string; deleted?: boolean }>(`/customers/${encodeURIComponent(input.existingCustomerId)}`);
      if (existing.id && !existing.deleted) return existing.id;
    } catch {
      // Se o cliente não existir no ambiente atual (ex.: troca sandbox/prod), cria um novo abaixo.
    }
  }

  const created = await asaasRequest<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.slice(0, 120),
      cpfCnpj: onlyDigits(input.cpfCnpj),
      email: input.email || undefined,
      mobilePhone: onlyDigits(input.phone) || undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  });
  return created.id;
}

export async function cancelAsaasSubscriptionIfPresent(subscriptionId: string | null | undefined) {
  if (!subscriptionId) return;
  try {
    await asaasRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
  } catch {
    // Se já estiver removida ou de outro ambiente, segue normalmente.
  }
}

export async function createAsaasSubscription(input: {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: AsaasCycle;
  description: string;
  externalReference: string;
}): Promise<{ id: string; status?: string }> {
  return asaasRequest<{ id: string; status?: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: Number(input.value.toFixed(2)),
      nextDueDate: input.nextDueDate,
      cycle: input.cycle,
      description: input.description.slice(0, 200),
      externalReference: input.externalReference,
    }),
  });
}

export async function getSubscriptionInvoiceUrl(subscriptionId: string): Promise<string | null> {
  const result = await asaasRequest<{ data?: Array<{ invoiceUrl?: string | null; bankSlipUrl?: string | null }> }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`,
  );
  const first = result.data?.[0];
  return first?.invoiceUrl || first?.bankSlipUrl || null;
}

export function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
