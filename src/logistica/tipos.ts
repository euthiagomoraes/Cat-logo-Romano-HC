/** Todo pedido que chega na logística já está pago ('pago' = aguardando separação). */
export type StatusPedido =
  | 'pago'
  | 'em_separacao'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado';

/** Os pedidos nascem no ERP (inclusive vendas do balcão, pelo PDV). A logística não lança pedidos. */
export type OrigemPedido = 'erp' | 'catalogo';

export interface ItemPedido {
  sku: string;
  nome: string;
  qtd: number;
  unidade: string;
  preco: number;
}

export interface Pedido {
  id: string;
  numero: string;
  codigo_rastreio: string;
  origem: OrigemPedido;
  externo_id: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  entrega_endereco: string;
  entrega_bairro: string;
  entrega_cidade: string;
  entrega_referencia: string;
  entrega_lat: number | null;
  entrega_lng: number | null;
  itens: ItemPedido[];
  total: number;
  forma_pagamento: string;
  observacao: string;
  status: StatusPedido;
  pago_em: string;
  separacao_em: string | null;
  saiu_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
  motorista: string;
  veiculo_placa: string;
  previsao_entrega: string | null;
  rota_inicio_lat: number | null;
  rota_inicio_lng: number | null;
  posicao_lat: number | null;
  posicao_lng: number | null;
  posicao_em: string | null;
  criado_em: string;
  atualizado_em: string;
  /** Pedido de teste criado pelo botão "Simular venda do caixa" */
  simulado?: boolean;
}

export interface EventoPedido {
  id: number;
  pedido_id: string;
  status: StatusPedido;
  descricao: string;
  autor_nome: string;
  origem: 'painel' | 'integracao' | 'sistema';
  criado_em: string;
}

/** O que a página pública de rastreio recebe (sem telefone, endereço completo ou preços). */
export interface Rastreio {
  numero: string;
  status: StatusPedido;
  criado_em: string;
  pago_em: string | null;
  separacao_em: string | null;
  saiu_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
  previsao_entrega: string | null;
  motorista: string;
  veiculo_placa: string;
  cliente_nome: string;
  entrega_bairro: string;
  entrega_cidade: string;
  entrega_lat: number | null;
  entrega_lng: number | null;
  rota_inicio_lat: number | null;
  rota_inicio_lng: number | null;
  posicao_lat: number | null;
  posicao_lng: number | null;
  posicao_em: string | null;
  atualizado_em: string;
  itens: { nome: string; qtd: number; unidade: string }[];
  eventos: { status: StatusPedido; descricao: string; criado_em: string }[];
  loja: { nome: string | null; logo_url: string | null; whatsapp: string | null } | null;
}

export interface DadosSaida {
  motorista: string;
  placa: string;
  previsao: string | null;
}

export const STATUS: Record<StatusPedido, { rotulo: string; cliente: string; icone: string }> = {
  pago: { rotulo: 'A separar', cliente: 'Pedido confirmado', icone: 'card' },
  em_separacao: { rotulo: 'Em separação', cliente: 'Em separação', icone: 'box' },
  saiu_para_entrega: { rotulo: 'Saiu para entrega', cliente: 'Saiu para entrega', icone: 'truck' },
  entregue: { rotulo: 'Entregue', cliente: 'Entregue', icone: 'check' },
  cancelado: { rotulo: 'Cancelado', cliente: 'Pedido cancelado', icone: 'x' },
};

/** Mesmas regras de public.pedido_transicao_valida (o banco é quem decide). */
export const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  pago: ['em_separacao', 'cancelado'],
  em_separacao: ['saiu_para_entrega', 'pago', 'cancelado'],
  saiu_para_entrega: ['entregue', 'em_separacao'],
  entregue: [],
  cancelado: [],
};

/** Próximo passo "normal" de cada etapa, com o texto do botão. */
export const PROXIMO: Partial<Record<StatusPedido, { status: StatusPedido; acao: string; icone: string }>> = {
  pago: { status: 'em_separacao', acao: 'Iniciar separação', icone: 'box' },
  em_separacao: { status: 'saiu_para_entrega', acao: 'Saiu para entrega', icone: 'truck' },
  saiu_para_entrega: { status: 'entregue', acao: 'Confirmar entrega', icone: 'check' },
};

export const ETAPAS_CLIENTE: StatusPedido[] = ['pago', 'em_separacao', 'saiu_para_entrega', 'entregue'];

export const ORIGEM: Record<OrigemPedido, string> = {
  catalogo: 'Catálogo',
  erp: 'ERP',
};
