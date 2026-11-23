import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const DEMO_PATTERN = "%[Exemplo]%";

export async function POST() {
  const access = await getManagementAccess(["admin"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;

  const { data: existingDemo } = await access.supabase
    .from("customers")
    .select("id")
    .ilike("name", DEMO_PATTERN)
    .limit(1);

  if (existingDemo && existingDemo.length > 0) {
    return Response.json({
      seeded: false,
      alreadySeeded: true,
      message: "Os dados de exemplo já estão carregados nesta empresa.",
    });
  }

  // 1. Regras de precificação padrão (somente se a empresa ainda não configurou)
  const { data: existingSettings } = await access.supabase
    .from("pricing_settings")
    .select("id")
    .eq("id", "default")
    .maybeSingle();

  if (!existingSettings) {
    await access.supabase.from("pricing_settings").upsert({
      id: "default",
      electricity_price_kwh: 0.95,
      labor_cost_hour: 38,
      overhead_hour: 22,
      tax_percent: 6,
      commission_percent: 5,
      contingency_percent: 5,
      target_margin_percent: 35,
      minimum_order_value: 80,
      rounding_increment: 1,
      updated_by: access.user.id,
    });
  }

  // 2. Dois insumos realistas sincronizados com o estoque
  const { data: materials } = await access.supabase
    .from("pricing_materials")
    .insert([
      {
        name: "Lona 440g Brilho [Exemplo]",
        category: "lona",
        format: "rolo",
        package_cost: 920,
        purchase_quantity: 50,
        width_mm: 1600,
        usable_width_mm: 1550,
        length_m: 50,
        default_waste_percent: 10,
        notes: "Material demonstrativo para testar precificação e orçamento.",
        active: true,
        created_by: access.user.id,
      },
      {
        name: "ACM 3mm Preto Fosco [Exemplo]",
        category: "chapa",
        format: "chapa",
        package_cost: 490,
        purchase_quantity: 1,
        width_mm: 1220,
        usable_width_mm: 1200,
        height_mm: 5000,
        default_waste_percent: 12,
        notes: "Chapa demonstrativa para fachadas e plano de corte.",
        active: true,
        created_by: access.user.id,
      },
    ])
    .select("id, name");

  if (materials && materials.length > 0) {
    await access.supabase.from("inventory_items").insert(
      materials.map((material) =>
        material.name.includes("Lona")
          ? {
              id: material.id,
              name: material.name,
              category: "lona",
              unit: "m",
              current_quantity: 42,
              minimum_quantity: 10,
              average_cost: 18.4,
              active: true,
            }
          : {
              id: material.id,
              name: material.name,
              category: "chapa",
              unit: "chapa",
              current_quantity: 6,
              minimum_quantity: 2,
              average_cost: 490,
              active: true,
            },
      ),
    );
  }

  // 3. Máquina demonstrativa
  await access.supabase.from("pricing_machines").insert({
    name: "Plotter Grandes Formatos 1,60m [Exemplo]",
    machine_type: "grandes_formatos",
    purchase_cost: 48000,
    residual_value: 8000,
    useful_life_months: 60,
    productive_hours_month: 120,
    maintenance_monthly: 350,
    power_kw: 1.8,
    setup_minutes: 10,
    speed_m2_hour: 18,
    minimum_minutes: 15,
    notes: "Equipamento demonstrativo criado automaticamente.",
    active: true,
    created_by: access.user.id,
  });

  // 4. Cliente demonstrativo
  const { data: customer, error: customerError } = await access.supabase
    .from("customers")
    .insert({
      person_type: "empresa",
      name: "Marina Costa [Exemplo]",
      company_name: "Café Central Ltda [Exemplo]",
      phone: "(11) 99999-0000",
      whatsapp: "(11) 99999-0000",
      email: "contato.exemplo@nexofab.app",
      address: { city: "São Paulo", state: "SP" },
      notes: "Cliente demonstrativo criado com 1 clique. Você pode remover todos os itens [Exemplo] na Visão geral.",
      billing_cycle: "imediato",
      active: true,
      created_by: access.user.id,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    return Response.json({ error: "Não foi possível criar o cliente de exemplo." }, { status: 500 });
  }

  // 5. Orçamento demonstrativo com 2 itens prontos para testar proposta pública e fechamento
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + 10);
  const validUntil = validUntilDate.toISOString().slice(0, 10);

  const { data: quote, error: quoteError } = await access.supabase
    .from("quotes")
    .insert({
      customer_id: customer.id,
      customer_name: "Marina Costa [Exemplo]",
      company: "Café Central Ltda [Exemplo]",
      phone: "(11) 99999-0000",
      email: "contato.exemplo@nexofab.app",
      service: "Fachada em ACM + Banner promocional [Exemplo]",
      dimensions: "3,00 × 1,00 m",
      material: "ACM 3mm + Lona 440g",
      details: "Orçamento demonstrativo pronto para testar geração de link público, visualização pelo cliente e fechamento em OS.",
      quantity: 3,
      status: "em_analise",
      source: "interno",
      subtotal: 2680,
      discount: 0,
      estimated_value: 2680,
      valid_until: validUntil,
      payment_terms: "50% na aprovação e 50% na entrega",
      delivery_days: 7,
      installation_included: true,
      freight: 0,
      created_by: access.user.id,
    })
    .select("id, number")
    .single();

  if (quoteError || !quote) {
    return Response.json({ error: "Não foi possível criar o orçamento de exemplo." }, { status: 500 });
  }

  await access.supabase.from("quote_items").insert([
    {
      quote_id: quote.id,
      description: "Revestimento de fachada em ACM 3mm Preto Fosco [Exemplo]",
      service_type: "router_cnc",
      material: "ACM 3mm Preto Fosco [Exemplo]",
      width_mm: 3000,
      height_mm: 1000,
      quantity: 1,
      unit: "un",
      unit_cost: 1120,
      unit_price: 2200,
      production_notes: "Usinagem com dobra de 30mm e fixação estrutural.",
      pricing_source: "manual",
      sort_order: 0,
    },
    {
      quote_id: quote.id,
      description: "Banner promocional em Lona 440g com ilhós [Exemplo]",
      service_type: "impressao",
      material: "Lona 440g Brilho [Exemplo]",
      width_mm: 1200,
      height_mm: 2000,
      quantity: 2,
      unit: "un",
      unit_cost: 95,
      unit_price: 240,
      production_notes: "Acabamento com bastão, cordão e ilhós nas laterais.",
      pricing_source: "manual",
      sort_order: 1,
    },
  ]);

  return Response.json(
    {
      seeded: true,
      quoteNumber: quote.number,
      message: "Dados de exemplo carregados! Explore Orçamentos, Precificação, Estoque e Clientes.",
    },
    { status: 201 },
  );
}

export async function DELETE() {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;

  // Remove estritamente itens marcados com [Exemplo] da organização ativa (respeitando RLS)
  await access.supabase.from("quotes").delete().ilike("service", DEMO_PATTERN);
  await access.supabase.from("customers").delete().ilike("name", DEMO_PATTERN);
  await access.supabase.from("pricing_machines").delete().ilike("name", DEMO_PATTERN);
  await access.supabase.from("inventory_items").delete().ilike("name", DEMO_PATTERN);
  await access.supabase.from("pricing_materials").delete().ilike("name", DEMO_PATTERN);

  return Response.json({
    cleared: true,
    message: "Dados de exemplo removidos com segurança.",
  });
}
