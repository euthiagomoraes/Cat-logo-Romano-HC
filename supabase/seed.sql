-- =====================================================================
-- Catálogo RHC — dados de exemplo (opcional)
-- Rode depois da migração principal. Cria um rascunho de demonstração e
-- a primeira publicação, para /home já abrir com conteúdo.
-- Produtos, preços e contatos são EXEMPLOS: troque tudo em /adm.
-- =====================================================================
begin;

update public.loja set
  nome = 'RHC Home Center',
  slogan = 'Tudo para a sua obra, do alicerce ao acabamento',
  whatsapp = '5591999990000',
  telefone = '(91) 3000-0000',
  endereco = 'Av. Exemplo, 1000 – Centro',
  horario = 'Seg a Sex 7h–18h · Sáb 7h–13h',
  aviso = 'Preços válidos enquanto durarem os estoques. Imagens meramente ilustrativas. Consulte disponibilidade pelo WhatsApp.',
  mostrar_aviso_demo = true,
  alterado_em = now()
where id = 1;

insert into public.servicos (ordem, icone, titulo, texto) values
  (1, 'truck', 'Entrega na obra', 'Combine a entrega no endereço da sua obra.'),
  (2, 'store', 'Retire na loja', 'Separe pelo WhatsApp e retire no balcão.'),
  (3, 'card', 'Parcele no cartão', 'Em até 10x sem juros nos itens indicados.'),
  (4, 'chat', 'Atendimento no WhatsApp', 'Orçamento rápido com vendedor especializado.');

insert into public.categorias (id, ordem, nome, icone) values
  ('78a5d787-de5d-5678-a0f2-3ca4857a9e52', 1, 'Cimento e Argamassa', 'cimento'),
  ('5bf5dc0f-67b7-568c-8a62-f71e604b51ee', 2, 'Tintas', 'tinta'),
  ('fb48fd2c-4e0e-5b18-8094-de562bd33e03', 3, 'Ferramentas', 'ferramentas'),
  ('566784b5-b19a-5584-8685-1291848a0ff2', 4, 'Elétrica', 'eletrica'),
  ('569e24b3-c47a-56fa-ae47-50f85d4d66bb', 5, 'Hidráulica', 'hidraulica'),
  ('47b7e6d6-d65f-5d8c-b83a-27f3d3ed071e', 6, 'Pisos e Revestimentos', 'pisos'),
  ('44d27db9-e452-518c-86cd-e3525f794f82', 7, 'Banheiro', 'banheiro'),
  ('f18c73b5-5c23-52e6-9655-d64669e4a671', 8, 'Jardim', 'jardim');

insert into public.banners (ordem, ativo, estilo, selo, titulo, subtitulo, destaque, cta, link) values
  (1, true, 'azul', 'Semana da Obra', 'Cimento e argamassa com preço de atacado', 'Cimento CP II 50 kg por R$ 39,90 o saco. Leve hoje para a sua obra.', 'até 15% off', 'Ver ofertas', 'cat:78a5d787-de5d-5678-a0f2-3ca4857a9e52'),
  (2, true, 'amarelo', 'Pintura', 'Renove a casa com tinta de qualidade', 'Tinta acrílica 18 L em até 10x sem juros no cartão.', '10x sem juros', 'Ver tintas', 'cat:5bf5dc0f-67b7-568c-8a62-f71e604b51ee'),
  (3, true, 'escuro', 'Entrega', 'Levamos o material até a sua obra', 'Peça pelo WhatsApp e receba no endereço combinado, ou retire na loja.', 'Retire hoje', 'Chamar no WhatsApp', 'whatsapp');

