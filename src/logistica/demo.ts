import type { FonteLogistica } from './fonte';
import type { EventoPedido, ItemPedido, Pedido, Rastreio, StatusPedido } from './tipos';

/*
 * Modo demonstração: pedidos de exemplo guardados só neste navegador.
 * Abra /logistica/demo numa aba e o link de rastreio em outra: as mudanças
 * feitas no painel aparecem no rastreio na hora (BroadcastChannel).
 */

const CHAVE = 'romano-logistica-demo-v4';
const canalNome = 'romano-logistica-demo';

interface Banco { pedidos: Pedido[]; eventos: EventoPedido[]; seq: number; eventoSeq: number }

const DESCRICAO: Record<StatusPedido, string> = {
  pago: 'Pedido pago e enviado para a logística.',
  em_separacao: 'Os produtos estão sendo separados no depósito.',
  saiu_para_entrega: 'O caminhão saiu para entrega.',
  entregue: 'Pedido entregue.',
  cancelado: 'Pedido cancelado.',
};

const TRANS: Record<StatusPedido, StatusPedido[]> = {
  pago: ['em_separacao', 'cancelado'],
  em_separacao: ['saiu_para_entrega', 'pago', 'cancelado'],
  saiu_para_entrega: ['entregue', 'em_separacao'],
  entregue: [],
  cancelado: [],
};

const min = (m: number) => new Date(Date.now() + m * 60000).toISOString();
const it = (sku: string, nome: string, qtd: number, unidade: string, preco: number): ItemPedido => ({ sku, nome, qtd, unidade, preco });
const soma = (itens: ItemPedido[]) => Math.round(itens.reduce((s, i) => s + i.qtd * i.preco, 0) * 100) / 100;

function base(n: number, cliente: string, tel: string, end: string, bairro: string, itens: ItemPedido[], extra: Partial<Pedido>): Pedido {
  return {
    id: `demo-${n}`, numero: `ROMANO-${String(n).padStart(6, '0')}`, codigo_rastreio: `demo-${n}`,
    origem: 'erp', externo_id: `ERP-${87190 + n}`, cliente_nome: cliente, cliente_telefone: tel,
    entrega_endereco: end, entrega_bairro: bairro, entrega_cidade: 'Abaetetuba - PA', entrega_referencia: '',
    entrega_lat: null, entrega_lng: null, itens, total: soma(itens), forma_pagamento: 'Pix', observacao: '',
    status: 'pago', pago_em: min(-30), separacao_em: null, saiu_em: null, entregue_em: null, cancelado_em: null,
    motorista: '', veiculo_placa: '', previsao_entrega: null,
    rota_inicio_lat: null, rota_inicio_lng: null, posicao_lat: null, posicao_lng: null, posicao_em: null,
    criado_em: min(-90), atualizado_em: min(-5), ...extra,
  };
}

