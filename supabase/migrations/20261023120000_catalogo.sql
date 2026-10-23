-- =====================================================================
-- Catálogo RHC — estrutura, segurança e funções de gravar/publicar
--
-- Conceito:
--   * As tabelas loja, servicos, categorias, banners e produtos guardam o
--     RASCUNHO que os administradores editam em /adm.
--   * "Publicar" tira uma foto (snapshot JSON) do rascunho e grava em
--     publicacoes. A página /home lê sempre a publicação mais recente.
--   * Nenhuma tabela aceita escrita direta pela API: toda gravação passa
--     pelas funções abaixo, que conferem se quem chama é administrador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------
create table public.administradores (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text not null default '',
  email      text not null,
  papel      text not null default 'editor' check (papel in ('administrador', 'editor')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null
);
comment on table public.administradores is
  'Quem pode entrar em /adm. administrador = edita, publica e gerencia usuários; editor = edita e publica.';

create or replace function public.eh_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores a
    where a.user_id = (select auth.uid()) and a.ativo
  );
$$;

create or replace function public.eh_gestor()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores a
    where a.user_id = (select auth.uid()) and a.ativo and a.papel = 'administrador'
  );
$$;

-- ---------------------------------------------------------------------
-- Rascunho do catálogo
-- ---------------------------------------------------------------------
create table public.loja (
  id                 smallint primary key default 1 check (id = 1),
  nome               text not null default '',
  slogan             text not null default '',
  whatsapp           text not null default '',
  telefone           text not null default '',
  endereco           text not null default '',
  horario            text not null default '',
  aviso              text not null default '',
  logo_url           text,
  mostrar_aviso_demo boolean not null default false,
  versao             integer not null default 1,
  alterado_em        timestamptz,
  alterado_por       uuid references auth.users (id) on delete set null,
  publicado_em       timestamptz
);
comment on column public.loja.versao is 'Incrementa a cada gravação; evita que um administrador sobrescreva o trabalho de outro.';

insert into public.loja (id) values (1) on conflict (id) do nothing;

create table public.servicos (
  id     uuid primary key default gen_random_uuid(),
  ordem  integer not null default 0,
  icone  text not null default 'tag',
  titulo text not null default '',
  texto  text not null default ''
);

create table public.categorias (
  id    uuid primary key default gen_random_uuid(),
  ordem integer not null default 0,
  nome  text not null check (length(trim(nome)) > 0),
  icone text not null default 'tag'
);

create table public.banners (
  id         uuid primary key default gen_random_uuid(),
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  estilo     text not null default 'azul' check (estilo in ('azul', 'amarelo', 'escuro')),
  selo       text not null default '',
  titulo     text not null default '',
  subtitulo  text not null default '',
  destaque   text not null default '',
  cta        text not null default '',
  link       text not null default '#ofertas',
  imagem_url text
);

create table public.produtos (
  id           uuid primary key default gen_random_uuid(),
  ordem        integer not null default 0,
  sku          text not null,
  nome         text not null check (length(trim(nome)) > 0),
  categoria_id uuid references public.categorias (id) on delete restrict,
  marca        text not null default '',
  unidade      text not null default 'un',
  preco        numeric(12, 2) not null default 0 check (preco >= 0),
  preco_de     numeric(12, 2) not null default 0 check (preco_de >= 0),
  parcelas     smallint not null default 1 check (parcelas between 1 and 24),
  destaque     boolean not null default false,
  ativo        boolean not null default true,
  foto_url     text,
  descricao    text not null default '',
  constraint produtos_sku_unico unique (sku)
);
create index produtos_categoria_idx on public.produtos (categoria_id);

-- ---------------------------------------------------------------------
-- Publicações (o que está no ar em /home)
-- ---------------------------------------------------------------------
create table public.publicacoes (
  id                 bigint generated always as identity primary key,
  publicado_em       timestamptz not null default now(),
  publicado_por      uuid references auth.users (id) on delete set null,
  publicado_por_nome text not null default '',
  observacao         text not null default '',
  dados              jsonb not null
);
create index publicacoes_data_idx on public.publicacoes (publicado_em desc);

