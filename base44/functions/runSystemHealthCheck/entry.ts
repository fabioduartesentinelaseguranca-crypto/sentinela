import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Definição de todos os fluxos de teste por perfil
const FLOWS = [
  // ── CITIZEN ──────────────────────────────────────────
  {
    key: "citizen_list_occurrences",
    label: "Cidadão: Listar ocorrências",
    profile: "citizen",
    critical: true,
    fn: async (b44) => {
      const items = await b44.asServiceRole.entities.Occurrence.list("-created_date", 5);
      if (!Array.isArray(items)) throw new Error("Resposta inválida ao listar ocorrências");
      return `${items.length} ocorrências encontradas`;
    },
  },
  {
    key: "citizen_create_occurrence",
    label: "Cidadão: Criar ocorrência (simulação)",
    profile: "citizen",
    critical: true,
    fn: async (b44) => {
      const occ = await b44.asServiceRole.entities.Occurrence.create({
        type: "crime",
        subtype: "TEST_HEALTH_CHECK",
        description: "Ocorrência de teste automatizado - pode ser excluída",
        status: "open",
        priority: "low",
        lat: -23.7,
        lng: -46.5,
        address: "Teste automatizado",
      });
      if (!occ?.id) throw new Error("Falha ao criar ocorrência de teste");
      // Cleanup imediato
      await b44.asServiceRole.entities.Occurrence.delete(occ.id);
      return `Ocorrência criada e removida (ID temporário: ${occ.id})`;
    },
  },
  {
    key: "citizen_list_users",
    label: "Cidadão: Carregar dados de usuário",
    profile: "citizen",
    critical: false,
    fn: async (b44) => {
      const users = await b44.asServiceRole.entities.User.list("-created_date", 1);
      if (!Array.isArray(users)) throw new Error("Falha ao carregar usuários");
      return `${users.length} usuário(s) retornados`;
    },
  },
  {
    key: "citizen_anonymous_tips",
    label: "Cidadão: Listar denúncias anônimas",
    profile: "citizen",
    critical: false,
    fn: async (b44) => {
      const tips = await b44.asServiceRole.entities.AnonymousTip.list("-created_date", 5);
      return `${tips.length} denúncias carregadas`;
    },
  },
  {
    key: "citizen_emergency_contacts",
    label: "Cidadão: Listar contatos de emergência",
    profile: "citizen",
    critical: false,
    fn: async (b44) => {
      const contacts = await b44.asServiceRole.entities.EmergencyContact.list("-created_date", 5);
      return `${contacts.length} contatos carregados`;
    },
  },
  {
    key: "citizen_wanted_board",
    label: "Cidadão: Listar procurados",
    profile: "citizen",
    critical: false,
    fn: async (b44) => {
      const wanted = await b44.asServiceRole.entities.WantedCriminal.list("-created_date", 5);
      return `${wanted.length} procurados carregados`;
    },
  },
  {
    key: "citizen_points_log",
    label: "Cidadão: Consultar log de pontos",
    profile: "citizen",
    critical: false,
    fn: async (b44) => {
      const logs = await b44.asServiceRole.entities.PointsLog.list("-created_date", 5);
      return `${logs.length} registros de pontos`;
    },
  },

  // ── AGENT ─────────────────────────────────────────────
  {
    key: "agent_list_open_occurrences",
    label: "Agente: Listar ocorrências abertas",
    profile: "agent",
    critical: true,
    fn: async (b44) => {
      const items = await b44.asServiceRole.entities.Occurrence.filter({ status: "open" }, "-created_date", 10);
      return `${items.length} ocorrências abertas`;
    },
  },
  {
    key: "agent_list_shifts",
    label: "Agente: Listar escalas",
    profile: "agent",
    critical: true,
    fn: async (b44) => {
      const shifts = await b44.asServiceRole.entities.Shift.list("-created_date", 5);
      return `${shifts.length} escalas carregadas`;
    },
  },
  {
    key: "agent_list_scheduled_shifts",
    label: "Agente: Listar escalas programadas",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const ss = await b44.asServiceRole.entities.ScheduledShift.list("-created_date", 5);
      return `${ss.length} escalas programadas`;
    },
  },
  {
    key: "agent_list_vehicles",
    label: "Agente: Listar viaturas",
    profile: "agent",
    critical: true,
    fn: async (b44) => {
      const vehs = await b44.asServiceRole.entities.Vehicle.list("-created_date", 5);
      return `${vehs.length} viaturas carregadas`;
    },
  },
  {
    key: "agent_list_patrol_zones",
    label: "Agente: Listar zonas de patrulha",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const zones = await b44.asServiceRole.entities.PatrolZone.list("-created_date", 5);
      return `${zones.length} zonas carregadas`;
    },
  },
  {
    key: "agent_tactical_stock",
    label: "Agente: Verificar estoque tático",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const stock = await b44.asServiceRole.entities.TacticalStock.list("-created_date", 5);
      return `${stock.length} itens no estoque tático`;
    },
  },
  {
    key: "agent_psych_evaluations",
    label: "Agente: Listar avaliações psicológicas",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const evals = await b44.asServiceRole.entities.PsychEvaluation.list("-created_date", 5);
      return `${evals.length} avaliações carregadas`;
    },
  },
  {
    key: "agent_chat_messages",
    label: "Agente: Carregar mensagens de chat",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const msgs = await b44.asServiceRole.entities.ChatMessage.list("-created_date", 5);
      return `${msgs.length} mensagens carregadas`;
    },
  },
  {
    key: "agent_training_modules",
    label: "Agente: Listar módulos de treinamento",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const modules = await b44.asServiceRole.entities.TrainingModule.list("-created_date", 5);
      return `${modules.length} módulos carregados`;
    },
  },
  {
    key: "agent_equipment_checklists",
    label: "Agente: Listar checklists de equipamento",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const checks = await b44.asServiceRole.entities.EquipmentChecklist.list("-created_date", 5);
      return `${checks.length} checklists carregados`;
    },
  },
  {
    key: "agent_missions",
    label: "Agente: Listar missões de turno",
    profile: "agent",
    critical: false,
    fn: async (b44) => {
      const missions = await b44.asServiceRole.entities.ShiftMission.list("-created_date", 5);
      return `${missions.length} missões carregadas`;
    },
  },

  // ── ADMIN ─────────────────────────────────────────────
  {
    key: "admin_list_all_users",
    label: "Admin: Listar todos os usuários",
    profile: "admin",
    critical: true,
    fn: async (b44) => {
      const users = await b44.asServiceRole.entities.User.list("-created_date", 50);
      if (!Array.isArray(users)) throw new Error("Falha ao listar usuários");
      const roles = {};
      users.forEach((u) => { roles[u.role || "citizen"] = (roles[u.role || "citizen"] || 0) + 1; });
      return `${users.length} usuários | roles: ${JSON.stringify(roles)}`;
    },
  },
  {
    key: "admin_occurrences_stats",
    label: "Admin: Estatísticas de ocorrências",
    profile: "admin",
    critical: true,
    fn: async (b44) => {
      const occs = await b44.asServiceRole.entities.Occurrence.list("-created_date", 200);
      const byStatus = { open: 0, in_progress: 0, resolved: 0, canceled: 0 };
      occs.forEach((o) => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });
      return `Total: ${occs.length} | ${JSON.stringify(byStatus)}`;
    },
  },
  {
    key: "admin_vehicle_fleet",
    label: "Admin: Auditoria da frota",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const vehs = await b44.asServiceRole.entities.Vehicle.list("-created_date", 50);
      const maintenance = await b44.asServiceRole.entities.VehicleMaintenance.list("-created_date", 20);
      return `${vehs.length} viaturas, ${maintenance.length} registros de manutenção`;
    },
  },
  {
    key: "admin_agent_rankings",
    label: "Admin: Ranking de agentes",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const rankings = await b44.asServiceRole.entities.AgentRanking.list("-score", 10);
      return `${rankings.length} agentes no ranking`;
    },
  },
  {
    key: "admin_training_progress",
    label: "Admin: Progresso de treinamentos",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const progress = await b44.asServiceRole.entities.TrainingProgress.list("-created_date", 20);
      const passed = progress.filter((p) => p.status === "passed").length;
      return `${progress.length} registros, ${passed} aprovados`;
    },
  },
  {
    key: "admin_system_logs",
    label: "Admin: Logs do sistema",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const logs = await b44.asServiceRole.entities.SystemLog.list("-created_date", 10);
      return `${logs.length} logs recentes`;
    },
  },
  {
    key: "admin_maintenance_tickets",
    label: "Admin: Tickets de manutenção",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const tickets = await b44.asServiceRole.entities.MaintenanceTicket.filter({ status: "open" }, "-created_date", 20);
      return `${tickets.length} tickets abertos`;
    },
  },
  {
    key: "admin_psych_appointments",
    label: "Admin: Consultas psicológicas agendadas",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const apts = await b44.asServiceRole.entities.PsychAppointment.filter({ status: "scheduled" }, "-scheduled_at", 10);
      return `${apts.length} consultas agendadas`;
    },
  },
  {
    key: "admin_cameras",
    label: "Admin: Câmeras registradas",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const cameras = await b44.asServiceRole.entities.Camera.list("-created_date", 20);
      return `${cameras.length} câmeras cadastradas`;
    },
  },
  {
    key: "admin_certificates",
    label: "Admin: Certificados emitidos",
    profile: "admin",
    critical: false,
    fn: async (b44) => {
      const certs = await b44.asServiceRole.entities.CertificateRecord.list("-issued_at", 10);
      return `${certs.length} certificados registrados`;
    },
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const trigger = body?.trigger || "manual";

    const runId = `run_${Date.now()}`;
    const runStartedAt = new Date().toISOString();
    const runDate = new Date().toISOString().split("T")[0];

    const results = [];

    for (const flow of FLOWS) {
      const t0 = Date.now();
      let status = "success";
      let errorMessage = null;
      let errorPayload = null;
      let detail = null;

      try {
        detail = await flow.fn(base44);
      } catch (err) {
        status = "error";
        errorMessage = err.message || String(err);
        errorPayload = JSON.stringify({ stack: err.stack, message: err.message });
      }

      const latency = Date.now() - t0;

      const logEntry = {
        run_id: runId,
        trigger,
        profile: flow.profile,
        flow_key: flow.key,
        flow_label: flow.label,
        status,
        latency_ms: latency,
        error_message: errorMessage,
        error_payload: errorPayload,
        is_critical: status === "error" && flow.critical,
        run_date: runDate,
        run_started_at: runStartedAt,
      };

      await base44.asServiceRole.entities.SystemHealthLog.create(logEntry);
      results.push({ ...logEntry, detail });
    }

    const summary = {
      run_id: runId,
      trigger,
      total: results.length,
      success: results.filter((r) => r.status === "success").length,
      errors: results.filter((r) => r.status === "error").length,
      critical_errors: results.filter((r) => r.is_critical).length,
      run_started_at: runStartedAt,
      results,
    };

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});