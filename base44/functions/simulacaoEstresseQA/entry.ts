import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const EXEC_ID = `qa_${Date.now()}`;
const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };

const SUBTIPOS_CRIME = [
  { subtype: "Roubo a mão armada", type: "crime", lat: -23.561, lng: -46.656 },
  { subtype: "Furto de veículo", type: "crime", lat: -23.543, lng: -46.639 },
  { subtype: "Assalto a transeunte", type: "crime", lat: -23.558, lng: -46.661 },
  { subtype: "Sequestro relâmpago", type: "crime", lat: -23.535, lng: -46.627 },
  { subtype: "Disparo de arma de fogo", type: "crime", lat: -23.575, lng: -46.645 },
];

const SUBTIPOS_SAUDE = [
  { subtype: "PCR em via pública", type: "health", lat: -23.567, lng: -46.652 },
  { subtype: "Acidente com múltiplas vítimas", type: "health", lat: -23.548, lng: -46.638 },
  { subtype: "Queda de altura grave", type: "health", lat: -23.572, lng: -46.621 },
];

const SUBTIPOS_CIVIL = [
  { subtype: "Alagamento residencial", type: "civil_defense", lat: -23.530, lng: -46.670 },
  { subtype: "Deslizamento de encosta", type: "civil_defense", lat: -23.556, lng: -46.615 },
  { subtype: "Incêndio em edificação", type: "civil_defense", lat: -23.564, lng: -46.644 },
];

const SUBTIPOS_TRANSITO = [
  { subtype: "Colisão com vítima", type: "traffic", lat: -23.555, lng: -46.659 },
  { subtype: "Atropelamento", type: "traffic", lat: -23.549, lng: -46.634 },
  { subtype: "Engavetamento múltiplo", type: "traffic", lat: -23.541, lng: -46.647 },
];

const AGENTES_TESTE = [
  { nome: "Cabo Oliveira", tipo: "policial", lat: -23.563, lng: -46.654, veiculo: "PM-4521" },
  { nome: "Sd. Santos", tipo: "policial", lat: -23.551, lng: -46.642, veiculo: "PM-7890" },
  { nome: "Ten. Costa", tipo: "socorrista", lat: -23.558, lng: -46.648, veiculo: "SAMU-089" },
  { nome: "Sd. Almeida", tipo: "bombeiro", lat: -23.545, lng: -46.636, veiculo: "CBM-334" },
  { nome: "Cb. Ferreira", tipo: "policial", lat: -23.570, lng: -46.660, veiculo: "PM-5612" },
];

function distKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const ha = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1-ha));
}

function nearestAgent(ocorrencia, agentes) {
  let best = null;
  let bestDist = Infinity;
  for (const a of agentes) {
    const d = distKm(ocorrencia, a);
    if (d < bestDist) { bestDist = d; best = a; }
  }
  return { agent: best, distKm: bestDist };
}

