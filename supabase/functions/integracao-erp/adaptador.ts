// Adaptador do ERP
// ---------------------------------------------------------------------
// TODO o que é específico da API do sistema de gestão (ERP) fica NESTE
// arquivo. O resto do sistema (banco, painel, rastreio) só conhece o
// formato "normalizado" abaixo. Quando a documentação oficial chegar,
// ajuste:
//
//   1. STATUS_DO_ERP / STATUS_PARA_ERP -> nomes de status deles
//   2. interpretarWebhook()            -> campos do JSON que eles enviam
//   3. enviarStatus()                  -> endpoint e corpo que eles esperam
//   4. listarProdutos()                -> endpoint de produtos/estoque
//   5. assinatura do webhook           -> cabeçalho e algoritmo
//
// Os pontos marcados com "CONFIRMAR" são suposições razoáveis para um
// ERP de materiais de construção, não a especificação real.
//
// Regra: só pedidos PAGOS entram na logística. Eventos de pedidos ainda
// sem pagamento são registrados e ignorados.
// ---------------------------------------------------------------------

export type StatusPedido =
  | "pago"
  | "em_separacao"
  | "saiu_para_entrega"
  | "entregue"
  | "cancelado";

export interface ItemNormalizado {
  sku: string;
  nome: string;
  qtd: number;
  unidade: string;
  preco: number;
}

export interface PedidoNormalizado {
  externo_id: string;
  status?: StatusPedido;
  cliente_nome: string;
  cliente_telefone?: string;
  cliente_documento?: string;
  entrega_endereco?: string;
  entrega_bairro?: string;
  entrega_cidade?: string;
  entrega_referencia?: string;
  entrega_lat?: number | null;
  entrega_lng?: number | null;
  itens: ItemNormalizado[];
  total: number;
  forma_pagamento?: string;
  observacao?: string;
  externo_dados?: Record<string, unknown>;
}

export type EventoEntrada =
  | { tipo: "pedido"; chave: string; pedido: PedidoNormalizado }
  | { tipo: "status"; chave: string; externo_id: string; status: StatusPedido; descricao?: string }
  | { tipo: "ignorado"; chave: string; motivo: string };

export interface ProdutoNormalizado {
  sku: string;
  nome: string;
  preco: number;
  estoque: number | null;
  unidade: string;
  marca: string;
}

export interface ConfigErp {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
}

export function lerConfig(): ConfigErp {
  return {
    apiUrl: (Deno.env.get("ERP_API_URL") ?? "").replace(/\/+$/, ""),
    apiKey: Deno.env.get("ERP_API_KEY") ?? "",
    webhookSecret: Deno.env.get("ERP_WEBHOOK_SECRET") ?? "",
  };
}

export const configurada = (c: ConfigErp) => Boolean(c.apiUrl && c.apiKey);

// ---------------------------------------------------------------------
// 1. Status  (CONFIRMAR nomes reais)
// "nao_pago" = o pedido existe no ERP, mas ainda não vai para a logística.
// ---------------------------------------------------------------------
const STATUS_DO_ERP: Record<string, StatusPedido | "nao_pago"> = {
  ABERTO: "nao_pago",
  ORCAMENTO: "nao_pago",
  AGUARDANDO_PAGAMENTO: "nao_pago",
  PAGO: "pago",
  FATURADO: "pago",
  EM_SEPARACAO: "em_separacao",
  SEPARANDO: "em_separacao",
  EM_ROTA: "saiu_para_entrega",
  SAIU_PARA_ENTREGA: "saiu_para_entrega",
  ENTREGUE: "entregue",
  CANCELADO: "cancelado",
};

const STATUS_PARA_ERP: Record<StatusPedido, string> = {
  pago: "PAGO",
  em_separacao: "EM_SEPARACAO",
  saiu_para_entrega: "EM_ROTA",
  entregue: "ENTREGUE",
  cancelado: "CANCELADO",
};

