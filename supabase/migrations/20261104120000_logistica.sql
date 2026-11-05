-- =====================================================================
-- Catálogo ROMANO — Logística, rastreio em tempo real e integração externa
--
-- Conceito:
--   * pedidos            só pedidos JÁ PAGOS entram aqui; a logística não
--                        confirma pagamento, só separa e entrega
--   * pedido_eventos     linha do tempo de cada pedido (quem mudou o quê)
--   * integracao_fila    entrada/saída de mensagens com sistemas externos
--                        (ERP da loja). Garante idempotência e reenvio.
--   * Papel novo "logistica": entra só no painel /logistica, não edita
--     o catálogo.
--   * O cliente acompanha em /rastreio/<codigo> sem login. O código é
--     aleatório (80 bits) e funciona como chave de acesso ao pedido.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Papel "logistica"
-- ---------------------------------------------------------------------
alter table public.administradores drop constraint if exists administradores_papel_check;
alter table public.administradores
  add constraint administradores_papel_check check (papel in ('administrador', 'editor', 'logistica'));

-- A equipe da logística não edita nem publica o catálogo
create or replace function public.eh_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores a
    where a.user_id = (select auth.uid()) and a.ativo and a.papel in ('administrador', 'editor')
  );
$$;

create or replace function public.eh_logistica()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores a
    where a.user_id = (select auth.uid()) and a.ativo and a.papel in ('administrador', 'logistica')
  );
$$;

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create sequence if not exists public.pedidos_numero_seq start 1001;

create table public.pedidos (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null unique
                       default ('ROMANO-' || lpad(nextval('public.pedidos_numero_seq')::text, 6, '0')),
  codigo_rastreio    text not null unique
                       default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),

  -- Origem: 'erp' (sistema de gestão, inclusive vendas do balcão pelo PDV) ou 'catalogo' (checkout futuro).
  -- A logística não lança pedidos.
  origem             text not null default 'erp' check (origem in ('erp', 'catalogo')),
  externo_id         text,
  externo_dados      jsonb not null default '{}'::jsonb,

  cliente_nome       text not null check (length(trim(cliente_nome)) > 0),
  cliente_telefone   text not null default '',
  cliente_documento  text not null default '',

  entrega_endereco   text not null default '',
  entrega_bairro     text not null default '',
  entrega_cidade     text not null default '',
  entrega_referencia text not null default '',
  entrega_lat        double precision check (entrega_lat between -90 and 90),
  entrega_lng        double precision check (entrega_lng between -180 and 180),

  -- [{ "sku", "nome", "qtd", "unidade", "preco" }]
  itens              jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  total              numeric(12, 2) not null default 0 check (total >= 0),
  forma_pagamento    text not null default '',
  observacao         text not null default '',

  -- 'pago' = chegou na logística, aguardando separação
  status             text not null default 'pago' check (status in (
                       'pago', 'em_separacao', 'saiu_para_entrega', 'entregue', 'cancelado')),
  pago_em            timestamptz not null default now(),
  separacao_em       timestamptz,
  saiu_em            timestamptz,
  entregue_em        timestamptz,
  cancelado_em       timestamptz,

  motorista          text not null default '',
  veiculo_placa      text not null default '',
  previsao_entrega   timestamptz,

  -- Posição do caminhão (enviada pelo celular do motorista)
  rota_inicio_lat    double precision,
  rota_inicio_lng    double precision,
  posicao_lat        double precision,
  posicao_lng        double precision,
  posicao_em         timestamptz,

  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
comment on column public.pedidos.codigo_rastreio is 'Chave aleatória do link público /rastreio/<codigo>. Não expor em listagens públicas.';
comment on column public.pedidos.externo_id is 'ID do pedido no sistema de origem (ex.: ERP da loja).';

create unique index pedidos_externo_unico on public.pedidos (origem, externo_id) where externo_id is not null;
create index pedidos_status_idx on public.pedidos (status, atualizado_em desc);

