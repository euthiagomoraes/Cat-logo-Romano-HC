export type Estilo = 'azul' | 'amarelo' | 'escuro';

export interface Loja {
  nome: string;
  slogan: string;
  whatsapp: string;
  telefone: string;
  endereco: string;
  horario: string;
  aviso: string;
  logo_url: string | null;
  mostrar_aviso_demo: boolean;
}

export interface Servico {
  id: string;
  icone: string;
  titulo: string;
  texto: string;
}

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
}

export interface Banner {
  id: string;
  ativo: boolean;
  estilo: Estilo;
  selo: string;
  titulo: string;
  subtitulo: string;
  destaque: string;
  cta: string;
  /** '#ofertas' | '#destaques' | '#catalogo' | 'cat:<id>' | 'whatsapp' */
  link: string;
  imagem_url: string | null;
}

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  categoria_id: string | null;
  marca: string;
  unidade: string;
  preco: number;
  preco_de: number;
  parcelas: number;
  destaque: boolean;
  ativo: boolean;
  foto_url: string | null;
  descricao: string;
}

export interface Catalogo {
  loja: Loja;
  servicos: Servico[];
  categorias: Categoria[];
  banners: Banner[];
  produtos: Produto[];
}

export interface CatalogoPublicado extends Catalogo {
  publicado_em: string;
}

export interface Rascunho extends Catalogo {
  versao: number;
  alterado_em: string | null;
  publicado_em: string | null;
}

export type Papel = 'administrador' | 'editor';

export interface Administrador {
  user_id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
  ultimo_acesso?: string | null;
}

export interface Publicacao {
  id: number;
  publicado_em: string;
  publicado_por_nome: string;
  observacao: string;
}