function semente(): Banco {
  const pedidos: Pedido[] = [
    base(1042, 'Marcos Andrade', '91991234567', 'Av. Dom Pedro II, 1200', 'Centro',
      [it('CIM-50', 'Cimento CP II 50 kg', 20, 'sc', 38.9), it('ARE-M3', 'Areia média', 2, 'm³', 145)],
      { status: 'saiu_para_entrega', origem: 'erp', externo_id: 'ERP-88231', criado_em: min(-140), pago_em: min(-120), separacao_em: min(-60), saiu_em: min(-2), previsao_entrega: min(6), motorista: 'José Carlos', veiculo_placa: 'QZA-4F21', atualizado_em: min(-2) }),
    base(1043, 'Ana Paula Souza', '91988776655', 'Rua São Francisco, 455, casa 2', 'São Lourenço',
      [it('TIN-18', 'Tinta acrílica fosca branco 18 L', 3, 'un', 289.9), it('ROL-23', 'Rolo de lã 23 cm', 2, 'un', 32.5)],
      { status: 'em_separacao', criado_em: min(-80), pago_em: min(-50), separacao_em: min(-12), atualizado_em: min(-12) }),
    base(1044, 'Construtora Maratauíra', '9137514444', 'Travessa Santa Rita, 88 — obra', 'Algodoal',
      [it('VER-10', 'Vergalhão CA-50 10 mm 12 m', 40, 'br', 54.9), it('ARA-18', 'Arame recozido 18', 5, 'kg', 21.9), it('BLO-14', 'Bloco cerâmico 14x19x29', 1500, 'un', 1.35)],
      { status: 'pago', origem: 'erp', externo_id: 'ERP-88240', forma_pagamento: 'Boleto', criado_em: min(-70), pago_em: min(-25), atualizado_em: min(-25) }),
    base(1045, 'Ricardo Lima', '91992223344', 'Rua das Flores, 31', 'Aviação',
      [it('TOR-01', 'Torneira de parede cromada', 1, 'un', 89.9), it('VED-18', 'Fita veda rosca 18 mm', 3, 'un', 6.5)],
      { status: 'pago', forma_pagamento: 'Dinheiro', observacao: 'Venda no balcão (PDV).', criado_em: min(-40), pago_em: min(-8), atualizado_em: min(-8) }),
    base(1046, 'Fernanda Costa', '91981112233', 'Rua da Paz, 900', 'Cristo Redentor',
      [it('POR-60', 'Porcelanato 60x60 acetinado', 32, 'm²', 69.9), it('ARG-AC3', 'Argamassa AC-III 20 kg', 12, 'sc', 42)],
      { status: 'pago', forma_pagamento: 'Cartão', criado_em: min(-4), pago_em: min(-3), atualizado_em: min(-3) }),
    base(1040, 'Luciana Martins', '91987654321', 'Rua Nova, 77', 'Mutirão',
      [it('FIO-25', 'Cabo flexível 2,5 mm 100 m', 2, 'rl', 219.9)],
      { status: 'entregue', criado_em: min(-300), pago_em: min(-280), separacao_em: min(-240), saiu_em: min(-200), entregue_em: min(-160), motorista: 'José Carlos', veiculo_placa: 'QZA-4F21', atualizado_em: min(-160) }),
  ];
  const eventos: EventoPedido[] = [];
  let e = 1;
  for (const p of pedidos) {
    const passos: [StatusPedido, string | null][] = [
      ['pago', p.pago_em], ['em_separacao', p.separacao_em],
      ['saiu_para_entrega', p.saiu_em], ['entregue', p.entregue_em],
    ];
    for (const [s, quando] of passos) {
      const doErp = s === 'pago' && p.origem === 'erp';
      if (quando) eventos.push({ id: e++, pedido_id: p.id, status: s, descricao: doErp ? 'Pedido pago recebido do sistema de gestão.' : DESCRICAO[s], autor_nome: doErp ? 'erp' : 'Equipe ROMANO', origem: doErp ? 'integracao' : 'painel', criado_em: quando });
    }
  }
  return { pedidos, eventos, seq: 1047, eventoSeq: e };
}

function ler(): Banco {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Banco | null;
    if (v && Array.isArray(v.pedidos)) return v;
  } catch { /* sem armazenamento */ }
  const s = semente();
  gravar(s, false);
  return s;
}

let memoria: Banco | null = null;
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(canalNome) : null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
canal?.addEventListener('message', () => { memoria = null; avisar(); });

function banco(): Banco {
  if (!memoria) memoria = ler();
  return memoria;
}

function gravar(b: Banco, emitir = true) {
  memoria = b;
  try { localStorage.setItem(CHAVE, JSON.stringify(b)); } catch { /* só em memória */ }
  if (emitir) { canal?.postMessage('mudou'); avisar(); }
}

export function reiniciarDemo() {
  gravar(semente());
}

const VENDAS_EXEMPLO: [string, string, string, string, ItemPedido[], string, string][] = [
  ['Paulo Henrique', '91993334455', 'Rua São João, 210', 'São João',
    [it('CIM-50', 'Cimento CP II 50 kg', 10, 'sc', 38.9), it('CAL-20', 'Cal hidratada 20 kg', 4, 'sc', 18.5)], 'Pix', ''],
  ['Joana Ribeiro', '91984445566', 'Rua Santa Rosa, 300, casa 4', 'Santa Rosa',
    [it('TIN-36', 'Tinta látex PVA 3,6 L', 4, 'un', 79.9), it('LIX-100', 'Lixa d’água 100', 10, 'un', 2.5)], 'Cartão', ''],
  ['Mercadinho Bom Preço', '9137511212', 'Av. Dom Pedro II, 540', 'Centro',
    [it('LAM-9W', 'Lâmpada LED 9 W', 24, 'un', 9.9), it('TOM-10A', 'Tomada 10 A', 12, 'un', 11.9)], 'Dinheiro', 'Venda no balcão (PDV).'],
];

