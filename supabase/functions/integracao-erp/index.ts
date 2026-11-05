// Edge Function: integracao-erp
// ---------------------------------------------------------------------
// Ponte entre o Catálogo ROMANO e o sistema de gestão (ERP) da loja.
//
//   POST /functions/v1/integracao-erp
//     a) Webhook do ERP (pedido pago, cancelado, status).
//        Exige o cabeçalho de assinatura HMAC (ver adaptador.ts).
//        Pedidos ainda sem pagamento são ignorados.
//     b) { "acao": "processar_fila" }   envia os status pendentes
//     c) { "acao": "testar_conexao" }   confere URL e chave da API
//        (b e c exigem login de administrador ou a chave de serviço)
//
// Segredos (supabase secrets set ...):
//   ERP_API_URL, ERP_API_KEY, ERP_WEBHOOK_SECRET
//
// Deploy: supabase functions deploy integracao-erp --no-verify-jwt
// ---------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  assinaturaValida, CABECALHO_ASSINATURA, configurada, enviarStatus, interpretarWebhook, lerConfig, testarConexao,
  type StatusPedido,
} from "./adaptador.ts";

const SISTEMA = "erp";
const MAX_TENTATIVAS = 8;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": `authorization, x-client-info, apikey, content-type, ${CABECALHO_ASSINATURA}`,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resposta = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

class Falha extends Error {
  constructor(msg: string, public status = 400) {
    super(msg);
  }
}

async function exigirGestorOuServico(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Falha("Faça login para continuar.", 401);
  if (token === chaveServico) return;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Falha("Sua sessão expirou. Entre de novo.", 401);
  const { data: row } = await sb.from("administradores").select("papel, ativo").eq("user_id", data.user.id).maybeSingle();
  if (!row?.ativo || row.papel !== "administrador") throw new Falha("Só administradores podem fazer isso.", 403);
}

// ---------------------------------------------------------------------
// Entrada: webhook
// ---------------------------------------------------------------------
async function receberWebhook(req: Request, bruto: string) {
  const cfg = lerConfig();
  if (!cfg.webhookSecret) throw new Falha("Integração não configurada (ERP_WEBHOOK_SECRET).", 503);
  if (!(await assinaturaValida(bruto, req.headers.get(CABECALHO_ASSINATURA), cfg.webhookSecret))) {
    throw new Falha("Assinatura inválida.", 401);
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    throw new Falha("JSON inválido.");
  }
  const ev = interpretarWebhook(corpo);

  // Idempotência: o mesmo evento entregue duas vezes é processado uma vez só
  const { data: fila, error: eFila } = await sb.from("integracao_fila").insert({
    sistema: SISTEMA, direcao: "entrada", tipo: ev.tipo, chave_idempotencia: ev.chave,
    referencia: ev.tipo === "pedido" ? ev.pedido.externo_id : ev.tipo === "status" ? ev.externo_id : "",
    payload: corpo, status: ev.tipo === "ignorado" ? "ignorado" : "pendente",
    ultimo_erro: ev.tipo === "ignorado" ? ev.motivo : "",
  }).select("id").single();

  if (eFila) {
    if (eFila.code === "23505") return { ok: true, duplicado: true };
    throw new Falha("Não foi possível registrar o evento.", 500);
  }
  if (ev.tipo === "ignorado") return { ok: true, ignorado: ev.motivo };

  try {
    if (ev.tipo === "pedido") {
      const { data, error } = await sb.rpc("integracao_registrar_pedido", { p_sistema: SISTEMA, p_pedido: ev.pedido });
      if (error) throw error;
      await sb.from("integracao_fila").update({ status: "processado", processado_em: new Date().toISOString(), tentativas: 1 }).eq("id", fila.id);
      return { ok: true, pedido_id: data };
    }
    const { error } = await sb.rpc("integracao_mudar_status", {
      p_sistema: SISTEMA, p_externo_id: ev.externo_id, p_status: ev.status, p_descricao: ev.descricao ?? "",
    });
    if (error) throw error;
    await sb.from("integracao_fila").update({ status: "processado", processado_em: new Date().toISOString(), tentativas: 1 }).eq("id", fila.id);
    return { ok: true };
  } catch (e) {
    const msg = (e as { message?: string }).message ?? String(e);
    await sb.from("integracao_fila").update({ status: "erro", tentativas: 1, ultimo_erro: msg.slice(0, 500) }).eq("id", fila.id);
    // 200 para o ERP não reenviar em loop um evento que nunca vai passar (ex.: transição inválida)
    return { ok: false, erro: msg };
  }
}

// ---------------------------------------------------------------------
// Saída: envia os status pendentes para o ERP
// ---------------------------------------------------------------------
async function processarFila() {
  const cfg = lerConfig();
  if (!configurada(cfg)) return { configurada: false, enviados: 0, mensagem: "Defina ERP_API_URL e ERP_API_KEY." };

  const { data: itens, error } = await sb.from("integracao_fila")
    .select("id, payload, tentativas")
    .eq("sistema", SISTEMA).eq("direcao", "saida").in("status", ["pendente", "erro"])
    .lt("tentativas", MAX_TENTATIVAS)
    .order("criado_em").limit(50);
  if (error) throw new Falha("Não foi possível ler a fila.", 500);

  let enviados = 0;
  let falhas = 0;
  for (const it of itens ?? []) {
    const p = it.payload as { externo_id: string; status: StatusPedido; descricao: string; em: string };
    try {
      await enviarStatus(cfg, p);
      await sb.from("integracao_fila").update({
        status: "processado", processado_em: new Date().toISOString(), tentativas: it.tentativas + 1, ultimo_erro: "",
      }).eq("id", it.id);
      enviados++;
    } catch (e) {
      falhas++;
      await sb.from("integracao_fila").update({
        status: "erro", tentativas: it.tentativas + 1, ultimo_erro: String((e as Error).message).slice(0, 500),
      }).eq("id", it.id);
    }
  }
  return { configurada: true, enviados, falhas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  try {
    const bruto = await req.text();
    let acao = "";
    try {
      acao = String((JSON.parse(bruto) as { acao?: unknown })?.acao ?? "");
    } catch { /* webhook com corpo não-JSON cai na validação abaixo */ }

    if (acao === "processar_fila") {
      await exigirGestorOuServico(req);
      return resposta(await processarFila());
    }
    if (acao === "testar_conexao") {
      await exigirGestorOuServico(req);
      const cfg = lerConfig();
      if (!configurada(cfg)) return resposta({ ok: false, configurada: false });
      await testarConexao(cfg);
      return resposta({ ok: true, configurada: true });
    }
    return resposta(await receberWebhook(req, bruto));
  } catch (e) {
    if (e instanceof Falha) return resposta({ erro: e.message }, e.status);
    console.error(e);
    return resposta({ erro: (e as Error).message ?? "Erro inesperado." }, 500);
  }
});
