// Edge Function: admin-usuarios
// Gerencia quem pode entrar em /adm. Usa a chave de serviço (disponível
// automaticamente nas Edge Functions) e confere, em cada ação, se quem
// chama é um administrador ativo.
//
// Deploy:  supabase functions deploy admin-usuarios --no-verify-jwt
// (a autenticação é feita aqui dentro, inclusive para o primeiro acesso)

import { createClient, type User } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Papel = "administrador" | "editor";
interface AdminRow {
  user_id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
}

class Falha extends Error {
  constructor(msg: string, public status = 400) {
    super(msg);
  }
}

const resposta = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAPEIS: Papel[] = ["administrador", "editor"];

function texto(v: unknown, max = 120) {
  return String(v ?? "").trim().slice(0, max);
}
function validarEmail(v: unknown) {
  const e = texto(v, 254).toLowerCase();
  if (!EMAIL.test(e)) throw new Falha("Informe um e-mail válido.");
  return e;
}
function validarSenha(v: unknown) {
  const s = String(v ?? "");
  if (s.length < 8) throw new Falha("A senha precisa ter pelo menos 8 caracteres.");
  if (s.length > 72) throw new Falha("A senha pode ter no máximo 72 caracteres.");
  return s;
}
function validarPapel(v: unknown): Papel {
  if (!PAPEIS.includes(v as Papel)) throw new Falha("Escolha o tipo de acesso: administrador ou editor.");
  return v as Papel;
}

async function quemChama(req: Request): Promise<AdminRow> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Falha("Faça login para continuar.", 401);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Falha("Sua sessão expirou. Entre de novo.", 401);
  const { data: row } = await sb.from("administradores").select("*").eq("user_id", data.user.id).maybeSingle();
  if (!row || !row.ativo) throw new Falha("Sua conta não tem acesso ao editor.", 403);
  return row as AdminRow;
}

async function exigirGestor(req: Request) {
  const eu = await quemChama(req);
  if (eu.papel !== "administrador") throw new Falha("Só administradores podem gerenciar usuários.", 403);
  return eu;
}

async function contarAdmins() {
  const { count, error } = await sb.from("administradores").select("user_id", { count: "exact", head: true });
  if (error) throw new Falha("Não foi possível consultar os administradores.", 500);
  return count ?? 0;
}

async function acharUsuarioPorEmail(email: string): Promise<User | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Falha("Não foi possível consultar os usuários.", 500);
    const achou = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (achou) return achou;
    if (data.users.length < 1000) return null;
  }
  return null;
}

// Cria o login (ou reaproveita um login existente com o mesmo e-mail)
async function criarOuReaproveitarLogin(email: string, senha: string, nome: string): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (!error && data.user) return data.user.id;

  const existente = await acharUsuarioPorEmail(email);
  if (!existente) throw new Falha(error?.message ?? "Não foi possível criar o login.", 500);
  const { error: e2 } = await sb.auth.admin.updateUserById(existente.id, {
    password: senha,
    email_confirm: true,
    user_metadata: { ...(existente.user_metadata ?? {}), nome },
  });
  if (e2) throw new Falha("Não foi possível atualizar o login existente.", 500);
  return existente.id;
}