-- ---------------------------------------------------------------------
-- RLS: leitura só para administradores; escrita só pelas funções
-- ---------------------------------------------------------------------
alter table public.administradores enable row level security;
alter table public.loja            enable row level security;
alter table public.servicos        enable row level security;
alter table public.categorias      enable row level security;
alter table public.banners         enable row level security;
alter table public.produtos        enable row level security;
alter table public.publicacoes     enable row level security;

create policy "administrador vê a equipe e a si mesmo" on public.administradores
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.eh_admin()));

create policy "admins leem loja"        on public.loja        for select to authenticated using ((select public.eh_admin()));
create policy "admins leem servicos"    on public.servicos    for select to authenticated using ((select public.eh_admin()));
create policy "admins leem categorias"  on public.categorias  for select to authenticated using ((select public.eh_admin()));
create policy "admins leem banners"     on public.banners     for select to authenticated using ((select public.eh_admin()));
create policy "admins leem produtos"    on public.produtos    for select to authenticated using ((select public.eh_admin()));
create policy "admins leem publicacoes" on public.publicacoes for select to authenticated using ((select public.eh_admin()));

revoke all on public.administradores, public.loja, public.servicos, public.categorias,
              public.banners, public.produtos, public.publicacoes from anon;
revoke insert, update, delete, truncate on public.administradores, public.loja, public.servicos,
              public.categorias, public.banners, public.produtos, public.publicacoes from authenticated;

-- ---------------------------------------------------------------------
-- Monta o catálogo em JSON (uso interno)
-- p_rascunho = true  -> inclui banners e produtos ocultos (para o editor)
-- p_rascunho = false -> só o que está visível (para publicar)
-- ---------------------------------------------------------------------
create or replace function public.montar_catalogo(p_rascunho boolean default false)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'loja', (
      select jsonb_build_object(
        'nome', l.nome, 'slogan', l.slogan, 'whatsapp', l.whatsapp, 'telefone', l.telefone,
        'endereco', l.endereco, 'horario', l.horario, 'aviso', l.aviso,
        'logo_url', l.logo_url, 'mostrar_aviso_demo', l.mostrar_aviso_demo)
      from public.loja l where l.id = 1),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'icone', s.icone, 'titulo', s.titulo, 'texto', s.texto)
                       order by s.ordem)
      from public.servicos s), '[]'::jsonb),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'icone', c.icone) order by c.ordem)
      from public.categorias c), '[]'::jsonb),
    'banners', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'ativo', b.ativo, 'estilo', b.estilo, 'selo', b.selo, 'titulo', b.titulo,
               'subtitulo', b.subtitulo, 'destaque', b.destaque, 'cta', b.cta, 'link', b.link,
               'imagem_url', b.imagem_url) order by b.ordem)
      from public.banners b where p_rascunho or b.ativo), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'sku', p.sku, 'nome', p.nome, 'categoria_id', p.categoria_id, 'marca', p.marca,
               'unidade', p.unidade, 'preco', p.preco, 'preco_de', p.preco_de, 'parcelas', p.parcelas,
               'destaque', p.destaque, 'ativo', p.ativo, 'foto_url', p.foto_url, 'descricao', p.descricao)
             order by p.ordem)
      from public.produtos p where p_rascunho or p.ativo), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- Público: catálogo publicado (usado por /home)
-- ---------------------------------------------------------------------
create or replace function public.catalogo_publicado()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select p.dados || jsonb_build_object('publicado_em', p.publicado_em)
  from public.publicacoes p
  order by p.id desc
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Editor: carregar rascunho
-- ---------------------------------------------------------------------
create or replace function public.carregar_rascunho()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_loja public.loja;
begin
  if not public.eh_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  select * into v_loja from public.loja where id = 1;
  return public.montar_catalogo(true) || jsonb_build_object(
    'versao', coalesce(v_loja.versao, 1),
    'alterado_em', v_loja.alterado_em,
    'publicado_em', v_loja.publicado_em);
end;
$$;

-- ---------------------------------------------------------------------
-- Editor: gravar rascunho (substitui o rascunho inteiro numa transação)
-- ---------------------------------------------------------------------
create or replace function public.salvar_rascunho(p_dados jsonb, p_versao integer)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_versao integer;
  v_loja   jsonb := coalesce(p_dados -> 'loja', '{}'::jsonb);
  v_agora  timestamptz := now();
