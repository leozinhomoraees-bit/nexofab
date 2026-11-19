# Roadmap — NexoFab

Documento vivo do projeto. Marque como concluído somente depois de implementação, validação visual e teste do fluxo completo.

Legenda: `[x]` concluído · `[-]` em desenvolvimento · `[ ]` pendente

## 1. Fundação e segurança

- [x] Autenticação com Supabase
- [x] Perfil administrador e permissões básicas por função
- [x] Site público e painel interno separados
- [x] Deploy Vercel e banco Supabase configurados
- [ ] Revisão completa das políticas RLS
- [ ] Auditoria de alterações críticas
- [ ] Rotina de backup e recuperação
- [ ] Ambiente separado para testes e produção
- [ ] Testes automatizados dos cálculos financeiros e produtivos

## 2. Clientes e CRM

- [x] Cadastro profissional de clientes
- [x] Histórico básico de orçamentos por cliente
- [x] Busca inteligente de clientes com teclado e contas com fechamento semanal/mensal
- [ ] Funil comercial completo
- [x] Retornos de propostas, validade, aprovações e cobranças pendentes
- [ ] Tarefas livres com responsável e agenda
- [ ] Histórico de conversas e contatos
- [ ] Segmentação e origem dos clientes
- [ ] Indicadores de conversão e ticket médio
- [ ] Central manual de atendimentos do WhatsApp: responsável, situação, prazo de retorno, histórico e alertas, sem mensalidade externa
- [ ] Integração futura direta com a WhatsApp Cloud API usando número exclusivo, com recebimento automático e atendimento dentro do sistema

## 3. Orçamentos e precificação

- [x] Orçamentos com múltiplos itens
- [x] Custo, margem, comissão, nota fiscal e instalação
- [x] Valores mínimo, recomendado e premium
- [x] Memória detalhada do cálculo
- [x] Aproveitamento de rolos, chapas, perdas e orientação
- [x] Verniz protetor para lona e adesivo
- [x] Estruturas, envelopamento, impressão rápida e letra-caixa
- [x] Medalhas com chapa, fita, adesivo, corte e gravação
- [x] Placa adesivada com chapa, adesivo, impressão, corte, proteção e aproveitamento
- [x] Placa de ACM com letras em PVC ou impressão 3D, máquinas, iluminação e aproveitamento
- [-] Caixas e expositores com medidas internas/externas, lista de painéis, tampa, divisórias, prateleiras e encaixe na chapa (implementado localmente; falta validar com projetos reais)
- [x] Insumos de fixação com fita por perímetro e parafusos/rebites por espaçamento, integrados ao custo e ao estoque
- [x] Fichas técnicas configuráveis visíveis no seletor de tipo de cálculo
- [x] Modo independente “somente serviço de máquina”, por minutos ou horas, com material fornecido pelo cliente
- [x] Pesquisa dedicada de orçamentos por número, cliente, contato, projeto, material e item
- [-] Venda rápida de balcão integrada ao histórico, estoque e financeiro (implementada e validada localmente; falta aplicar a migração no Supabase)
- [-] Itens avulsos com preço manual e memória de nota/comissão (implementado; falta validar o fluxo completo)
- [-] Biblioteca de itens de licitação reutilizável nos orçamentos (implementado; falta aplicar a migração e validar)
- [ ] Tabela de preço por cliente ou grupo
- [ ] Regras de desconto e aprovação por limite
- [-] Edição com histórico imutável e PDF das versões aprovadas (implementado e migrado; falta validar o fluxo completo)
- [-] Alternativas no mesmo orçamento, seleção pública e total dinâmico (implementado; falta aplicar migração e validar)
- [-] Modelos reutilizáveis de composição técnica (implementado localmente; falta aplicar a migração e validar salvamento/reuso)
- [-] Auditoria inteligente por item com bloqueios críticos e comparação histórica (implementada localmente; falta validar com a base real)
- [-] Comparação custo previsto × custo realizado por ordem (implementada localmente; falta aplicar migração e validar com uma OS real)

## 4. Proposta pública

