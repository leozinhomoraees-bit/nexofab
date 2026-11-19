"use client";

import { useMemo, useState } from "react";
import { Check, CircleHelp, Layers3 } from "lucide-react";
import { ProposalActions } from "./proposal-actions";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export type ProposalItem = {
  id: string; description: string; service_type?: string | null; material?: string | null;
  width_mm?: number | null; height_mm?: number | null; quantity: number; unit: string;
  unit_price: number; total: number; sort_order: number; option_group?: string | null;
  selected_by_customer?: boolean | null;
};

function ItemDescription({ item }: { item: ProposalItem }) {
  return <div><b>{item.description}</b><small>{item.material || item.service_type || "Produção personalizada"}{item.width_mm && item.height_mm ? ` · ${item.width_mm} × ${item.height_mm} mm` : ""}</small></div>;
}

export function ProposalConfigurator({ items, token, status, quoteNumber, freight, discount, deliveryDays, paymentTerms, installationIncluded, expired }: {
  items: ProposalItem[]; token: string; status: string; quoteNumber: number; freight: number; discount: number;
  deliveryDays?: number | null; paymentTerms?: string | null; installationIncluded?: boolean | null; expired: boolean;
}) {
  const fixedItems = items.filter((item) => !item.option_group);
  const groups = useMemo(() => {
    const result = new Map<string, ProposalItem[]>();
    for (const item of items.filter((entry) => entry.option_group)) {
      const name = item.option_group!.trim();
      result.set(name, [...(result.get(name) ?? []), item]);
    }
    return [...result.entries()];
  }, [items]);
  const locked = ["aprovado", "convertido"].includes(status);
  const initial = Object.fromEntries(groups.flatMap(([group, entries]) => {
    const selected = entries.find((item) => item.selected_by_customer === true);
    return selected ? [[group, selected.id]] : [];
  }));
  const [selections, setSelections] = useState<Record<string, string>>(initial);
  const selectedItems = groups.map(([group, entries]) => entries.find((item) => item.id === selections[group])).filter((item): item is ProposalItem => Boolean(item));
  const choicesComplete = groups.every(([group]) => Boolean(selections[group]));
  const subtotal = [...fixedItems, ...selectedItems].reduce((sum, item) => sum + Number(item.total ?? Number(item.quantity) * Number(item.unit_price)), 0);
  const appliedDiscount = Math.min(Number(discount || 0), subtotal);
  const total = Math.max(0, subtotal + Number(freight || 0) - appliedDiscount);

  return <>
    {groups.length > 0 && <section className={`proposal-choice-guide ${choicesComplete ? "complete" : ""}`}><span>{choicesComplete ? <Check/> : <CircleHelp/>}</span><div><small>ESTA PROPOSTA POSSUI ALTERNATIVAS</small><b>{locked ? "Confira abaixo a opção aprovada" : "Escolha uma opção em cada grupo"}</b><p>{locked ? "A opção marcada faz parte do pedido aprovado." : "Os itens de cada grupo são alternativas: você não está comprando todos. Toque na opção desejada e o total será atualizado automaticamente."}</p></div></section>}

    {fixedItems.length > 0 && <section className="proposal-items-section"><header><div><Layers3/><span><small>ITENS INCLUSOS</small><b>Estes itens fazem parte da proposta</b></span></div></header><div className="proposal-items"><div className="proposal-table-head"><span>Descrição</span><span>Qtd.</span><span>Valor unitário</span><span>Total</span></div>{fixedItems.map((item) => <article key={item.id}><ItemDescription item={item}/><span data-label="Quantidade">{Number(item.quantity)} {item.unit}</span><span data-label="Unitário">{currency.format(Number(item.unit_price))}</span><strong data-label="Total">{currency.format(Number(item.total ?? Number(item.quantity) * Number(item.unit_price)))}</strong></article>)}</div></section>}

    {groups.map(([group, entries], groupIndex) => {
      const minimum = Math.min(...entries.map((item) => Number(item.total)));
      return <section className="proposal-choice-group" key={group}><header><span>{groupIndex + 1}</span><div><small>ESCOLHA OBRIGATÓRIA</small><h3>{group}</h3><p>Selecione somente uma das alternativas abaixo.</p></div>{selections[group] && <em><Check/>Opção selecionada</em>}</header><div>{entries.map((item) => {
        const checked = selections[group] === item.id;
        const difference = Number(item.total) - minimum;
        return <label key={item.id} className={checked ? "selected" : ""}><input type="radio" name={`choice-${groupIndex}`} value={item.id} checked={checked} disabled={locked} onChange={() => setSelections((current) => ({ ...current, [group]: item.id }))}/><span className="choice-radio">{checked && <Check/>}</span><ItemDescription item={item}/><span className="choice-quantity"><small>QUANTIDADE</small><b>{Number(item.quantity)} {item.unit}</b><em>{Number(item.quantity)} × {currency.format(Number(item.unit_price))}</em></span><span className="choice-price"><small>TOTAL DA OPÇÃO</small><b>{currency.format(Number(item.total))}</b><em>{difference > 0 ? `+ ${currency.format(difference)} sobre a opção mais econômica` : "Opção mais econômica"}</em></span></label>;
      })}</div></section>;
    })}

    <div className="proposal-bottom"><div className="proposal-conditions"><h3>Condições comerciais</h3><dl><div><dt>Prazo de produção</dt><dd>{deliveryDays ? `${deliveryDays} dias` : "A definir"}</dd></div><div><dt>Pagamento</dt><dd>{paymentTerms || "A combinar"}</dd></div><div><dt>Instalação</dt><dd>{installationIncluded ? "Inclusa" : "Não inclusa"}</dd></div></dl></div><div className="proposal-totals"><div><span>Itens selecionados</span><b>{currency.format(subtotal)}</b></div>{Number(freight) > 0 && <div><span>Frete / deslocamento</span><b>{currency.format(Number(freight))}</b></div>}{appliedDiscount > 0 && <div><span>Desconto</span><b>- {currency.format(appliedDiscount)}</b></div>}<div className="proposal-total"><span>{choicesComplete ? "Total da sua escolha" : "Total parcial"}</span><strong>{currency.format(total)}</strong></div>{groups.length > 0 && !choicesComplete && <p className="proposal-total-help">O valor final aparecerá após selecionar uma opção em cada grupo.</p>}</div></div>

    {expired ? <div className="proposal-expired no-print">Esta proposta está fora da validade. Entre em contato para receber valores atualizados.</div> : <ProposalActions token={token} initialStatus={status} quoteNumber={quoteNumber} selectedItemIds={selectedItems.map((item) => item.id)} choicesComplete={choicesComplete}/>} 
  </>;
}
