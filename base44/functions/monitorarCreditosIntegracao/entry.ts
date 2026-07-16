import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";

// ============================================================
//  CONFIGURAÇÃO — ajuste os pesos aqui após o lançamento
// ============================================================
const CONFIG = {
  // Requisições de integração ( créditos ) por usuário/dia
  X_CIDADAOS_DIA: 6,   // cidadão: abrir chamado, ler alertas, upload de mídia, etc.
  Y_AGENTES_DIA: 24,   // agente: updates de localização frequentes + push + chat

  // Teto do plano Builder Base44
  LIMITE_CREDITOS_MENSAL: 10000,

  // Janela de projeção
  DIAS_PROJECAO: 30,

  // Webhook Discord/Slack (opcional): passa via body.discord_webhook_url
  // ou via function_args da automação agendada (não usa env).
  ASSUNTO_EMAIL: "⚠️ ALERTA DE CRÉDITOS SENTINELA",
};

// ============================================================
//  Helpers de data (mês civil)
// ============================================================
function diasRestantesNoMes(now = new Date()) {
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, ultimoDia - now.getDate());
}
function diasDecorridosNoMes(now = new Date()) {
  return now.getDate();
}

// ============================================================
//  Alerta: e-mail para admins + webhook Discord/Slack
// ============================================================
async function dispararAlerta(base44, mme, detalhe, webhookUrl) {
  const mensagem =
    "⚠️ ALERTA DE CRÉDITOS SENTINELA: A estimativa mensal com a base atual de usuários atingiu " +
    Math.round(mme) +
    " créditos, ultrapassando o limite do plano Builder (10.000). Faça o upgrade do plano para evitar a interupção do app em produção.\n\n" +
    detalhe;

  // 1) E-mail para todos os administradores registrados
  const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" }).catch(() => []);
  const emails = (admins || []).map((a) => a.email).filter(Boolean);
  for (const email of emails) {
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: CONFIG.ASSUNTO_EMAIL,
        body: mensagem,
      });
    } catch { /* e-mail individual pode falhar — segue para os demais */ }
  }

  // 2) Webhook Discord/Slack (opcional)
  const webhook = webhookUrl;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: mensagem }),
      });
    } catch { /* webhook indisponível — não bloqueia */ }
  }

  return { admins_notificados: emails.length, webhook_disparado: !!webhook };
}

// ============================================================
//  Função principal
// ============================================================
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    // ---- Entrada dinâmica: permite override por payload (calibração) ----
    let body = {};
    try { body = await req.json(); } catch { /* sem corpo = modo automático */ }

    let cidadaosAtivos = Number(body.cidadaos_ativos);
    let agentesAtivos = Number(body.agentes_ativos);
    const webhookUrl = body.discord_webhook_url || null;

    // Se não vier no payload, conta da base real de usuários
    if (!Number.isFinite(cidadaosAtivos) || !Number.isFinite(agentesAtivos)) {
      const usuarios = await base44.asServiceRole.entities.User.list(1000).catch(() => []);
      const contagem = { citizen: 0, agent: 0 };
      (usuarios || []).forEach((u) => {
        if (u.role === "citizen") contagem.citizen++;
        else if (u.role === "agent") contagem.agent++;
      });
      if (!Number.isFinite(cidadaosAtivos)) cidadaosAtivos = contagem.citizen;
      if (!Number.isFinite(agentesAtivos)) agentesAtivos = contagem.agent;
    }

    // ---- Passo 1: consumo diário projetado ----
    const consumoDiario =
      cidadaosAtivos * CONFIG.X_CIDADAOS_DIA + agentesAtivos * CONFIG.Y_AGENTES_DIA;

    // ---- Passo 2: Média Mensal Estimada (MME) ----
    const mme = consumoDiario * CONFIG.DIAS_PROJECAO;

    // ---- Passo 3: cruzar com teto e saldo restante ----
    const diasRestantes = diasRestantesNoMes();
    const diasDecorridos = diasDecorridosNoMes();
    const consumoEstimadoAteHoje = consumoDiario * diasDecorridos;
    const saldoRestante = Math.max(0, CONFIG.LIMITE_CREDITOS_MENSAL - consumoEstimadoAteHoje);
    const projecaoRestanteMes = consumoDiario * diasRestantes;

    // ---- Passo 4: gatilho de alerta ----
    const ultrapassouTeto = mme > CONFIG.LIMITE_CREDITOS_MENSAL;
    const estouraSaldoRestante = projecaoRestanteMes > saldoRestante;
    const deveAlertar = ultrapassouTeto || estouraSaldoRestante;

    let alerta = null;
    if (deveAlertar) {
      const detalhe =
        "Base atual: " + cidadaosAtivos + " cidadãos ativos · " + agentesAtivos + " agentes ativos.\n" +
        "Consumo diário projetado: " + consumoDiario + " créditos/dia.\n" +
        "MME (30 dias): " + Math.round(mme) + " créditos.\n" +
        "Saldo restante estimado: " + saldoRestante + " créditos (p/ " + diasRestantes + " dias restantes).\n" +
        "Projeção p/ o restante do mês: " + Math.round(projecaoRestanteMes) + " créditos.\n" +
        "Gatilho: " + (ultrapassouTeto ? "MME > teto (10.000)" : "projeção restante > saldo restante");
      alerta = await dispararAlerta(base44, mme, detalhe, webhookUrl);
    }

    return Response.json({
      status: "ok",
      configuracao: { X: CONFIG.X_CIDADAOS_DIA, Y: CONFIG.Y_AGENTES_DIA, limite: CONFIG.LIMITE_CREDITOS_MENSAL },
      base: { cidadaos_ativos: cidadaosAtivos, agentes_ativos: agentesAtivos },
      consumo_diario: consumoDiario,
      mme: Math.round(mme),
      saldo_restante_estimado: saldoRestante,
      projecao_restante_mes: Math.round(projecaoRestanteMes),
      dias_restantes: diasRestantes,
      alerta_disparado: deveAlertar,
      alerta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});