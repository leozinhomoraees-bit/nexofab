import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
const showDate = (value: unknown) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "A definir";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getManagementAccess(["admin", "comercial", "financeiro"]);
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const { data, error } = await access.supabase
    .from("quote_approval_versions")
    .select("id, version, snapshot, approval_source, approved_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return new Response("Versão aprovada não encontrada.", { status: 404 });

  const snapshot = (data.snapshot ?? {}) as Record<string, unknown>;
  const items = Array.isArray(snapshot.items) ? snapshot.items as Array<Record<string, unknown>> : [];
  const total = Number(snapshot.estimated_value ?? 0);
  const rows = items.map((item) => {
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unit_price ?? 0);
    return `<tr><td><b>${escapeHtml(item.description)}</b><small>${escapeHtml(item.material || item.service_type || "")}</small></td><td>${escapeHtml(quantity)} ${escapeHtml(item.unit || "un")}</td><td>${escapeHtml(money.format(unitPrice))}</td><td><b>${escapeHtml(money.format(Number(item.total ?? quantity * unitPrice)))}</b></td></tr>`;
  }).join("");
  const approvedAt = new Date(data.approved_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposta #${escapeHtml(snapshot.number)} · versão ${data.version}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#e9efef;color:#10262c;font:14px Arial,sans-serif}.sheet{width:min(1000px,calc(100% - 32px));margin:32px auto;background:#fff;box-shadow:0 18px 60px #14303825}.head{padding:30px 38px;display:flex;align-items:center;justify-content:space-between;background:#0e3138;color:#fff}.head img{width:210px;height:auto}.head div{text-align:right}.head small{display:block;color:#8ed8cf;font-weight:700;letter-spacing:.12em}.head b{font-size:26px}.audit{padding:12px 38px;display:flex;justify-content:space-between;gap:20px;background:#eaf7f4;color:#47656a;font-size:11px}.content{padding:36px 38px 44px}.intro{display:grid;grid-template-columns:1fr auto;gap:24px;padding-bottom:24px;border-bottom:1px solid #dfe8e7}.intro small,.section-title{color:#168f84;font-size:10px;font-weight:800;letter-spacing:.11em}.intro h1{margin:7px 0 5px;font-size:28px}.intro p{margin:0;color:#667b80}.total{text-align:right}.total b{display:block;margin-top:6px;color:#087d73;font-size:27px}table{width:100%;margin-top:30px;border-collapse:collapse}th{padding:12px;text-align:left;background:#153f46;color:#fff;font-size:10px}td{padding:15px 12px;border-bottom:1px solid #e4ebea}td small{display:block;margin-top:4px;color:#708287}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.conditions{margin-top:30px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.conditions div{padding:14px;border:1px solid #e0e9e8;border-radius:8px}.conditions span{display:block;color:#7a8b8f;font-size:10px}.conditions b{display:block;margin-top:5px}.notes{margin-top:22px;padding:17px;background:#f5f8f8;line-height:1.6}.actions{width:min(1000px,calc(100% - 32px));margin:0 auto 32px;display:flex;justify-content:flex-end}.actions button{padding:12px 18px;border:0;border-radius:7px;background:#ff6a1a;font-weight:800;cursor:pointer}.footer{padding:21px 38px;display:flex;justify-content:space-between;background:#0e3138;color:#afc5c3;font-size:11px}@media(max-width:650px){.head,.audit,.footer{align-items:flex-start;flex-direction:column}.intro{grid-template-columns:1fr}.total{text-align:left}.conditions{grid-template-columns:1fr}.content,.head,.audit,.footer{padding-inline:22px}table{font-size:11px}}@media print{body{background:#fff}.sheet{width:100%;margin:0;box-shadow:none}.actions{display:none}}
  </style></head><body><main class="sheet"><header class="head"><img src="/favicon.svg" alt="NexoFab"><div><small>CÓPIA IMUTÁVEL APROVADA</small><b>Versão ${data.version}</b></div></header><div class="audit"><span>Aprovada em ${escapeHtml(approvedAt)}</span><span>Origem do aceite: ${data.approval_source === "cliente" ? "cliente" : "equipe"}</span></div><section class="content"><div class="intro"><div><small>PROPOSTA COMERCIAL #${escapeHtml(snapshot.number)}</small><h1>${escapeHtml(snapshot.service)}</h1><p>${escapeHtml(snapshot.company || snapshot.customer_name)}</p></div><div class="total"><small>VALOR APROVADO</small><b>${escapeHtml(money.format(total))}</b></div></div><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${rows || "<tr><td colspan=\"4\">Sem itens registrados.</td></tr>"}</tbody></table><div class="conditions"><div><span>Validade</span><b>${escapeHtml(showDate(snapshot.valid_until))}</b></div><div><span>Prazo de produção</span><b>${snapshot.delivery_days ? `${escapeHtml(snapshot.delivery_days)} dias` : "A definir"}</b></div><div><span>Pagamento</span><b>${escapeHtml(snapshot.payment_terms || "A definir")}</b></div></div>${snapshot.details ? `<div class="notes"><span class="section-title">ESCOPO E OBSERVAÇÕES</span><p>${escapeHtml(snapshot.details)}</p></div>` : ""}</section><footer class="footer"><b>NexoFab</b><span>Documento emitido pela empresa responsável</span></footer></main><div class="actions"><button onclick="window.print()">Imprimir / salvar PDF</button></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
