# Catálogo ROMANO

Catálogo digital do home center com duas áreas:

| Endereço | Para quem | O que faz |
|---|---|---|
| `/home` | Clientes | Vitrine pública com banners, departamentos, ofertas, busca e **orçamento**: o cliente adiciona vários produtos, ajusta as quantidades e envia a lista pelo WhatsApp ou imprime/salva em PDF. O orçamento fica guardado no navegador do cliente, com os preços da versão publicada. Mostra sempre a **última versão publicada**. |
| `/adm` | Equipe da loja | Login, edição de produtos, preços, fotos, banners e dados da loja; **Gravar** (salva o rascunho) e **Publicar** (coloca no ar em `/home`); cadastro de outros administradores. |

`/` redireciona para `/home`.

## Como funciona

```
 /adm (equipe)                         Supabase                          /home (clientes)
 ─────────────                         ────────                          ────────────────
 edita no navegador ──Gravar──▶  tabelas de rascunho
                                 (loja, produtos, banners…)
                     ──Publicar─▶  publicacoes (foto JSON do rascunho) ──▶ lê a mais recente
```

- **Gravar** salva o rascunho no banco. Os clientes não veem nada ainda.
- **Publicar** grava (se houver pendências) e cria uma nova publicação. `/home` passa a mostrar essa versão na hora, sem novo deploy.
- Cada publicação fica no histórico. Em **Publicações** dá para colocar uma versão anterior de volta no ar.
- Se dois administradores editarem ao mesmo tempo, quem gravar por último recebe um aviso de conflito em vez de apagar o trabalho do outro.

### Quem pode o quê

| Papel | Editar e publicar | Cadastrar, desativar e remover administradores |
|---|---|---|
| Administrador | ✔ | ✔ |
| Editor | ✔ | — |
| Cliente (sem login) | — | — (só vê `/home`) |

A trava fica no banco (RLS + funções `security definer`), não só na tela: sem uma conta ativa na tabela `administradores`, ninguém lê o rascunho, grava, publica ou envia imagens.

## Estrutura

```
supabase/
  migrations/20261023120000_catalogo.sql   tabelas, RLS, funções e bucket de imagens
  seed.sql                                 dados de exemplo + primeira publicação (opcional)
  functions/admin-usuarios/index.ts        cadastro de administradores (usa a chave de serviço)
  config.toml
src/
  home/      Vitrine.tsx (vitrine) e HomePage.tsx (/home)
  adm/       AdmPage.tsx (login, primeiro acesso, recuperação de senha), Editor.tsx e abas/
  lib/       api.ts, supabase.ts, types.ts, format.ts, icons.tsx
  styles/    base.css, vitrine.css, adm.css
public/      logo.jpg, favicon.png, apple-touch-icon.png
vercel.json  redireciona / → /home e serve o app em /home e /adm
```

## Colocando no ar

### 1. Supabase

1. Crie um projeto (região `sa-east-1`, São Paulo).
2. Rode a migração. Escolha uma opção:
   - **Painel:** SQL Editor → cole o conteúdo de `supabase/migrations/20261023120000_catalogo.sql` → Run.
   - **CLI:** `supabase link --project-ref SEU_REF` e depois `supabase db push`.
3. (Opcional) Rode `supabase/seed.sql` no SQL Editor para começar com os produtos e banners de exemplo já publicados.
4. Publique a função de administradores:
   ```bash
   supabase functions deploy admin-usuarios --no-verify-jwt
   ```
   O `--no-verify-jwt` é necessário porque a própria função confere o login (inclusive no primeiro acesso, quando ainda não existe usuário).
5. Em **Authentication → Sign In / Providers → Email**, **desative “Allow new users to sign up”**. Os acessos são criados só pelo editor.
6. Em **Authentication → URL Configuration**:
   - **Site URL:** `https://SEU-DOMINIO/adm`
   - **Redirect URLs:** `https://SEU-DOMINIO/adm` (e `http://localhost:5173/adm` para testar localmente)

   Isso faz o link de “Esqueci minha senha” voltar para o editor.

### 2. Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório (framework detectado: Vite).
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → Supabase → Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` → a chave **anon** ou **publishable** (nunca a `service_role`)
4. Deploy. Para usar domínio próprio: Project → Settings → Domains.

### 3. Primeiro acesso

Abra `https://SEU-DOMINIO/adm`. Como ainda não há administradores, aparece a tela **Primeiro acesso**: crie sua conta principal. Essa tela some assim que o primeiro administrador existe. Faça isso logo após o deploy.

