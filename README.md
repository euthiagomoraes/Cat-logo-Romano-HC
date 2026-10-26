# Catálogo RHC

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

## Observações

- Imagens ficam no bucket público `catalogo` (limite de 5 MB por arquivo, JPG/PNG/WebP). Imagens trocadas não são apagadas automaticamente.
- Os textos de produtos, preços, endereço e WhatsApp do `seed.sql` são exemplos. Desligue o aviso de demonstração em **Dados da loja**.
- O e-mail padrão do Supabase para recuperação de senha tem limite de envios por hora. Para uso intenso, configure um SMTP próprio em Authentication → Emails.