create table public.pedido_eventos (
  id         bigint generated always as identity primary key,
  pedido_id  uuid not null references public.pedidos (id) on delete cascade,
  status     text not null,
  descricao  text not null default '',
  autor_nome text not null default '',
  origem     text not null default 'painel' check (origem in ('painel', 'integracao', 'sistema')),
  criado_em  timestamptz not null default now()
);
create index pedido_eventos_pedido_idx on public.pedido_eventos (pedido_id, criado_em);

-- ---------------------------------------------------------------------
-- Fila de integração (entrada = webhooks recebidos; saída = avisos a enviar)
-- ---------------------------------------------------------------------
create table public.integracao_fila (
  id                 bigint generated always as identity primary key,
  sistema            text not null default 'erp',
  direcao            text not null check (direcao in ('entrada', 'saida')),
  tipo               text not null,
  referencia         text not null default '',
  chave_idempotencia text,
  payload            jsonb not null default '{}'::jsonb,
  status             text not null default 'pendente' check (status in ('pendente', 'processado', 'erro', 'ignorado')),
  tentativas         integer not null default 0,
  ultimo_erro        text not null default '',
  criado_em          timestamptz not null default now(),
  processado_em      timestamptz
);
create unique index integracao_fila_idem on public.integracao_fila (sistema, direcao, chave_idempotencia)
  where chave_idempotencia is not null;
create index integracao_fila_pendentes on public.integracao_fila (direcao, status, criado_em) where status in ('pendente', 'erro');

-- ---------------------------------------------------------------------
-- RLS: leitura para a logística; escrita só pelas funções
-- ---------------------------------------------------------------------
alter table public.pedidos         enable row level security;
alter table public.pedido_eventos  enable row level security;
alter table public.integracao_fila enable row level security;

create policy "logística lê pedidos" on public.pedidos
  for select to authenticated using ((select public.eh_logistica()));
create policy "logística lê eventos" on public.pedido_eventos
  for select to authenticated using ((select public.eh_logistica()));
create policy "gestor lê a fila de integração" on public.integracao_fila
  for select to authenticated using ((select public.eh_gestor()));

revoke all on public.pedidos, public.pedido_eventos, public.integracao_fila from anon;
revoke insert, update, delete, truncate on public.pedidos, public.pedido_eventos, public.integracao_fila from authenticated;
revoke all on sequence public.pedidos_numero_seq from anon, authenticated;