begin
  if not public.eh_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  select versao into v_versao from public.loja where id = 1 for update;
  if v_versao is null then
    insert into public.loja (id) values (1);
    v_versao := 1;
  end if;
  if v_versao <> p_versao then
    raise exception 'CONFLITO_VERSAO' using errcode = '40001',
      hint = 'Outro administrador gravou alterações depois que você abriu o editor.';
  end if;

  update public.loja set
    nome               = coalesce(v_loja ->> 'nome', ''),
    slogan             = coalesce(v_loja ->> 'slogan', ''),
    whatsapp           = coalesce(v_loja ->> 'whatsapp', ''),
    telefone           = coalesce(v_loja ->> 'telefone', ''),
    endereco           = coalesce(v_loja ->> 'endereco', ''),
    horario            = coalesce(v_loja ->> 'horario', ''),
    aviso              = coalesce(v_loja ->> 'aviso', ''),
    logo_url           = nullif(v_loja ->> 'logo_url', ''),
    mostrar_aviso_demo = coalesce((v_loja ->> 'mostrar_aviso_demo')::boolean, false),
    versao             = v_versao + 1,
    alterado_em        = v_agora,
    alterado_por       = (select auth.uid())
  where id = 1;

  -- Serviços
  delete from public.servicos
  where id not in (select (e ->> 'id')::uuid from jsonb_array_elements(coalesce(p_dados -> 'servicos', '[]')) e);
  insert into public.servicos (id, ordem, icone, titulo, texto)
  select (e ->> 'id')::uuid, o::int, coalesce(e ->> 'icone', 'tag'), coalesce(e ->> 'titulo', ''), coalesce(e ->> 'texto', '')
  from jsonb_array_elements(coalesce(p_dados -> 'servicos', '[]')) with ordinality as t (e, o)
  on conflict (id) do update set
    ordem = excluded.ordem, icone = excluded.icone, titulo = excluded.titulo, texto = excluded.texto;

  -- Departamentos (inseridos antes dos produtos que apontam para eles)
  insert into public.categorias (id, ordem, nome, icone)
  select (e ->> 'id')::uuid, o::int, trim(coalesce(e ->> 'nome', '')), coalesce(e ->> 'icone', 'tag')
  from jsonb_array_elements(coalesce(p_dados -> 'categorias', '[]')) with ordinality as t (e, o)
  on conflict (id) do update set
    ordem = excluded.ordem, nome = excluded.nome, icone = excluded.icone;

  -- Produtos
  delete from public.produtos
  where id not in (select (e ->> 'id')::uuid from jsonb_array_elements(coalesce(p_dados -> 'produtos', '[]')) e);
  insert into public.produtos (id, ordem, sku, nome, categoria_id, marca, unidade, preco, preco_de,
                               parcelas, destaque, ativo, foto_url, descricao)
  select (e ->> 'id')::uuid, o::int, trim(coalesce(e ->> 'sku', '')), trim(coalesce(e ->> 'nome', '')),
         nullif(e ->> 'categoria_id', '')::uuid, coalesce(e ->> 'marca', ''), coalesce(e ->> 'unidade', 'un'),
         coalesce((e ->> 'preco')::numeric, 0), coalesce((e ->> 'preco_de')::numeric, 0),
         coalesce((e ->> 'parcelas')::smallint, 1), coalesce((e ->> 'destaque')::boolean, false),
         coalesce((e ->> 'ativo')::boolean, true), nullif(e ->> 'foto_url', ''), coalesce(e ->> 'descricao', '')
  from jsonb_array_elements(coalesce(p_dados -> 'produtos', '[]')) with ordinality as t (e, o)
  on conflict (id) do update set
    ordem = excluded.ordem, sku = excluded.sku, nome = excluded.nome, categoria_id = excluded.categoria_id,
    marca = excluded.marca, unidade = excluded.unidade, preco = excluded.preco, preco_de = excluded.preco_de,
    parcelas = excluded.parcelas, destaque = excluded.destaque, ativo = excluded.ativo,
    foto_url = excluded.foto_url, descricao = excluded.descricao;

  -- Departamentos removidos (falha se ainda tiverem produtos)
  delete from public.categorias
  where id not in (select (e ->> 'id')::uuid from jsonb_array_elements(coalesce(p_dados -> 'categorias', '[]')) e);

  -- Banners
  delete from public.banners
  where id not in (select (e ->> 'id')::uuid from jsonb_array_elements(coalesce(p_dados -> 'banners', '[]')) e);
  insert into public.banners (id, ordem, ativo, estilo, selo, titulo, subtitulo, destaque, cta, link, imagem_url)
  select (e ->> 'id')::uuid, o::int, coalesce((e ->> 'ativo')::boolean, true), coalesce(e ->> 'estilo', 'azul'),
         coalesce(e ->> 'selo', ''), coalesce(e ->> 'titulo', ''), coalesce(e ->> 'subtitulo', ''),
         coalesce(e ->> 'destaque', ''), coalesce(e ->> 'cta', ''), coalesce(e ->> 'link', '#ofertas'),
         nullif(e ->> 'imagem_url', '')
  from jsonb_array_elements(coalesce(p_dados -> 'banners', '[]')) with ordinality as t (e, o)
  on conflict (id) do update set
    ordem = excluded.ordem, ativo = excluded.ativo, estilo = excluded.estilo, selo = excluded.selo,
    titulo = excluded.titulo, subtitulo = excluded.subtitulo, destaque = excluded.destaque,
    cta = excluded.cta, link = excluded.link, imagem_url = excluded.imagem_url;

  return jsonb_build_object('versao', v_versao + 1, 'alterado_em', v_agora);