Depois, em **Administradores**, cadastre a equipe. O editor gera uma senha provisória e mostra os dados para você enviar à pessoa; ela troca a senha em **Minha conta**.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha URL e chave do Supabase
npm run dev                  # http://localhost:5173/home e /adm
npm run build                # verificação de tipos + build de produção
```

## Uso no dia a dia

- **Mudar um preço:** Produtos → altere “Por” e “De” direto na lista → Gravar → Publicar.
- **Muitos preços:** Preços em lote → baixe a planilha, ajuste no Excel, envie o CSV → Gravar → Publicar.
- **Trocar foto:** clique na miniatura do produto → Enviar imagem. A foto é reduzida no navegador antes do envio.
- **Conferir antes:** Pré-visualizar mostra o rascunho exatamente como o cliente vai ver.
- **Desfazer uma publicação:** Publicações → “Voltar para esta versão”.
- **Atalho:** Ctrl+S (ou Cmd+S) grava o rascunho.

## Cartazes (placas de oferta)

No `/adm`, a aba **Loja física → Cartazes** gera placas de oferta para imprimir:

- **Produto do catálogo:** busque pelo nome, código ou marca e a placa é preenchida com descrição, unidade e preços (“De” e “Por”) do rascunho atual.
- **7 modelos com o mascote:** Oferta ROMANO, Faixa de Obra, Splash Azul, Gôndola Horizontal, Preto e Amarelo e os sazonais **Black Friday** e **Natal** (mascote de gorro).
- **Editor de modelos:** mova, redimensione e troque cores, fontes e camadas (texto, preço, forma, mascote em 4 poses, foto do produto, logo). Ao editar um modelo pronto, é criada uma cópia sua.
- **Lote por planilha:** baixe a planilha modelo (.xlsx com as colunas Código, Descrição, Unidade, Valor antigo (De), Valor atual (Por), Validade e Cópias), preencha no Excel e importe (.xlsx ou .csv, também arrastando o arquivo). O gerador monta todas as placas e você baixa o PDF do lote, um `.zip` de PNGs ou manda imprimir. Também dá para baixar a planilha já preenchida com os produtos em oferta do catálogo, ou montar o lote direto pelo catálogo.
- **Tamanhos** de A6 a 66 × 96 cm, várias placas por folha com marcas de corte, ou placas grandes divididas em partes para colar.

O gerador é a página `cartaz.html` (código em `src/cartaz/`), aberta dentro do editor num iframe; o editor envia os produtos por `postMessage`. As poses do mascote ficam em `public/cartaz/`. Modelos personalizados ficam salvos no navegador (use **Exportar .json** para levar a outro computador).

## Logística e rastreio

| Endereço | Para quem | O que faz |
|---|---|---|
| `/logistica` | Equipe da logística (papel **Logística**) e administradores | Quadro de pedidos: *A separar → Em separação → Saiu para entrega → Entregue*. Atualiza ao vivo. |
| `/rastreio/<código>` | Cliente (sem login) | Etapas do pedido, caminhão ROMANO andando na estrada, motorista, placa e previsão. Atualiza ao vivo. |
| `/logistica/demo` | Para conferir as telas | Painel com pedidos de exemplo, sem banco e sem login (dados só no navegador). |

**Fluxo:** a logística **não confirma pagamento**: todo pedido que chega nela já está pago e entra direto em *A separar*. A logística **também não lança pedidos**: toda venda (site, vendedor ou balcão, pelo PDV) é registrada no ERP e chega ao painel sozinha pela integração. Na demonstração, o botão *Simular venda no ERP* imita esse envio. A logística clica em *Iniciar separação* e depois em *Saiu para entrega*, informando motorista, placa e previsão. Por fim, *Confirmar entrega*. Cada mudança fica no histórico e chega na hora para o cliente. O botão *Avisar no WhatsApp* envia o link de rastreio.

**GPS (opcional):** no celular do motorista, abra o pedido e toque em *Enviar minha localização*. Sem GPS, o rastreio estima a posição do caminhão pelo horário de saída e pela previsão.

**Banco:** `supabase/migrations/20261104120000_logistica.sql` cria `pedidos`, `pedido_eventos`, `integracao_fila`, o papel `logistica` e as funções. As regras de status ficam em `pedido_transicao_valida`.

### Integração com o ERP (preparada)

- A Edge Function `supabase/functions/integracao-erp/` recebe os webhooks do sistema de gestão (pedido pago, cancelado ou com status alterado) e envia de volta os status mudados no painel. Pedidos ainda sem pagamento são ignorados: só entram na logística depois de pagos.
- **Tudo o que é específico da API do ERP está em `adaptador.ts`**: nomes de status, campos do JSON, endpoints e assinatura. Os pontos marcados com `CONFIRMAR` são suposições e precisam ser conferidos com a documentação oficial.
- Eventos repetidos são ignorados (idempotência). Os envios que falharem ficam em `integracao_fila` para uma nova tentativa (`{"acao":"processar_fila"}`, que pode ser agendado com pg_cron).
- Os produtos podem ser sincronizados pelo SKU com `listarProdutos()` quando for a hora.

```bash
supabase db push                                   # aplica a migração
supabase functions deploy integracao-erp --no-verify-jwt
supabase functions deploy admin-usuarios --no-verify-jwt   # passa a aceitar o papel "logistica"
supabase secrets set ERP_API_URL=... ERP_API_KEY=... ERP_WEBHOOK_SECRET=...
```

URL do webhook para cadastrar no ERP: `https://SEU-PROJETO.supabase.co/functions/v1/integracao-erp`

## Observações

- Imagens ficam no bucket público `catalogo` (limite de 5 MB por arquivo, JPG/PNG/WebP). Imagens trocadas não são apagadas automaticamente.
- Os textos de produtos, preços, endereço e WhatsApp do `seed.sql` são exemplos. Desligue o aviso de demonstração em **Dados da loja**.
- O e-mail padrão do Supabase para recuperação de senha tem limite de envios por hora. Para uso intenso, configure um SMTP próprio em Authentication → Emails.