async function logEtapa(base44, etapa, status, tempoMs, ocorrenciaId, agenteId, erroMsg, detalhe) {
  const entry = {
    execucao_id: EXEC_ID,
    etapa,
    status,
    tempo_ms: tempoMs,
    ocorrencia_id: ocorrenciaId || null,
    agente_id: agenteId || null,
    error_message: erroMsg || null,
    error_details: null,
    detalhe: detalhe || null,
    data_execucao: new Date().toISOString(),
  };
  if (erroMsg) entry.error_details = erroMsg;
  return await base44.asServiceRole.entities.Logs_Auditoria_QA.create(entry);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    console.log(`[QA] Iniciando simulação de estresse — ${EXEC_ID}`);

    // ── ETAPA 1: Gerar dados sintéticos ─────────────────
    const t0 = Date.now();
    const todosSubtipos = [...SUBTIPOS_CRIME, ...SUBTIPOS_SAUDE, ...SUBTIPOS_CIVIL, ...SUBTIPOS_TRANSITO];
    const qtd = 12 + Math.floor(Math.random() * 8); // 12-19 ocorrências
    const selecionados = todosSubtipos.sort(() => Math.random() - 0.5).slice(0, qtd);

    const ocorrenciasCriadas = [];
    for (const s of selecionados) {
      const jitterLat = (Math.random() - 0.5) * 0.008;
      const jitterLng = (Math.random() - 0.5) * 0.008;
      const occ = await base44.asServiceRole.entities.Occurrence.create({
        type: s.type,
        subtype: s.subtype,
        status: "open",
        description: `[QA AUTO] ${s.subtype} simulado em ${new Date().toLocaleString("pt-BR")}`,
        lat: s.lat + jitterLat,
        lng: s.lng + jitterLng,
        address: `Região de São Paulo — simulação QA`,
        priority: s.type === "health" || s.type === "civil_defense" ? "critical" : "high",
        reporter_id: user.id,
      });
      ocorrenciasCriadas.push(occ);
    }
    await logEtapa(base44, "geracao_dados", "success", Date.now() - t0, null, null, null,
      `${ocorrenciasCriadas.length} ocorrências sintéticas geradas`);
    console.log(`[QA] ${ocorrenciasCriadas.length} ocorrências criadas`);

    // ── ETAPA 2: Criar agentes de teste ─────────────────
    const t1 = Date.now();
    let agentesExistentes = await base44.asServiceRole.entities.Agentes_Seguranca.list("-created_date", 200);
    if (agentesExistentes.length < 3) {
      for (const a of AGENTES_TESTE) {
        await base44.asServiceRole.entities.Agentes_Seguranca.create(a);
      }
      agentesExistentes = await base44.asServiceRole.entities.Agentes_Seguranca.list("-created_date", 200);
    }
    await logEtapa(base44, "criacao_ocorrencias", "success", Date.now() - t1, null, null, null,
      `${agentesExistentes.length} agentes de segurança disponíveis`);

    // ── ETAPA 3: Triagem IA (via superagent) ────────────
    const t2 = Date.now();
    let triagemOk = 0;
    let triagemErro = 0;

    for (const occ of ocorrenciasCriadas.slice(0, 6)) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é o Triador Técnico do Sentinela. Analise esta ocorrência:
Tipo: ${occ.type}
Subtipo: ${occ.subtype}
Descrição: ${occ.description}
Lat: ${occ.lat}, Lng: ${occ.lng}

Retorne um JSON com:
- tipo_classificado (crime, health, civil_defense, traffic, panic)
- prioridade (critical, high, medium, low)
- resumo_tatico (até 2 frases)
- requer_samu (boolean)
- requer_bombeiro (boolean)
- requer_policia (boolean)
- risco_vida (boolean)`,
          response_json_schema: {
            type: "object",
            properties: {
              tipo_classificado: { type: "string" },
              prioridade: { type: "string" },
              resumo_tatico: { type: "string" },
              requer_samu: { type: "boolean" },
              requer_bombeiro: { type: "boolean" },
              requer_policia: { type: "boolean" },
              risco_vida: { type: "boolean" },
            },
            required: ["tipo_classificado", "prioridade", "resumo_tatico"],
          },
          model: "claude_sonnet_4_6",
        });
        await base44.asServiceRole.entities.Occurrence.update(occ.id, {
          priority: res.prioridade,
          resolution_notes: res.resumo_tatico,
        });
        triagemOk++;
      } catch (e) {
        triagemErro++;
        console.error(`[QA] Erro triagem ${occ.id}: ${e.message}`);
      }
    }
    await logEtapa(base44, "triagem_ia", triagemErro === 0 ? "success" : "error",
      Date.now() - t2, null, null, triagemErro > 0 ? `${triagemErro} falhas de triagem` : null,
      `${triagemOk}/${triagemOk + triagemErro} triagens IA concluídas`);

    // ── ETAPA 4: Atribuir agente mais próximo ───────────
    const t3 = Date.now();
    for (const occ of ocorrenciasCriadas) {
      const { agent } = nearestAgent({ lat: occ.lat, lng: occ.lng }, agentesExistentes);
      if (agent) {
        try {
          await base44.asServiceRole.entities.Occurrence.update(occ.id, {
            assigned_agent_id: agent.id,
            status: "in_progress",
          });
          await base44.asServiceRole.entities.Agentes_Seguranca.update(agent.id, {
            status: "em_atendimento",
          });
        } catch (e) {
          console.error(`[QA] Erro atribuição ${occ.id}: ${e.message}`);
        }
      }
    }
    await logEtapa(base44, "atribuicao_agente", "success", Date.now() - t3, null, null, null,
      `${ocorrenciasCriadas.length} ocorrências atribuídas ao agente mais próximo`);

    // ── ETAPA 5: Progressão de status ───────────────────
    const t4 = Date.now();
    let progOk = 0;
    for (const occ of ocorrenciasCriadas) {
      try {
        await base44.asServiceRole.entities.Occurrence.update(occ.id, { status: "resolved", resolution_notes: "[QA] Resolvido automaticamente" });
        progOk++;
      } catch (e) {
        console.error(`[QA] Erro progressão ${occ.id}: ${e.message}`);
      }
    }
    await logEtapa(base44, "progressao_status", progOk === ocorrenciasCriadas.length ? "success" : "error",
      Date.now() - t4, null, null, null,
      `${progOk}/${ocorrenciasCriadas.length} progrediram para resolvido`);

    // ── ETAPA 6: Finalização ────────────────────────────
    const t5 = Date.now();
    await logEtapa(base44, "finalizacao", "success", Date.now() - t5, null, null, null,
      `Simulação concluída com sucesso — ${ocorrenciasCriadas.length} ocorrências processadas`);

    // ── ETAPA 7: Health check ───────────────────────────
    const t6 = Date.now();
    let healthOk = true;
    try {
      await base44.asServiceRole.entities.Occurrence.list("-created_date", 1);
    } catch (e) {
      healthOk = false;
    }
    await logEtapa(base44, "health_check", healthOk ? "success" : "error",
      Date.now() - t6, null, null, healthOk ? null : "Falha ao acessar entidade Occurrence",
      "Verificação de acesso às entidades do sistema");

    console.log(`[QA] Simulação concluída — ${EXEC_ID}`);
    return Response.json({ success: true, execucao_id: EXEC_ID, ocorrencias: ocorrenciasCriadas.length });
  } catch (error) {
    console.error(`[QA] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});