-- ---------------------------------------------------------------------
-- Regras de status
-- ---------------------------------------------------------------------
create or replace function public.pedido_transicao_valida(p_de text, p_para text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case p_de
    when 'pago'              then p_para in ('em_separacao', 'cancelado')
    when 'em_separacao'      then p_para in ('saiu_para_entrega', 'pago', 'cancelado')
    when 'saiu_para_entrega' then p_para in ('entregue', 'em_separacao')
    else false
  end;
$$;

create or replace function public.pedido_descricao_padrao(p_status text)
returns text
language sql immutable
set search_path = ''
as $$
  select case p_status
    when 'pago'              then 'Pedido pago e enviado para a logística.'
    when 'em_separacao'      then 'Os produtos estão sendo separados no depósito.'
    when 'saiu_para_entrega' then 'O caminhão saiu para entrega.'
    when 'entregue'          then 'Pedido entregue.'
    when 'cancelado'         then 'Pedido cancelado.'
    else ''
  end;
$$;

-- Núcleo: muda o status, grava o evento e avisa a integração.
-- Uso interno (chamado pelas funções do painel e da integração).
create or replace function public.pedido_mudar_status(
  p_id uuid, p_status text, p_descricao text, p_autor text, p_origem text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v       public.pedidos;
  v_agora timestamptz := now();
  v_desc  text := coalesce(nullif(trim(p_descricao), ''), public.pedido_descricao_padrao(p_status));
begin
  select * into v from public.pedidos where id = p_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if v.status = p_status then
    return jsonb_build_object('id', v.id, 'status', v.status, 'alterado', false);
  end if;
  if not public.pedido_transicao_valida(v.status, p_status) then
    raise exception 'TRANSICAO_INVALIDA' using errcode = '22023',
      detail = format('De %s para %s não é permitido.', v.status, p_status);
  end if;

  update public.pedidos set
    status        = p_status,
    pago_em       = case when p_status = 'pago' then coalesce(pago_em, v_agora) else pago_em end,
    separacao_em  = case when p_status = 'em_separacao' then v_agora else separacao_em end,
    saiu_em       = case when p_status = 'saiu_para_entrega' then v_agora else saiu_em end,
    entregue_em   = case when p_status = 'entregue' then v_agora else entregue_em end,
    cancelado_em  = case when p_status = 'cancelado' then v_agora else cancelado_em end,
    -- Voltou para o depósito: a rota recomeça na próxima saída
    rota_inicio_lat = case when p_status = 'saiu_para_entrega' or v.status = 'saiu_para_entrega' then null else rota_inicio_lat end,
    rota_inicio_lng = case when p_status = 'saiu_para_entrega' or v.status = 'saiu_para_entrega' then null else rota_inicio_lng end,
    posicao_lat   = case when p_status = 'saiu_para_entrega' then null else posicao_lat end,
    posicao_lng   = case when p_status = 'saiu_para_entrega' then null else posicao_lng end,
    posicao_em    = case when p_status = 'saiu_para_entrega' then null else posicao_em end,
    atualizado_em = v_agora
  where id = p_id;

  insert into public.pedido_eventos (pedido_id, status, descricao, autor_nome, origem)
  values (p_id, p_status, left(v_desc, 500), coalesce(p_autor, ''), p_origem);

  -- Pedido veio de um sistema externo: avisa a mudança (sem eco do que veio de lá)
  if v.externo_id is not null and p_origem <> 'integracao' then
    insert into public.integracao_fila (sistema, direcao, tipo, referencia, payload)
    values (v.origem, 'saida', 'status_atualizado', v.externo_id, jsonb_build_object(
      'externo_id', v.externo_id, 'numero', v.numero, 'status', p_status, 'status_anterior', v.status,
      'descricao', v_desc, 'em', v_agora));
  end if;

  return jsonb_build_object('id', p_id, 'status', p_status, 'alterado', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Painel /logistica
-- ---------------------------------------------------------------------
create or replace function public.logistica_autor()
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select coalesce(nullif(a.nome, ''), a.email) from public.administradores a
                   where a.user_id = (select auth.uid())), '');
$$;

create or replace function public.logistica_atualizar_status(
  p_pedido uuid, p_status text, p_descricao text default '',
  p_motorista text default null, p_placa text default null, p_previsao timestamptz default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.eh_logistica() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  if p_status = 'saiu_para_entrega' then
    update public.pedidos set
      motorista        = coalesce(nullif(trim(p_motorista), ''), motorista),
      veiculo_placa    = upper(coalesce(nullif(trim(p_placa), ''), veiculo_placa)),
      previsao_entrega = coalesce(p_previsao, previsao_entrega)
    where id = p_pedido;
  end if;
  return public.pedido_mudar_status(p_pedido, p_status, p_descricao, public.logistica_autor(), 'painel');
end;
$$;

create or replace function public.logistica_registrar_posicao(p_pedido uuid, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if not public.eh_logistica() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'POSICAO_INVALIDA' using errcode = '22023';
  end if;
  update public.pedidos set
    rota_inicio_lat = coalesce(rota_inicio_lat, p_lat),
    rota_inicio_lng = coalesce(rota_inicio_lng, p_lng),
    posicao_lat = p_lat, posicao_lng = p_lng, posicao_em = now(), atualizado_em = now()
  where id = p_pedido and status = 'saiu_para_entrega'
  returning true into v_ok;
  return jsonb_build_object('ok', coalesce(v_ok, false));
end;
$$;

-- Não há função para a logística criar pedidos: toda venda (site, vendedor ou
-- PDV do balcão) nasce no ERP e chega aqui pela integração.

-- ---------------------------------------------------------------------
-- Público: rastreio pelo código (sem login)
-- ---------------------------------------------------------------------
create or replace function public.pedido_rastreio(p_codigo text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', p.numero,
    'status', p.status,
    'criado_em', p.criado_em,
    'pago_em', p.pago_em,
    'separacao_em', p.separacao_em,
    'saiu_em', p.saiu_em,
    'entregue_em', p.entregue_em,
    'cancelado_em', p.cancelado_em,
    'previsao_entrega', p.previsao_entrega,
    'motorista', split_part(p.motorista, ' ', 1),
    'veiculo_placa', p.veiculo_placa,
    'cliente_nome', split_part(p.cliente_nome, ' ', 1),
    'entrega_bairro', p.entrega_bairro,
    'entrega_cidade', p.entrega_cidade,
    'entrega_lat', p.entrega_lat,
    'entrega_lng', p.entrega_lng,
    'rota_inicio_lat', case when p.status = 'saiu_para_entrega' then p.rota_inicio_lat end,
    'rota_inicio_lng', case when p.status = 'saiu_para_entrega' then p.rota_inicio_lng end,
    'posicao_lat', case when p.status = 'saiu_para_entrega' then p.posicao_lat end,
    'posicao_lng', case when p.status = 'saiu_para_entrega' then p.posicao_lng end,
    'posicao_em', case when p.status = 'saiu_para_entrega' then p.posicao_em end,
    'atualizado_em', p.atualizado_em,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', i ->> 'nome', 'qtd', i -> 'qtd', 'unidade', i ->> 'unidade'))
                       from jsonb_array_elements(p.itens) i), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'descricao', e.descricao, 'criado_em', e.criado_em)
                                          order by e.criado_em)
                         from public.pedido_eventos e where e.pedido_id = p.id), '[]'::jsonb),
    'loja', (select jsonb_build_object('nome', pu.dados -> 'loja' ->> 'nome', 'logo_url', pu.dados -> 'loja' ->> 'logo_url',
                                       'whatsapp', pu.dados -> 'loja' ->> 'whatsapp')
             from public.publicacoes pu order by pu.id desc limit 1)
  )
  from public.pedidos p
  where length(p_codigo) >= 16 and p.codigo_rastreio = p_codigo;