async function acao(req: Request, corpo: Record<string, unknown>) {
  switch (corpo.acao) {
    case "status":
      return { primeiro_acesso: (await contarAdmins()) === 0 };

    case "primeiro_acesso": {
      if ((await contarAdmins()) > 0) throw new Falha("O primeiro administrador já foi cadastrado. Faça login.", 409);
      const nome = texto(corpo.nome);
      if (!nome) throw new Falha("Informe seu nome.");
      const email = validarEmail(corpo.email);
      const senha = validarSenha(corpo.senha);
      const id = await criarOuReaproveitarLogin(email, senha, nome);
      const { error } = await sb.from("administradores").insert({ user_id: id, nome, email, papel: "administrador" });
      if (error) throw new Falha("Não foi possível concluir o cadastro.", 500);
      return { ok: true };
    }

    case "listar": {
      await quemChama(req);
      const { data, error } = await sb.from("administradores").select("*").order("criado_em");
      if (error) throw new Falha("Não foi possível listar os administradores.", 500);
      const lista = await Promise.all(
        (data as AdminRow[]).map(async (a) => {
          const { data: u } = await sb.auth.admin.getUserById(a.user_id);
          return { ...a, ultimo_acesso: u?.user?.last_sign_in_at ?? null };
        }),
      );
      return { administradores: lista };
    }

    case "criar": {
      const eu = await exigirGestor(req);
      const nome = texto(corpo.nome);
      if (!nome) throw new Falha("Informe o nome da pessoa.");
      const email = validarEmail(corpo.email);
      const senha = validarSenha(corpo.senha);
      const papel = validarPapel(corpo.papel);

      const existente = await acharUsuarioPorEmail(email);
      if (existente) {
        const { data: ja } = await sb.from("administradores").select("user_id").eq("user_id", existente.id).maybeSingle();
        if (ja) throw new Falha("Este e-mail já tem acesso ao editor.", 409);
      }
      const id = await criarOuReaproveitarLogin(email, senha, nome);
      const { error } = await sb.from("administradores")
        .insert({ user_id: id, nome, email, papel, criado_por: eu.user_id });
      if (error) throw new Falha("Não foi possível cadastrar o administrador.", 500);
      return { ok: true };
    }

    case "atualizar": {
      const eu = await quemChama(req);
      const alvo = texto(corpo.user_id, 64);
      const mudancas: Partial<AdminRow> = {};
      if (corpo.nome !== undefined) {
        const nome = texto(corpo.nome);
        if (!nome) throw new Falha("O nome não pode ficar vazio.");
        mudancas.nome = nome;
      }
      const mexeNoAcesso = corpo.papel !== undefined || corpo.ativo !== undefined;
      if (mexeNoAcesso) {
        if (eu.papel !== "administrador") throw new Falha("Só administradores podem mudar acessos.", 403);
        if (alvo === eu.user_id) throw new Falha("Você não pode mudar o seu próprio acesso. Peça a outro administrador.");
        if (corpo.papel !== undefined) mudancas.papel = validarPapel(corpo.papel);
        if (corpo.ativo !== undefined) mudancas.ativo = Boolean(corpo.ativo);
      } else if (alvo !== eu.user_id && eu.papel !== "administrador") {
        throw new Falha("Você só pode alterar o seu próprio nome.", 403);
      }
      if (!Object.keys(mudancas).length) return { ok: true };
      const { error } = await sb.from("administradores").update(mudancas).eq("user_id", alvo);
      if (error) throw new Falha("Não foi possível salvar a alteração.", 500);
      return { ok: true };
    }

    case "redefinir_senha": {
      await exigirGestor(req);
      const alvo = texto(corpo.user_id, 64);
      const senha = validarSenha(corpo.senha);
      const { data: row } = await sb.from("administradores").select("user_id").eq("user_id", alvo).maybeSingle();
      if (!row) throw new Falha("Administrador não encontrado.", 404);
      const { error } = await sb.auth.admin.updateUserById(alvo, { password: senha });
      if (error) throw new Falha("Não foi possível redefinir a senha.", 500);
      return { ok: true };
    }

    case "remover": {
      const eu = await exigirGestor(req);
      const alvo = texto(corpo.user_id, 64);
      if (alvo === eu.user_id) throw new Falha("Você não pode remover a si mesmo.");
      const { data: row } = await sb.from("administradores").select("user_id").eq("user_id", alvo).maybeSingle();
      if (!row) throw new Falha("Administrador não encontrado.", 404);
      const { error } = await sb.auth.admin.deleteUser(alvo); // remove também a linha (on delete cascade)
      if (error) throw new Falha("Não foi possível remover o administrador.", 500);
      return { ok: true };
    }

    default:
      throw new Falha("Ação desconhecida.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  try {
    const corpo = await req.json().catch(() => ({}));
    return resposta(await acao(req, corpo as Record<string, unknown>));
  } catch (e) {
    if (e instanceof Falha) return resposta({ erro: e.message }, e.status);
    console.error(e);
    return resposta({ erro: "Erro inesperado. Tente de novo em instantes." }, 500);
  }
});