insert into public.produtos (ordem, sku, nome, categoria_id, unidade, preco, preco_de, parcelas, destaque, descricao) values
  (1, '100101', 'Cimento CP II-E-32 50 kg', '78a5d787-de5d-5678-a0f2-3ca4857a9e52', 'saco 50 kg', 39.90, 44.90, 1, true, 'Cimento Portland composto para uso geral: concreto, reboco, contrapiso e assentamento.'),
  (2, '100102', 'Argamassa AC-II cinza 20 kg', '78a5d787-de5d-5678-a0f2-3ca4857a9e52', 'saco 20 kg', 24.90, 27.90, 1, false, 'Para assentar pisos e revestimentos cerâmicos em áreas internas e externas.'),
  (3, '100103', 'Rejunte flexível cinza platina 1 kg', '78a5d787-de5d-5678-a0f2-3ca4857a9e52', 'pacote 1 kg', 12.90, 0.00, 1, false, ''),
  (4, '100401', 'Tinta acrílica fosca branco neve 18 L', '5bf5dc0f-67b7-568c-8a62-f71e604b51ee', 'lata 18 L', 289.90, 339.90, 10, true, 'Alto rendimento e boa cobertura para paredes internas e externas.'),
  (5, '100402', 'Massa corrida PVA 25 kg', '5bf5dc0f-67b7-568c-8a62-f71e604b51ee', 'balde 25 kg', 79.90, 0.00, 3, false, ''),
  (6, '100403', 'Rolo de lã 23 cm com cabo', '5bf5dc0f-67b7-568c-8a62-f71e604b51ee', 'un', 34.90, 0.00, 1, false, ''),
  (7, '100701', 'Furadeira de impacto 650 W 127 V', 'fb48fd2c-4e0e-5b18-8094-de562bd33e03', 'un', 249.90, 289.90, 10, true, 'Mandril de 1/2", velocidade variável e função impacto para alvenaria.'),
  (8, '100702', 'Jogo de chaves combinadas 12 peças', 'fb48fd2c-4e0e-5b18-8094-de562bd33e03', 'jogo', 89.90, 0.00, 3, false, ''),
  (9, '100703', 'Trena emborrachada 5 m', 'fb48fd2c-4e0e-5b18-8094-de562bd33e03', 'un', 24.90, 0.00, 1, false, ''),
  (10, '101001', 'Lâmpada LED bulbo 9 W luz branca', '566784b5-b19a-5584-8685-1291848a0ff2', 'un', 8.99, 0.00, 1, false, ''),
  (11, '101002', 'Cabo flexível 2,5 mm² azul 100 m', '566784b5-b19a-5584-8685-1291848a0ff2', 'rolo 100 m', 239.90, 269.90, 6, true, 'Cabo de cobre 750 V para instalações residenciais.'),
  (12, '101003', 'Disjuntor DIN unipolar 20 A', '566784b5-b19a-5584-8685-1291848a0ff2', 'un', 18.90, 0.00, 1, false, ''),
  (13, '101301', 'Tubo PVC soldável 25 mm 6 m', '569e24b3-c47a-56fa-ae47-50f85d4d66bb', 'barra 6 m', 22.90, 0.00, 1, false, ''),
  (14, '101302', 'Caixa d''água de polietileno 1000 L', '569e24b3-c47a-56fa-ae47-50f85d4d66bb', 'un', 449.90, 499.90, 10, true, 'Com tampa, leve e resistente. Ideal para residências.'),
  (15, '101303', 'Torneira de cozinha bica alta', '569e24b3-c47a-56fa-ae47-50f85d4d66bb', 'un', 129.90, 0.00, 3, false, ''),
  (16, '101601', 'Porcelanato polido bege 60×60', '47b7e6d6-d65f-5d8c-b83a-27f3d3ed071e', 'm²', 59.90, 69.90, 10, true, 'Caixa com 1,44 m². Retificado, para áreas internas.'),
  (17, '101602', 'Piso cerâmico cinza 45×45', '47b7e6d6-d65f-5d8c-b83a-27f3d3ed071e', 'm²', 29.90, 0.00, 1, false, ''),
  (18, '101901', 'Chuveiro elétrico 5500 W 220 V', '44d27db9-e452-518c-86cd-e3525f794f82', 'un', 99.90, 119.90, 3, false, ''),
  (19, '101902', 'Bacia com caixa acoplada branca', '44d27db9-e452-518c-86cd-e3525f794f82', 'conjunto', 449.90, 0.00, 10, false, ''),
  (20, '102201', 'Mangueira de jardim 20 m com esguicho', 'f18c73b5-5c23-52e6-9655-d64669e4a671', 'un', 79.90, 89.90, 3, false, ''),
  (21, '102202', 'Terra vegetal adubada 25 kg', 'f18c73b5-5c23-52e6-9655-d64669e4a671', 'saco 25 kg', 19.90, 0.00, 1, false, '');

insert into public.publicacoes (publicado_por_nome, observacao, dados)
values ('Sistema', 'Carga inicial de exemplo', public.montar_catalogo(false));

update public.loja set publicado_em = now() where id = 1;

commit;