$$;

-- Avisa a página de rastreio (canal público "rastreio:<codigo>") a cada mudança
create or replace function public.pedidos_avisar_rastreio()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('status', new.status, 'atualizado_em', new.atualizado_em),
      'atualizacao', 'rastreio:' || new.codigo_rastreio, false);
  exception when others then
    null; -- sem Realtime (ex.: banco local): a página de rastreio ainda atualiza por consulta periódica
  end;
  return null;
end;
$$;

create trigger pedidos_avisar_rastreio
  after insert or update on public.pedidos
  for each row execute function public.pedidos_avisar_rastreio();

-- O painel recebe as mudanças de pedidos e eventos em tempo real (respeitando o RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pedidos, public.pedido_eventos;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Integração (chamadas só pela Edge Function "integracao-erp", com a chave de serviço)
-- ---------------------------------------------------------------------

-- Cria ou atualiza um pedido PAGO vindo de um sistema externo. Devolve o id.
-- (A Edge Function já descarta pedidos sem pagamento confirmado.)
create or replace function public.integracao_registrar_pedido(p_sistema text, p_pedido jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ext    text := nullif(trim(p_pedido ->> 'externo_id'), '');
  v_id     uuid;
  v_status text := coalesce(nullif(p_pedido ->> 'status', ''), 'pago');
begin
  if v_ext is null then
    raise exception 'EXTERNO_ID_OBRIGATORIO' using errcode = '22023';
  end if;

  select id into v_id from public.pedidos where origem = p_sistema and externo_id = v_ext for update;

  if v_id is null then
    insert into public.pedidos (origem, externo_id, externo_dados, cliente_nome, cliente_telefone, cliente_documento,
                                entrega_endereco, entrega_bairro, entrega_cidade, entrega_referencia,
                                entrega_lat, entrega_lng, itens, total, forma_pagamento, observacao)
    values (p_sistema, v_ext, coalesce(p_pedido -> 'externo_dados', '{}'::jsonb),
            coalesce(nullif(trim(p_pedido ->> 'cliente_nome'), ''), 'Cliente'),
            coalesce(p_pedido ->> 'cliente_telefone', ''), coalesce(p_pedido ->> 'cliente_documento', ''),
            coalesce(p_pedido ->> 'entrega_endereco', ''), coalesce(p_pedido ->> 'entrega_bairro', ''),
            coalesce(p_pedido ->> 'entrega_cidade', ''), coalesce(p_pedido ->> 'entrega_referencia', ''),
            (p_pedido ->> 'entrega_lat')::double precision, (p_pedido ->> 'entrega_lng')::double precision,
            coalesce(p_pedido -> 'itens', '[]'::jsonb), coalesce((p_pedido ->> 'total')::numeric, 0),
            coalesce(p_pedido ->> 'forma_pagamento', ''), coalesce(p_pedido ->> 'observacao', ''))
    returning id into v_id;

    insert into public.pedido_eventos (pedido_id, status, descricao, autor_nome, origem)
    values (v_id, 'pago', 'Pedido pago recebido do sistema de gestão.', p_sistema, 'integracao');
  else
    update public.pedidos set
      externo_dados      = coalesce(p_pedido -> 'externo_dados', externo_dados),
      cliente_nome       = coalesce(nullif(trim(p_pedido ->> 'cliente_nome'), ''), cliente_nome),
      cliente_telefone   = coalesce(p_pedido ->> 'cliente_telefone', cliente_telefone),
      cliente_documento  = coalesce(p_pedido ->> 'cliente_documento', cliente_documento),
      entrega_endereco   = coalesce(p_pedido ->> 'entrega_endereco', entrega_endereco),
      entrega_bairro     = coalesce(p_pedido ->> 'entrega_bairro', entrega_bairro),
      entrega_cidade     = coalesce(p_pedido ->> 'entrega_cidade', entrega_cidade),
      entrega_referencia = coalesce(p_pedido ->> 'entrega_referencia', entrega_referencia),
      entrega_lat        = coalesce((p_pedido ->> 'entrega_lat')::double precision, entrega_lat),
      entrega_lng        = coalesce((p_pedido ->> 'entrega_lng')::double precision, entrega_lng),
      itens              = coalesce(p_pedido -> 'itens', itens),
      total              = coalesce((p_pedido ->> 'total')::numeric, total),
      forma_pagamento    = coalesce(p_pedido ->> 'forma_pagamento', forma_pagamento),
      atualizado_em      = now()
    where id = v_id;
  end if;

  -- Pedido já chega cancelado
  if v_status = 'cancelado' then
    perform public.pedido_mudar_status(v_id, 'cancelado', '', p_sistema, 'integracao')
    from public.pedidos where id = v_id and public.pedido_transicao_valida(status, 'cancelado');
  end if;

  return v_id;
end;
$$;

-- Aplica uma mudança de status vinda de um sistema externo
create or replace function public.integracao_mudar_status(p_sistema text, p_externo_id text, p_status text, p_descricao text default '')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.pedidos where origem = p_sistema and externo_id = p_externo_id;
  if v_id is null then
    raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  return public.pedido_mudar_status(v_id, p_status, p_descricao, p_sistema, 'integracao');
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------
revoke execute on function public.pedido_mudar_status(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.logistica_autor()                                  from public, anon, authenticated;
revoke execute on function public.integracao_registrar_pedido(text, jsonb)            from public, anon, authenticated;
revoke execute on function public.integracao_mudar_status(text, text, text, text)     from public, anon, authenticated;
revoke execute on function public.pedidos_avisar_rastreio()                           from public, anon, authenticated;
grant  execute on function public.integracao_registrar_pedido(text, jsonb)            to service_role;
grant  execute on function public.integracao_mudar_status(text, text, text, text)     to service_role;

revoke execute on function public.logistica_atualizar_status(uuid, text, text, text, text, timestamptz) from public, anon;
revoke execute on function public.logistica_registrar_posicao(uuid, double precision, double precision)  from public, anon;
grant  execute on function public.logistica_atualizar_status(uuid, text, text, text, text, timestamptz) to authenticated;
grant  execute on function public.logistica_registrar_posicao(uuid, double precision, double precision)  to authenticated;

grant execute on function public.pedido_rastreio(text)              to anon, authenticated;
grant execute on function public.eh_logistica()                     to anon, authenticated;
grant execute on function public.pedido_transicao_valida(text, text) to anon, authenticated;
