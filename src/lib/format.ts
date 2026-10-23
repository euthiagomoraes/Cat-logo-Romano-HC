import type { Produto } from './types';

export function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function num(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte "1.299,90", "R$ 39,9" ou "39.90" em número. Retorna NaN se inválido. */
export function parseBRL(s: string): number {
  let t = String(s ?? '').replace(/[R$\s]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export function norm(s: string) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function digitos(s: string) {
  return String(s || '').replace(/\D/g, '');
}

export function fmtTelefone(s: string) {
  let d = digitos(s);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s || '';
}

export function waLink(numero: string, texto: string) {
  return `https://wa.me/${digitos(numero)}?text=${encodeURIComponent(texto)}`;
}

export function desconto(p: Pick<Produto, 'preco' | 'preco_de'>) {
  return p.preco_de > p.preco && p.preco > 0 ? Math.round((1 - p.preco / p.preco_de) * 100) : 0;
}

export function dataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function novoId() {
  return crypto.randomUUID();
}

export function gerarSenha(tamanho = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
  const v = new Uint32Array(tamanho);
  crypto.getRandomValues(v);
  return Array.from(v, (x) => chars[x % chars.length]).join('');
}
