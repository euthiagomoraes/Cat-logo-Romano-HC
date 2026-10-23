import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Administrador, Catalogo, CatalogoPublicado, Loja, Papel, Publicacao, Rascunho } from './types';

export class ErroConflito extends Error {}

const LOJA_VAZIA: Loja = {
  nome: '', slogan: '', whatsapp: '', telefone: '', endereco: '', horario: '', aviso: '',
  logo_url: null, mostrar_aviso_demo: false,
};

function normalizar<T extends Catalogo>(d: T): T {
  return {
    ...d,
    loja: { ...LOJA_VAZIA, ...(d.loja ?? {}) },
    servicos: d.servicos ?? [],
    categorias: d.categorias ?? [],
    banners: d.banners ?? [],
    produtos: (d.produtos ?? []).map((p) => ({ ...p, preco: Number(p.preco), preco_de: Number(p.preco_de) })),
  };
}

/** Traduz erros do banco em mensagens para quem está editando. */
function mensagemErro(e: { message?: string; code?: string; details?: string } | null): string {
  const m = `${e?.message ?? ''} ${e?.details ?? ''}`;
  if (m.includes('SEM_PERMISSAO')) return 'Sua conta não tem permissão para esta ação.';
  if (m.includes('produtos_sku_unico')) return 'Há dois produtos com o mesmo código (SKU). Corrija o código repetido e grave de novo.';
  if (m.includes('produtos_categoria_id_fkey')) return 'Um departamento removido ainda tem produtos. Mova os produtos para outro departamento antes.';
  if (m.includes('categorias_nome_check') || m.includes('produtos_nome_check')) return 'Há um produto ou departamento sem nome. Preencha o nome e grave de novo.';
  if (m.includes('PUBLICACAO_NAO_ENCONTRADA')) return 'Essa publicação não existe mais.';
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return e?.message || 'Erro inesperado. Tente de novo.';
}

export async function carregarPublicado(): Promise<CatalogoPublicado | null> {
  const { data, error } = await supabase.rpc('catalogo_publicado');
  if (error) throw new Error(mensagemErro(error));
  return data ? normalizar(data as CatalogoPublicado) : null;
}

export async function carregarRascunho(): Promise<Rascunho> {
  const { data, error } = await supabase.rpc('carregar_rascunho');
  if (error) throw new Error(mensagemErro(error));
  return normalizar(data as Rascunho);
}

export async function salvarRascunho(r: Rascunho): Promise<{ versao: number; alterado_em: string }> {
  const dados: Catalogo = {
    loja: r.loja, servicos: r.servicos, categorias: r.categorias, banners: r.banners, produtos: r.produtos,
  };
  const { data, error } = await supabase.rpc('salvar_rascunho', { p_dados: dados, p_versao: r.versao });
  if (error) {
    if (error.message.includes('CONFLITO_VERSAO')) {
      throw new ErroConflito('Outro administrador gravou alterações enquanto você editava.');
    }
    throw new Error(mensagemErro(error));
  }
  return data as { versao: number; alterado_em: string };
}

export async function publicar(observacao: string): Promise<{ id: number; publicado_em: string }> {
  const { data, error } = await supabase.rpc('publicar', { p_observacao: observacao });
  if (error) throw new Error(mensagemErro(error));
  return data as { id: number; publicado_em: string };
}

export async function republicar(id: number): Promise<{ id: number; publicado_em: string }> {
  const { data, error } = await supabase.rpc('republicar', { p_id: id });
  if (error) throw new Error(mensagemErro(error));
  return data as { id: number; publicado_em: string };
}

export async function listarPublicacoes(limite = 30): Promise<Publicacao[]> {
  const { data, error } = await supabase
    .from('publicacoes')
    .select('id, publicado_em, publicado_por_nome, observacao')
    .order('id', { ascending: false })
    .limit(limite);
  if (error) throw new Error(mensagemErro(error));
  return (data ?? []) as Publicacao[];
}

/* ---------- imagens ---------- */

function reduzirImagem(arquivo: File, larguraMax: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, larguraMax / img.naturalWidth);
      const w = Math.round(img.naturalWidth * escala);
      const h = Math.round(img.naturalHeight * escala);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Arquivo de imagem inválido. Use JPG, PNG ou WebP.'));
    };
    img.src = url;
  });
}

export async function enviarImagem(arquivo: File, pasta: 'produtos' | 'banners' | 'loja', larguraMax: number) {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WebP).');
  const blob = await reduzirImagem(arquivo, larguraMax);
  const caminho = `${pasta}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('catalogo').upload(caminho, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(error.message.includes('row-level security') ? 'Sua conta não tem permissão para enviar imagens.' : `Falha no envio da imagem: ${error.message}`);
  return supabase.storage.from('catalogo').getPublicUrl(caminho).data.publicUrl;
}

/* ---------- administradores (Edge Function) ---------- */

async function funcaoAdmin<T>(acao: string, dados: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: { acao, ...dados } });
  if (error) {
    let msg = 'Não foi possível falar com o servidor. Tente de novo.';
    if (error instanceof FunctionsHttpError) {
      try {
        const corpo = await error.context.json();
        if (corpo?.erro) msg = corpo.erro;
      } catch {
        /* resposta sem JSON */
      }
    }
    throw new Error(msg);
  }
  return data as T;
}

export const admins = {
  status: () => funcaoAdmin<{ primeiro_acesso: boolean }>('status'),
  primeiroAcesso: (nome: string, email: string, senha: string) =>
    funcaoAdmin<{ ok: true }>('primeiro_acesso', { nome, email, senha }),
  listar: async () => (await funcaoAdmin<{ administradores: Administrador[] }>('listar')).administradores,
  criar: (d: { nome: string; email: string; senha: string; papel: Papel }) => funcaoAdmin<{ ok: true }>('criar', d),
  atualizar: (user_id: string, d: { nome?: string; papel?: Papel; ativo?: boolean }) =>
    funcaoAdmin<{ ok: true }>('atualizar', { user_id, ...d }),
  redefinirSenha: (user_id: string, senha: string) => funcaoAdmin<{ ok: true }>('redefinir_senha', { user_id, senha }),
  remover: (user_id: string) => funcaoAdmin<{ ok: true }>('remover', { user_id }),
};

export async function meuCadastro(userId: string): Promise<Administrador | null> {
  const { data } = await supabase.from('administradores').select('*').eq('user_id', userId).maybeSingle();
  return (data as Administrador | null) ?? null;
}
