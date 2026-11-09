-- =====================================================================
-- Catálogo ROMANO — Simulação de vendas do caixa (PDV) no painel /logistica
--
-- Para treinar a equipe e demonstrar o fluxo antes da integração com o
-- sistema de gestão estar ativa. Os pedidos simulados:
--   * ficam marcados (simulado = true) e aparecem com selo no painel;
--   * não têm externo_id, então nada é enviado ao sistema de gestão;
--   * podem ser apagados de uma vez com logistica_limpar_simulacoes().
-- =====================================================================

alter table public.pedidos add column if not exists simulado boolean not null default false;
comment on column public.pedidos.simulado is 'Pedido de teste criado pelo botão "Simular venda do caixa". Pode ser apagado.';

create or replace function public.logistica_simular_venda_caixa()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_exemplos jsonb := '[
    {"cliente": "Paulo Henrique", "tel": "91993334455", "end": "Rua São João, 210", "bairro": "São João", "pag": "Pix",
     "itens": [{"sku": "CIM-50", "nome": "Cimento CP II 50 kg", "qtd": 10, "unidade": "sc", "preco": 38.9},
               {"sku": "CAL-20", "nome": "Cal hidratada 20 kg", "qtd": 4, "unidade": "sc", "preco": 18.5}]},
    {"cliente": "Joana Ribeiro", "tel": "91984445566", "end": "Rua Santa Rosa, 300, casa 4", "bairro": "Santa Rosa", "pag": "Cartão de débito",
     "itens": [{"sku": "TIN-36", "nome": "Tinta látex PVA 3,6 L", "qtd": 4, "unidade": "un", "preco": 79.9},
               {"sku": "LIX-100", "nome": "Lixa d’água 100", "qtd": 10, "unidade": "un", "preco": 2.5}]},
    {"cliente": "Mercadinho Bom Preço", "tel": "9137511212", "end": "Av. Dom Pedro II, 540", "bairro": "Centro", "pag": "Dinheiro",
     "itens": [{"sku": "LAM-9W", "nome": "Lâmpada LED 9 W", "qtd": 24, "unidade": "un", "preco": 9.9},
               {"sku": "TOM-10A", "nome": "Tomada 10 A", "qtd": 12, "unidade": "un", "preco": 11.9}]},
    {"cliente": "Francisco das Chagas", "tel": "91982227788", "end": "Travessa Santa Rita, 15", "bairro": "Algodoal", "pag": "Cartão de crédito 3x",
     "itens": [{"sku": "ARE-M3", "nome": "Areia média", "qtd": 3, "unidade": "m³", "preco": 145},
               {"sku": "BRI-M3", "nome": "Brita 1", "qtd": 2, "unidade": "m³", "preco": 160},
               {"sku": "CIM-50", "nome": "Cimento CP II 50 kg", "qtd": 15, "unidade": "sc", "preco": 38.9}]},
    {"cliente": "Igreja Assembleia de Deus", "tel": "9137513030", "end": "Rua da Paz, 400", "bairro": "Cristo Redentor", "pag": "Pix",
     "itens": [{"sku": "POR-60", "nome": "Porcelanato 60x60 acetinado", "qtd": 45, "unidade": "m²", "preco": 69.9},
               {"sku": "ARG-AC3", "nome": "Argamassa AC-III 20 kg", "qtd": 18, "unidade": "sc", "preco": 42},
               {"sku": "REJ-01", "nome": "Rejunte flexível 1 kg", "qtd": 10, "unidade": "un", "preco": 12.9}]},
    {"cliente": "Maria do Socorro", "tel": "91987771122", "end": "Rua Nova, 52", "bairro": "Mutirão", "pag": "Dinheiro",
     "itens": [{"sku": "CAI-1000", "nome": "Caixa d’água 1000 L", "qtd": 1, "unidade": "un", "preco": 449.9},
               {"sku": "TUB-25", "nome": "Tubo PVC soldável 25 mm 6 m", "qtd": 6, "unidade": "br", "preco": 18.9}]}
  ]'::jsonb;
  v_ex     jsonb;
  v_caixa  text := lpad((1 + floor(random() * 3))::int::text, 2, '0');
  v_cupom  text := lpad((10000 + floor(random() * 89999))::int::text, 6, '0');
  v_total  numeric;
  v        public.pedidos;
begin
  if not public.eh_logistica() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  v_ex := v_exemplos -> floor(random() * jsonb_array_length(v_exemplos))::int;
  select coalesce(sum((i ->> 'qtd')::numeric * (i ->> 'preco')::numeric), 0) into v_total
  from jsonb_array_elements(v_ex -> 'itens') i;

  insert into public.pedidos (origem, simulado, cliente_nome, cliente_telefone, entrega_endereco, entrega_bairro, entrega_cidade,
                              itens, total, forma_pagamento, observacao)
  values ('erp', true, v_ex ->> 'cliente', v_ex ->> 'tel', v_ex ->> 'end', v_ex ->> 'bairro', 'Abaetetuba - PA',
          v_ex -> 'itens', round(v_total, 2), v_ex ->> 'pag',
          format('SIMULAÇÃO · Venda no caixa %s (PDV) · cupom %s', v_caixa, v_cupom))
  returning * into v;

  insert into public.pedido_eventos (pedido_id, status, descricao, autor_nome, origem)
  values (v.id, 'pago', format('Venda paga no caixa %s (PDV) — simulação.', v_caixa), public.logistica_autor(), 'sistema');

  return jsonb_build_object('pedido', to_jsonb(v), 'caixa', v_caixa);
end;
$$;

create or replace function public.logistica_limpar_simulacoes()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  if not public.eh_logistica() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  delete from public.pedidos where simulado;   -- eventos saem junto (on delete cascade)
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke execute on function public.logistica_simular_venda_caixa() from public, anon;
revoke execute on function public.logistica_limpar_simulacoes()    from public, anon;
grant  execute on function public.logistica_simular_venda_caixa() to authenticated;
grant  execute on function public.logistica_limpar_simulacoes()    to authenticated;