- [x] Link público por orçamento
- [x] Aprovação e recusa pelo cliente
- [x] Impressão e PDF pelo navegador
- [x] Ação de WhatsApp após resposta
- [-] Central de notificações de respostas
- [ ] Assinatura eletrônica e aceite de termos
- [-] Upload de print/PDF e aprovação pública de arte por versão, com observações do cliente (implementado localmente; falta aplicar migrações e validar)
- [ ] Pagamento de entrada pelo link
- [-] Identidade da empresa contratada na proposta (logo, razão social, CNPJ, contatos e endereço implementados localmente; falta aplicar `202611090002_company_identity.sql` e validar)

## 4.1. Plataforma comercial / multiempresa

- [-] Cadastro da empresa e identidade visual por organização (base implementada localmente)
- [-] Vínculo da empresa emissora a cada orçamento (base implementada localmente)
- [ ] Isolamento completo de clientes, produtos, estoque, financeiro e produção por empresa
- [ ] Convite de usuários e permissões por empresa
- [ ] Planos, limites de uso, assinatura e cobrança recorrente
- [ ] Onboarding assistido, período de teste e importação inicial de dados
- [ ] Auditoria, política de privacidade, termos de uso, LGPD e rotina de backups

## 5. Estoque e compras

- [x] Cadastro e ajuste básico de estoque
- [x] Insumos vinculados à precificação
- [ ] Unificação definitiva entre insumos e estoque
- [-] Reserva automática ao aprovar orçamento (implementada localmente; falta aplicar migração e validar saldos reais)
- [x] Baixa automática ao concluir produção
- [ ] Controle de rolos por largura e saldo linear
- [ ] Controle de retalhos e sobras reutilizáveis
- [-] Apropriação proporcional de chapas com sobra tratada como retalho reutilizável (implementado; falta validar com MDF e acrílico reais)
- [ ] Lotes, validade e localização
- [ ] Solicitação e pedido de compra
- [ ] Cotação entre fornecedores
- [ ] Entrada por nota fiscal e atualização do custo médio
- [ ] Sugestão automática de reposição

## 6. Produção

- [x] Ordem de serviço gerada no fechamento
- [x] Etapas básicas de produção
- [-] Aprovação da arte integrada por versão e link público (implementada localmente; falta aplicar migração e validar)
- [-] Reserva e requisição de materiais (implementada localmente; falta aplicar migração e validar)
- [ ] Apontamento de tempo por operador e máquina
- [ ] Checklist de qualidade
- [-] Retrabalho, perda e motivo (lançamento financeiro implementado; falta validar na operação)
- [-] Agenda de produção com início, prazo e responsável (implementada localmente; falta aplicar migração e validar)
- [-] Custo real da ordem de produção (implementado localmente; falta aplicar migração e validar)
- [ ] Capacidade e fila de cada máquina
- [-] Plano de corte inteligente: importação DXF/SVG, união de segmentos, conferência de escala, encaixe seguro, estimativa de linha/tempo/custo, prévia e exportação DXF para RDWorks/Aspire (primeira versão local implementada; falta validar com arquivos reais)
- [ ] Encaixe irregular avançado por contorno real, respeitando furos internos e retalhos não retangulares
- [ ] Conversão normalizada de PDF vetorial e EPS com conferência obrigatória de escala
- [ ] Vínculo do plano de corte ao item do orçamento, reserva de chapa/retalho e ordem de serviço

## 7. Financeiro