end;
$$;

-- ---------------------------------------------------------------------
-- Editor: publicar o rascunho gravado
-- ---------------------------------------------------------------------
create or replace function public.publicar(p_observacao text default '')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id    bigint;
  v_nome  text;
  v_agora timestamptz := now();
begin
  if not public.eh_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  select coalesce(nullif(a.nome, ''), a.email) into v_nome
  from public.administradores a where a.user_id = (select auth.uid());

  insert into public.publicacoes (publicado_em, publicado_por, publicado_por_nome, observacao, dados)
  values (v_agora, (select auth.uid()), coalesce(v_nome, ''), left(coalesce(p_observacao, ''), 500),
          public.montar_catalogo(false))
  returning id into v_id;

  update public.loja set publicado_em = v_agora where id = 1;
  return jsonb_build_object('id', v_id, 'publicado_em', v_agora);
end;
$$;

-- ---------------------------------------------------------------------
-- Editor: voltar o site para uma publicação anterior
-- (o rascunho não muda; ele passa a constar como "não publicado")
-- ---------------------------------------------------------------------
create or replace function public.republicar(p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id    bigint;
  v_nome  text;
  v_agora timestamptz := now();
begin
  if not public.eh_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  select coalesce(nullif(a.nome, ''), a.email) into v_nome
  from public.administradores a where a.user_id = (select auth.uid());

  insert into public.publicacoes (publicado_em, publicado_por, publicado_por_nome, observacao, dados)
  select v_agora, (select auth.uid()), coalesce(v_nome, ''), 'Republicação da versão nº ' || p.id, p.dados
  from public.publicacoes p where p.id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'PUBLICACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  update public.loja set publicado_em = null where id = 1;
  return jsonb_build_object('id', v_id, 'publicado_em', v_agora);
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------
revoke execute on function public.montar_catalogo(boolean) from public, anon, authenticated;
revoke execute on function public.carregar_rascunho()             from public, anon;
revoke execute on function public.salvar_rascunho(jsonb, integer) from public, anon;
revoke execute on function public.publicar(text)                  from public, anon;
revoke execute on function public.republicar(bigint)              from public, anon;
grant  execute on function public.carregar_rascunho()             to authenticated;
grant  execute on function public.salvar_rascunho(jsonb, integer) to authenticated;
grant  execute on function public.publicar(text)                  to authenticated;
grant  execute on function public.republicar(bigint)              to authenticated;
grant  execute on function public.catalogo_publicado()            to anon, authenticated;
grant  execute on function public.eh_admin()                      to anon, authenticated;
grant  execute on function public.eh_gestor()                     to anon, authenticated;

-- ---------------------------------------------------------------------
-- Imagens (fotos de produto, banners e logo)
-- Leitura pública pela URL; envio e remoção só por administradores.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins enviam imagens do catálogo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo' and (select public.eh_admin()));

create policy "admins atualizam imagens do catálogo" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo' and (select public.eh_admin()));

create policy "admins removem imagens do catálogo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalogo' and (select public.eh_admin()));
