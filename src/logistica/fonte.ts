import { supabase } from '../lib/supabase';
import type { DadosSaida, EventoPedido, Pedido, Rastreio, StatusPedido } from './tipos';

export type EstadoConexao = 'conectando' | 'ao-vivo' | 'offline';

/**
 * Tudo o que as telas de logística precisam. Há duas implementações:
 * a real (Supabase) e a de demonstração (navegador), para conferir as telas
 * sem banco e sem login.
 */
export interface FonteLogistica {
  demo: boolean;
  listar(): Promise<Pedido[]>;
  eventos(pedidoId: string): Promise<EventoPedido[]>;
  mudarStatus(id: string, status: StatusPedido, descricao?: string, saida?: DadosSaida): Promise<void>;
  registrarPosicao(id: string, lat: number, lng: number): Promise<void>;
  /** Avisa quando qualquer pedido muda. Devolve a função para cancelar. */
  assinar(aoMudar: () => void, aoEstado: (e: EstadoConexao) => void): () => void;
  rastreio(codigo: string): Promise<Rastreio | null>;
  assinarRastreio(codigo: string, aoMudar: () => void, aoEstado: (e: EstadoConexao) => void): () => void;
}

function mensagemErro(e: { message?: string; details?: string } | null): string {
  const m = `${e?.message ?? ''} ${e?.details ?? ''}`;
  if (m.includes('SEM_PERMISSAO')) return 'Sua conta não tem acesso à logística.';
  if (m.includes('TRANSICAO_INVALIDA')) return 'Esse pedido já mudou de etapa. A lista foi atualizada; confira e tente de novo.';
  if (m.includes('PEDIDO_NAO_ENCONTRADO')) return 'Pedido não encontrado.';
  if (m.includes('POSICAO_INVALIDA')) return 'Localização inválida.';
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return e?.message || 'Erro inesperado. Tente de novo.';
}

const normalizar = (p: Pedido): Pedido => ({ ...p, total: Number(p.total), itens: Array.isArray(p.itens) ? p.itens : [] });

const ATIVOS = 'pago,em_separacao,saiu_para_entrega';

export const fonteSupabase: FonteLogistica = {
  demo: false,

  async listar() {
    const desde = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .or(`status.in.(${ATIVOS}),atualizado_em.gte.${desde}`)
      .order('criado_em', { ascending: true })
      .limit(500);
    if (error) throw new Error(mensagemErro(error));
    return (data as Pedido[]).map(normalizar);
  },

  async eventos(pedidoId) {
    const { data, error } = await supabase
      .from('pedido_eventos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('criado_em', { ascending: true });
    if (error) throw new Error(mensagemErro(error));
    return data as EventoPedido[];
  },

  async mudarStatus(id, status, descricao = '', saida) {
    const { error } = await supabase.rpc('logistica_atualizar_status', {
      p_pedido: id,
      p_status: status,
      p_descricao: descricao,
      p_motorista: saida?.motorista ?? null,
      p_placa: saida?.placa ?? null,
      p_previsao: saida?.previsao ?? null,
    });
    if (error) throw new Error(mensagemErro(error));
  },

  async registrarPosicao(id, lat, lng) {
    const { error } = await supabase.rpc('logistica_registrar_posicao', { p_pedido: id, p_lat: lat, p_lng: lng });
    if (error) throw new Error(mensagemErro(error));
  },

  assinar(aoMudar, aoEstado) {
    aoEstado('conectando');
    const canal = supabase
      .channel('logistica-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, aoMudar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedido_eventos' }, aoMudar)
      .subscribe((st) => aoEstado(st === 'SUBSCRIBED' ? 'ao-vivo' : st === 'CLOSED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' ? 'offline' : 'conectando'));
    return () => { void supabase.removeChannel(canal); };
  },

  async rastreio(codigo) {
    const { data, error } = await supabase.rpc('pedido_rastreio', { p_codigo: codigo });
    if (error) throw new Error(mensagemErro(error));
    return (data as Rastreio | null) ?? null;
  },

  assinarRastreio(codigo, aoMudar, aoEstado) {
    aoEstado('conectando');
    const canal = supabase
      .channel(`rastreio:${codigo}`)
      .on('broadcast', { event: 'atualizacao' }, aoMudar)
      .subscribe((st) => aoEstado(st === 'SUBSCRIBED' ? 'ao-vivo' : st === 'CLOSED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' ? 'offline' : 'conectando'));
    // Reforço: mesmo sem Realtime, a página se atualiza sozinha
    const t = window.setInterval(aoMudar, 30000);
    return () => { window.clearInterval(t); void supabase.removeChannel(canal); };
  },
};

/* ---------- utilitários de exibição ---------- */

export function hora(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function diaHora(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? `hoje, ${hora(iso)}` : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function haQuanto(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return '';
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `há ${Math.floor(h / 24)} d`;
}

function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

type ComRota = Pick<Rastreio, 'status' | 'saiu_em' | 'previsao_entrega' | 'entrega_lat' | 'entrega_lng'
  | 'rota_inicio_lat' | 'rota_inicio_lng' | 'posicao_lat' | 'posicao_lng'>;

/**
 * Onde desenhar o caminhão na estrada (0 = loja, 1 = cliente).
 * Usa o GPS do motorista quando há; senão estima pelo horário de saída e a previsão.
 */
export function progressoRota(r: ComRota, agora = Date.now()): number {
  if (r.status === 'entregue') return 1;
  if (r.status !== 'saiu_para_entrega') return 0;
  let f = 0.5;
  if (r.posicao_lat != null && r.posicao_lng != null && r.entrega_lat != null && r.entrega_lng != null
      && r.rota_inicio_lat != null && r.rota_inicio_lng != null) {
    const total = distanciaKm(r.rota_inicio_lat, r.rota_inicio_lng, r.entrega_lat, r.entrega_lng);
    const falta = distanciaKm(r.posicao_lat, r.posicao_lng, r.entrega_lat, r.entrega_lng);
    f = total > 0.05 ? 1 - falta / total : 0.5;
  } else if (r.saiu_em && r.previsao_entrega) {
    const ini = new Date(r.saiu_em).getTime();
    const fim = new Date(r.previsao_entrega).getTime();
    f = fim > ini ? (agora - ini) / (fim - ini) : 0.5;
  }
  return 0.08 + Math.min(0.94, Math.max(0, f)) * 0.84;
}

export function kmAteCliente(r: ComRota): number | null {
  if (r.posicao_lat == null || r.posicao_lng == null || r.entrega_lat == null || r.entrega_lng == null) return null;
  return distanciaKm(r.posicao_lat, r.posicao_lng, r.entrega_lat, r.entrega_lng);
}

export const linkRastreio = (codigo: string) => `${window.location.origin}/rastreio/${codigo}`;