export function statusDoErp(v: unknown): StatusPedido | "nao_pago" | undefined {
  return STATUS_DO_ERP[String(v ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_")];
}

// ---------------------------------------------------------------------
// 2. Webhook recebido  (CONFIRMAR formato)
// Supõe um corpo como:
// { "id": "evt_123", "evento": "pedido.pago", "dados": { "pedido": {...} } }
// ---------------------------------------------------------------------
const txt = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const numero = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
// deno-lint-ignore no-explicit-any
type Qualquer = any;

function pedidoDoErp(p: Qualquer): PedidoNormalizado {
  const cli = p.cliente ?? {};
  const end = p.entrega ?? p.endereco_entrega ?? cli.endereco ?? {};
  const itens: Qualquer[] = Array.isArray(p.itens) ? p.itens : Array.isArray(p.produtos) ? p.produtos : [];
  const st = statusDoErp(p.status ?? p.situacao);
  return {
    externo_id: txt(p.id ?? p.codigo ?? p.numero),
    status: st === "nao_pago" ? undefined : st,
    cliente_nome: txt(cli.nome ?? p.cliente_nome) || "Cliente",
    cliente_telefone: txt(cli.telefone ?? cli.celular),
    cliente_documento: txt(cli.cpf ?? cli.cnpj ?? cli.documento),
    entrega_endereco: [txt(end.logradouro ?? end.rua), txt(end.numero), txt(end.complemento)].filter(Boolean).join(", "),
    entrega_bairro: txt(end.bairro),
    entrega_cidade: [txt(end.cidade), txt(end.uf)].filter(Boolean).join(" - "),
    entrega_referencia: txt(end.referencia),
    entrega_lat: end.latitude != null ? numero(end.latitude) : null,
    entrega_lng: end.longitude != null ? numero(end.longitude) : null,
    itens: itens.map((i) => ({
      sku: txt(i.sku ?? i.codigo ?? i.referencia),
      nome: txt(i.descricao ?? i.nome),
      qtd: numero(i.quantidade ?? i.qtd) || 1,
      unidade: txt(i.unidade) || "un",
      preco: numero(i.valor_unitario ?? i.preco),
    })),
    total: numero(p.valor_total ?? p.total),
    forma_pagamento: txt(p.forma_pagamento ?? p.pagamento?.forma),
    observacao: txt(p.observacao ?? p.obs),
    externo_dados: { vendedor: p.vendedor ?? null, filial: p.filial ?? null },
  };
}

export function interpretarWebhook(corpo: Qualquer): EventoEntrada {
  const evento = txt(corpo?.evento ?? corpo?.event ?? corpo?.tipo).toLowerCase();
  const dados = corpo?.dados ?? corpo?.data ?? corpo ?? {};
  const pedido = dados.pedido ?? dados.order ?? dados;
  const externoId = txt(pedido?.id ?? pedido?.codigo ?? pedido?.numero);
  const chave = txt(corpo?.id ?? corpo?.event_id) || `${evento}:${externoId}:${txt(pedido?.atualizado_em ?? corpo?.data_hora)}`;

  if (!externoId) return { tipo: "ignorado", chave, motivo: "Evento sem identificação do pedido." };

  switch (evento) {
    case "pedido.criado":
    case "pedido.atualizado": {
      // Só entra na logística depois de pago
      const p = pedidoDoErp(pedido);
      if (!p.status) return { tipo: "ignorado", chave, motivo: "Pedido ainda sem pagamento confirmado." };
      return { tipo: "pedido", chave, pedido: p };
    }
    case "pedido.pago":
    case "pagamento.confirmado":
      return { tipo: "pedido", chave, pedido: { ...pedidoDoErp(pedido), status: "pago" } };
    case "pedido.cancelado":
      return { tipo: "status", chave, externo_id: externoId, status: "cancelado", descricao: txt(dados.motivo) };
    case "pedido.status": {
      const st = statusDoErp(pedido.status ?? dados.status);
      if (!st) return { tipo: "ignorado", chave, motivo: `Status desconhecido: ${txt(pedido.status ?? dados.status)}` };
      if (st === "nao_pago") return { tipo: "ignorado", chave, motivo: "Pedido ainda sem pagamento confirmado." };
      return { tipo: "status", chave, externo_id: externoId, status: st, descricao: txt(dados.descricao) };
    }
    default:
      return { tipo: "ignorado", chave, motivo: `Evento não tratado: ${evento || "(vazio)"}` };
  }
}

// ---------------------------------------------------------------------
// 5. Assinatura do webhook  (CONFIRMAR cabeçalho/algoritmo)
// Supõe HMAC-SHA256 do corpo bruto, em hexadecimal, no cabeçalho
// "x-erp-signature" (aceita também o prefixo "sha256=").
// ---------------------------------------------------------------------
export const CABECALHO_ASSINATURA = "x-erp-signature";

export async function assinaturaValida(corpoBruto: string, recebida: string | null, segredo: string) {
  if (!segredo || !recebida) return false;
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoBruto)));
  const esperada = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const r = recebida.trim().toLowerCase().replace(/^sha256=/, "");
  if (r.length !== esperada.length) return false;
  let dif = 0;
  for (let i = 0; i < r.length; i++) dif |= r.charCodeAt(i) ^ esperada.charCodeAt(i);
  return dif === 0;
}

// ---------------------------------------------------------------------
// Chamadas à API  (CONFIRMAR endpoints e autenticação)
// ---------------------------------------------------------------------
async function chamar(c: ConfigErp, caminho: string, init: RequestInit = {}) {
  const resp = await fetch(`${c.apiUrl}${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${c.apiKey}`, // CONFIRMAR: pode ser "x-api-key"
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`ERP respondeu ${resp.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

/** 3. Avisa o ERP que o status mudou no painel de logística. */
export async function enviarStatus(c: ConfigErp, p: { externo_id: string; status: StatusPedido; descricao: string; em: string }) {
  return chamar(c, `/pedidos/${encodeURIComponent(p.externo_id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: STATUS_PARA_ERP[p.status], observacao: p.descricao, data_hora: p.em }),
  });
}

/** 4. Produtos e estoque (para sincronizar o catálogo pelo SKU, quando for a hora). */
export async function listarProdutos(c: ConfigErp, pagina = 1): Promise<ProdutoNormalizado[]> {
  const r: Qualquer = await chamar(c, `/produtos?pagina=${pagina}&por_pagina=200`);
  const lista: Qualquer[] = Array.isArray(r) ? r : r?.dados ?? r?.produtos ?? [];
  return lista.map((p) => ({
    sku: txt(p.sku ?? p.codigo ?? p.referencia),
    nome: txt(p.descricao ?? p.nome),
    preco: numero(p.preco_venda ?? p.preco),
    estoque: p.estoque != null ? numero(p.estoque) : p.saldo != null ? numero(p.saldo) : null,
    unidade: txt(p.unidade) || "un",
    marca: txt(p.marca ?? p.fabricante),
  }));
}

/** Teste simples de conexão (usado pelo botão "Testar conexão"). */
export async function testarConexao(c: ConfigErp) {
  await chamar(c, "/produtos?pagina=1&por_pagina=1");
  return true;
}
