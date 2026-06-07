import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Versão para execução cron — sem usuário autenticado, usa service role
const FLOWS = [
  { key: "citizen_list_occurrences", label: "Cidadão: Listar ocorrências", profile: "citizen", critical: true,
    fn: async (b44) => { const r = await b44.entities.Occurrence.list("-created_date", 5); return `${r.length} ocorrências`; } },
  { key: "citizen_anonymous_tips", label: "Cidadão: Denúncias anônimas", profile: "citizen", critical: false,
    fn: async (b44) => { const r = await b44.entities.AnonymousTip.list("-created_date", 5); return `${r.length} denúncias`; } },
  { key: "citizen_wanted_board", label: "Cidadão: Procurados", profile: "citizen", critical: false,
    fn: async (b44) => { const r = await b44.entities.WantedCriminal.list("-created_date", 5); return `${r.length} procurados`; } },
  { key: "agent_list_open_occurrences", label: "Agente: Ocorrências abertas", profile: "agent", critical: true,
    fn: async (b44) => { const r = await b44.entities.Occurrence.filter({ status: "open" }, "-created_date", 10); return `${r.length} abertas`; } },
  { key: "agent_list_shifts", label: "Agente: Escalas", profile: "agent", critical: true,
    fn: async (b44) => { const r = await b44.entities.Shift.list("-created_date", 5); return `${r.length} escalas`; } },
  { key: "agent_list_vehicles", label: "Agente: Viaturas", profile: "agent", critical: true,
    fn: async (b44) => { const r = await b44.entities.Vehicle.list("-created_date", 5); return `${r.length} viaturas`; } },
  { key: "agent_tactical_stock", label: "Agente: Estoque tático", profile: "agent", critical: false,
    fn: async (b44) => { const r = await b44.entities.TacticalStock.list("-created_date", 5); return `${r.length} itens`; } },
  { key: "agent_chat_messages", label: "Agente: Mensagens de chat", profile: "agent", critical: false,
    fn: async (b44) => { const r = await b44.entities.ChatMessage.list("-created_date", 5); return `${r.length} mensagens`; } },
  { key: "admin_list_all_users", label: "Admin: Listar usuários", profile: "admin", critical: true,
    fn: async (b44) => { const r = await b44.entities.User.list("-created_date", 50); return `${r.length} usuários`; } },
  { key: "admin_occurrences_stats", label: "Admin: Stats de ocorrências", profile: "admin", critical: true,
    fn: async (b44) => { const r = await b44.entities.Occurrence.list("-created_date", 200); return `${r.length} ocorrências total`; } },
  { key: "admin_vehicle_fleet", label: "Admin: Auditoria de frota", profile: "admin", critical: false,
    fn: async (b44) => { const r = await b44.entities.Vehicle.list("-created_date", 50); return `${r.length} viaturas`; } },
  { key: "admin_system_logs", label: "Admin: Logs do sistema", profile: "admin", critical: false,
    fn: async (b44) => { const r = await b44.entities.SystemLog.list("-created_date", 10); return `${r.length} logs`; } },
  { key: "admin_maintenance_tickets", label: "Admin: Tickets manutenção", profile: "admin", critical: false,
    fn: async (b44) => { const r = await b44.entities.MaintenanceTicket.filter({ status: "open" }, "-created_date", 20); return `${r.length} abertos`; } },
  { key: "admin_training_progress", label: "Admin: Treinamentos", profile: "admin", critical: false,
    fn: async (b44) => { const r = await b44.entities.TrainingProgress.list("-created_date", 20); return `${r.length} registros`; } },
  { key: "admin_certificates", label: "Admin: Certificados", profile: "admin", critical: false,
    fn: async (b44) => { const r = await b44.entities.CertificateRecord.list("-issued_at", 10); return `${r.length} certificados`; } },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const runId = `cron_${Date.now()}`;
    const runStartedAt = new Date().toISOString();
    const runDate = new Date().toISOString().split("T")[0];

    let successCount = 0;
    let errorCount = 0;
    let criticalCount = 0;

    for (const flow of FLOWS) {
      const t0 = Date.now();
      let status = "success";
      let errorMessage = null;
      let errorPayload = null;

      try {
        await flow.fn(sr);
        successCount++;
      } catch (err) {
        status = "error";
        errorMessage = err.message || String(err);
        errorPayload = JSON.stringify({ message: err.message });
        errorCount++;
        if (flow.critical) criticalCount++;
      }

      await sr.entities.SystemHealthLog.create({
        run_id: runId,
        trigger: "cron",
        profile: flow.profile,
        flow_key: flow.key,
        flow_label: flow.label,
        status,
        latency_ms: Date.now() - t0,
        error_message: errorMessage,
        error_payload: errorPayload,
        is_critical: status === "error" && flow.critical,
        run_date: runDate,
        run_started_at: runStartedAt,
      });
    }

    // Log resumo no sistema
    await sr.entities.SystemLog.create({
      type: "info",
      message: `[CRON Health Check] ${successCount}/${FLOWS.length} OK | ${errorCount} erros | ${criticalCount} críticos | run_id: ${runId}`,
    }).catch(() => {});

    return Response.json({ run_id: runId, total: FLOWS.length, success: successCount, errors: errorCount, critical: criticalCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});