- [x] Recebimento de entrada integrado ao orçamento
- [x] Ponto de equilíbrio contábil, financeiro e econômico
- [x] Cadastro completo de fornecedores
- [x] Contas a pagar com categorias e centros de custo
- [-] Rateio produtivo opcional por centro de custo e máquina, mantendo o cálculo global quando não configurado (implementado localmente; falta aplicar migração e validar)
- [x] Boletos, linha digitável, PIX e links de documentos
- [x] Parcelamento, recorrência e agenda de vencimentos
- [x] Pagamento com juros, multa, desconto e comprovante
- [x] Indicadores de aberto, vencido, hoje e pago
- [x] Aplicar e validar a migração de contas a pagar no Supabase
- [-] Contas a receber e parcelamento dos clientes (implementado; falta aplicar migração e validar no Supabase)
- [ ] Conciliação bancária
- [ ] Contas bancárias e saldo por conta
- [ ] Taxas de cartão e previsão de recebimento
- [-] Relatório de comissões por período e leitura de impostos/comissão no orçamento (implementado; falta validar com uma venda real)
- [-] Recibo público por recebimento, impressão/PDF e envio por WhatsApp (implementado; falta aplicar migração e validar)
- [-] Fluxo de caixa realizado e projetado (implementado localmente; falta validar com vencimentos reais)
- [-] DRE gerencial por regime de caixa (implementada localmente; falta validar classificações fixas/variáveis)
- [ ] Orçamento financeiro mensal
- [ ] Inadimplência e cobrança
- [-] Lembretes de pedidos fechados sem pagamento e aprovados aguardando produção (implementado e migrado; falta validar com dados reais)
- [x] Integração das contas pagas ao ponto de equilíbrio
- [-] Upload privado de boletos e documentos (implementado; falta aplicar migração e validar no Supabase)
- [-] Leitura automática de PDF/XML com revisão antes do lançamento
- [ ] OCR para boletos digitalizados como imagem
- [ ] Emissão fiscal integrada: NFS-e para serviços e NF-e/NFC-e para produtos, condicionada à definição fiscal com a contabilidade e às credenciais/certificado do emitente

## 8. Relatórios e inteligência

- [ ] Lucro por produto, cliente e vendedor
- [ ] Margem prevista × realizada
- [ ] Materiais com maior perda
- [ ] Produtividade por máquina
- [ ] Produtos mais vendidos
- [ ] Clientes inativos e recorrentes
- [ ] Previsão de caixa e compras
- [-] Alertas inteligentes de preço, custo, margem, perda e histórico fora do saudável (implementados localmente; falta validar com a base real)

## Próxima sequência recomendada

1. Aplicar a migração `202610300001_quick_sales.sql` e validar uma venda recebida e outra a prazo.
2. Validar edição, versões aprovadas e contas de clientes.
3. Validar PDF/XML com arquivos reais e evoluir o OCR para documentos digitalizados.
4. Aplicar `202611060002_production_reservations_actual_costs.sql` e validar reserva, agenda e custo realizado em uma OS.
5. Aplicar `202611060003_artwork_approvals.sql` e validar aprovação e pedido de ajustes pelo link público.

## Validações realizadas

- 08/10/2026 — Contas a pagar: fornecedor criado, conta recorrente de R$ 300,00 distribuída em três parcelas mensais, boleto registrado e primeira parcela baixada por R$ 100,00. Indicadores de aberto e pago foram recalculados corretamente no Supabase.
- 08/10/2026 — Ponto de equilíbrio: a parcela paga de R$ 100,00, classificada como custo variável, entrou automaticamente na competência sem substituir os custos adicionais informados manualmente.
- 08/10/2026 — Build e lint aprovados para contas a receber, fechamento parcelado e caixa de entrada de PDF/XML. Validação funcional aguarda aplicação da migração `202610080002` no Supabase.
- 20/10/2026 — Build e lint aprovados para busca de clientes, contas semanais/mensais, edição com preservação da versão aprovada e alertas operacionais/financeiros. Validação funcional aguarda aplicação da migração `202610100001` no Supabase.
- 20/10/2026 — Migração `202610100001` aplicada no Supabase pelo usuário; falta executar o teste funcional completo dos novos fluxos antes de marcá-los como concluídos.
- 27/10/2026 — Cálculo somente de corte/serviço validado localmente com laser: material, perda e estoque zerados; máquina, consumíveis, mão de obra, rateios e margem preservados. Central de acompanhamento validada com alertas de retorno, validade, aprovação e pagamento.
- 27/10/2026 — Fluxo independente “somente serviço de máquina” validado com 1 hora de Router: escolha direta da máquina, preparação e mínimo automáticos, três preços sugeridos e memória completa, sem exigir ficha de produto ou insumo.
- 07/11/2026 — Build, TypeScript e lint aprovados para reservas de estoque entre ordens, agenda/responsável, custo previsto × realizado, DRE/fluxo projetado e aprovação pública de arte por versão. Validação funcional aguarda aplicação das migrações `202611060002` e `202611060003` no Supabase.
- 08/11/2026 — Upload direto de PNG, JPG, WebP ou PDF para aprovação de arte implementado e validado em build/lint. O cliente visualiza o arquivo na própria página; falta aplicar `202611070001_artwork_file_uploads.sql` e testar com um arquivo real.
