import { createClientFromRequest } from "npm:@base44/sdk@0.8.39";

function inicioFusoBrasilia() {
  // Hoje 00:00 no fuso de Brasília (UTC-3)
  const agora = new Date();
  const utc = agora.getTime() + agora.getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000);
}

function formatarHora(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

const TYPE_LABEL = {
  crime: "Crime",
  traffic: "Trânsito",
  civil_defense: "Defesa Civil",
  health: "Saúde / SAMU",
  panic: "Pânico",
};
const STATUS_LABEL = {
  open: "Aberta",
  in_progress: "Em Atendimento",
  resolved: "Resolvida",
  canceled: "Cancelada",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { body = {}; }

    // Admin-only se chamada manual; automação passa via service role
    const isManual = !body?.event;
    if (isManual && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const inicioDia = inicioFusoBrasilia();
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(inicioDia);
    fimDia.setDate(fimDia.getDate() + 1);

    // Ocorrências do dia (service role para ler tudo)
    const todas = await base44.asServiceRole.entities.Occurrence.list("-created_date", 1000);
    const doDia = todas.filter((o) => {
      try {
        const c = new Date(o.created_date);
        return c >= inicioDia && c < fimDia;
      } catch { return false; }
    });

    // Alertas de intrusão escolar do dia
    let alertasEscolares = [];
    try {
      const alertas = await base44.asServiceRole.entities.Alertas_Intrusao_Escolar.list("-created_date", 500);
      alertasEscolares = alertas.filter((a) => {
        try {
          const c = new Date(a.created_date || a.horario_tentativa);
          return c >= inicioDia && c < fimDia;
        } catch { return false; }
      });
    } catch { /* entidade pode não existir em alguns clientes */ }

    // Estatísticas
    const porTipo = {};
    const porStatus = {};
    const criticas = [];
    doDia.forEach((o) => {
      porTipo[o.type] = (porTipo[o.type] || 0) + 1;
      porStatus[o.status] = (porStatus[o.status] || 0) + 1;
      if (o.priority === "critical" || o.type === "panic") criticas.push(o);
    });

    // Top 10 mais recentes
    const recentes = doDia.slice(0, 10);

    // Monta corpo do e-mail em HTML
    const dataRef = inicioDia.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    let html = `
      <div style="font-family: Inter, Arial, sans-serif; color:#111827; max-width:680px; margin:auto;">
        <h2 style="color:#0ea5e9; border-bottom:2px solid #0ea5e9; padding-bottom:8px;">Sentinela — Resumo Diário de Alertas</h2>
        <p style="color:#6b7280; font-size:13px;">Referência: <strong>${dataRef}</strong></p>

        <h3 style="color:#111827;">Resumo Geral</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <tr><td style="padding:6px; background:#f3f4f6; font-weight:600;">Total de ocorrências</td><td style="padding:6px;">${doDia.length}</td></tr>
          <tr><td style="padding:6px; background:#f3f4f6; font-weight:600;">Ocorrências críticas / pânico</td><td style="padding:6px;">${criticas.length}</td></tr>
          <tr><td style="padding:6px; background:#f3f4f6; font-weight:600;">Alertas de intrusão escolar</td><td style="padding:6px;">${alertasEscolares.length}</td></tr>
        </table>

        <h3 style="color:#111827;">Por Tipo</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    Object.entries(porTipo).forEach(([t, n]) => {
      html += `<tr><td style="padding:6px;">${TYPE_LABEL[t] || t}</td><td style="padding:6px; text-align:right;">${n}</td></tr>`;
    });
    html += `</table>

        <h3 style="color:#111827;">Por Status</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    Object.entries(porStatus).forEach(([s, n]) => {
      html += `<tr><td style="padding:6px;">${STATUS_LABEL[s] || s}</td><td style="padding:6px; text-align:right;">${n}</td></tr>`;
    });
    html += `</table>`;

    if (criticas.length > 0) {
      html += `<h3 style="color:#dc2626;">⚠ Ocorrências Críticas / Pânico (${criticas.length})</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr style="background:#fef2f2; text-align:left;"><th style="padding:6px;">Hora</th><th style="padding:6px;">Tipo</th><th style="padding:6px;">Descrição</th><th style="padding:6px;">Local</th></tr>`;
      criticas.slice(0, 15).forEach((o) => {
        html += `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px;">${formatarHora(o.created_date)}</td>
          <td style="padding:6px;">${TYPE_LABEL[o.type] || o.type}</td>
          <td style="padding:6px;">${(o.description || o.subtype || "").slice(0, 80)}</td>
          <td style="padding:6px;"><a href="https://maps.google.com/?q=${o.lat},${o.lng}" style="color:#0ea5e9;">ver mapa</a></td>
        </tr>`;
      });
      html += `</table>`;
    }

    if (alertasEscolares.length > 0) {
      html += `<h3 style="color:#dc2626;">🏫 Alertas de Intrusão Escolar (${alertasEscolares.length})</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr style="background:#fef2f2; text-align:left;"><th style="padding:6px;">Hora</th><th style="padding:6px;">Escola</th><th style="padding:6px;">Tipo</th><th style="padding:6px;">Nível</th></tr>`;
      alertasEscolares.slice(0, 15).forEach((a) => {
        html += `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px;">${formatarHora(a.horario_tentativa || a.created_date)}</td>
          <td style="padding:6px;">${a.nome_escola || "—"}</td>
          <td style="padding:6px;">${a.tipo_alerta || "—"}</td>
          <td style="padding:6px;">${a.nivel || "—"}</td>
        </tr>`;
      });
      html += `</table>`;
    }

    if (recentes.length > 0) {
      html += `<h3 style="color:#111827;">Últimas 10 Ocorrências</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr style="background:#f3f4f6; text-align:left;"><th style="padding:6px;">Hora</th><th style="padding:6px;">Tipo</th><th style="padding:6px;">Status</th><th style="padding:6px;">Descrição</th></tr>`;
      recentes.forEach((o) => {
        html += `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px;">${formatarHora(o.created_date)}</td>
          <td style="padding:6px;">${TYPE_LABEL[o.type] || o.type}</td>
          <td style="padding:6px;">${STATUS_LABEL[o.status] || o.status}</td>
          <td style="padding:6px;">${(o.description || o.subtype || "").slice(0, 60)}</td>
        </tr>`;
      });
      html += `</table>`;
    }

    html += `<p style="color:#9ca3af; font-size:11px; margin-top:16px;">Relatório gerado automaticamente pelo Sentinela às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
      </div>`;

    // Envia e-mail para todos os admins
    let admins = [];
    try {
      const allUsers = await base44.asServiceRole.entities.User.list("-created_date", 500);
      admins = allUsers.filter((u) => u.role === "admin" && u.email);
    } catch { /* */ }

    const subject = `Sentinela — Resumo Diário de Alertas (${dataRef})`;
    let enviados = 0;
    let erros = 0;
    for (const a of admins) {
      try {
        await base44.integrations.Core.SendEmail({
          to: a.email,
          subject,
          body: html,
        });
        enviados++;
      } catch { erros++; }
    }

    return Response.json({
      status: "ok",
      data_referencia: dataRef,
      ocorrencias_dia: doDia.length,
      criticas: criticas.length,
      alertas_escolares: alertasEscolares.length,
      admins_notificados: enviados,
      erros_envio: erros,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});