/** Só na demonstração: imita o ERP enviando uma venda paga (site, vendedor ou PDV do balcão). */
export function simularPedidoErp() {
  const b = structuredClone(banco());
  const agora = new Date().toISOString();
  const n = b.seq++;
  const [cliente, tel, end, bairro, itens, forma, obs] = VENDAS_EXEMPLO[n % VENDAS_EXEMPLO.length];
  const p = base(n, cliente, tel, end, bairro, itens, { forma_pagamento: forma, observacao: obs, criado_em: agora, pago_em: agora, atualizado_em: agora });
  b.pedidos.push(p);
  b.eventos.push({ id: b.eventoSeq++, pedido_id: p.id, status: 'pago', descricao: 'Pedido pago recebido do sistema de gestão.', autor_nome: 'erp', origem: 'integracao', criado_em: agora });
  gravar(b);
  return p;
}

const espera = () => new Promise((r) => setTimeout(r, 180));

export const fonteDemo: FonteLogistica = {
  demo: true,

  async listar() {
    await espera();
    return structuredClone(banco().pedidos);
  },

  async eventos(pedidoId) {
    return banco().eventos.filter((e) => e.pedido_id === pedidoId);
  },

  async mudarStatus(id, status, descricao = '', saida) {
    await espera();
    const b = structuredClone(banco());
    const p = b.pedidos.find((x) => x.id === id);
    if (!p) throw new Error('Pedido não encontrado.');
    if (p.status === status) return;
    if (!TRANS[p.status].includes(status)) throw new Error('Esse pedido já mudou de etapa. A lista foi atualizada; confira e tente de novo.');
    const agora = new Date().toISOString();
    if (status === 'saiu_para_entrega') {
      p.motorista = saida?.motorista || p.motorista;
      p.veiculo_placa = (saida?.placa || p.veiculo_placa).toUpperCase();
      p.previsao_entrega = saida?.previsao ?? p.previsao_entrega;
      p.saiu_em = agora;
      p.posicao_lat = p.posicao_lng = p.rota_inicio_lat = p.rota_inicio_lng = null;
    }
    if (status === 'em_separacao') p.separacao_em = agora;
    if (status === 'entregue') p.entregue_em = agora;
    if (status === 'cancelado') p.cancelado_em = agora;
    p.status = status;
    p.atualizado_em = agora;
    b.eventos.push({ id: b.eventoSeq++, pedido_id: id, status, descricao: descricao.trim() || DESCRICAO[status], autor_nome: 'Você (demonstração)', origem: 'painel', criado_em: agora });
    gravar(b);
  },


  async registrarPosicao(id, lat, lng) {
    const b = structuredClone(banco());
    const p = b.pedidos.find((x) => x.id === id);
    if (!p || p.status !== 'saiu_para_entrega') return;
    p.rota_inicio_lat ??= lat;
    p.rota_inicio_lng ??= lng;
    p.posicao_lat = lat;
    p.posicao_lng = lng;
    p.posicao_em = new Date().toISOString();
    gravar(b);
  },

  assinar(aoMudar, aoEstado) {
    ouvintes.add(aoMudar);
    aoEstado('ao-vivo');
    return () => { ouvintes.delete(aoMudar); };
  },

  async rastreio(codigo) {
    const b = banco();
    const p = b.pedidos.find((x) => x.codigo_rastreio === codigo);
    if (!p) return null;
    const r: Rastreio = {
      numero: p.numero, status: p.status, criado_em: p.criado_em, pago_em: p.pago_em, separacao_em: p.separacao_em,
      saiu_em: p.saiu_em, entregue_em: p.entregue_em, cancelado_em: p.cancelado_em, previsao_entrega: p.previsao_entrega,
      motorista: p.motorista.split(' ')[0] ?? '', veiculo_placa: p.veiculo_placa, cliente_nome: p.cliente_nome.split(' ')[0] ?? '',
      entrega_bairro: p.entrega_bairro, entrega_cidade: p.entrega_cidade, entrega_lat: p.entrega_lat, entrega_lng: p.entrega_lng,
      rota_inicio_lat: p.rota_inicio_lat, rota_inicio_lng: p.rota_inicio_lng,
      posicao_lat: p.posicao_lat, posicao_lng: p.posicao_lng, posicao_em: p.posicao_em, atualizado_em: p.atualizado_em,
      itens: p.itens.map((i) => ({ nome: i.nome, qtd: i.qtd, unidade: i.unidade })),
      eventos: b.eventos.filter((e) => e.pedido_id === p.id).map((e) => ({ status: e.status, descricao: e.descricao, criado_em: e.criado_em })),
      loja: { nome: 'ROMANO Home Center', logo_url: null, whatsapp: '' },
    };
    return structuredClone(r);
  },

  assinarRastreio(_codigo, aoMudar, aoEstado) {
    ouvintes.add(aoMudar);
    aoEstado('ao-vivo');
    return () => { ouvintes.delete(aoMudar); };
  },
};
