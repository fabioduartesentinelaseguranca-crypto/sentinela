/**
 * POST runFunctionTests
 *
 * Executa testes automatizados (smoke/unitários) para TODAS as funções de backend
 * do sistema. Cada teste invoca a função com um payload cuidadosamente escolhido:
 *   - Para funções com efeitos colaterais (criar registros, enviar email, LLM):
 *     payload INVÁLIDO que dispara validação precoce (HTTP 400) → prova que a função
 *     está deployada, acessível e validando corretamente, SEM efeitos colaterais.
 *   - Para funções somente-leitura: payload válido e asserção do shape da resposta.
 *   - Funções de infraestrutura de teste (runSystemHealthCheck, cronSystemHealthCheck,
 *     simulacaoEstresseQA) são PULADAS para evitar recursão/poluição de dados.
 *
 * Resultados (status, latência, erros, payloads) são gravados em SystemHealthLog
 * com profile="system" e flow_key prefixado "fn_", exibidos no dashboard de Saúde.
 *
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Embedding sintético 128-dim para testes de biometria (read-only)
const SAMPLE_EMB = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.17) * 0.5);

const TESTS = [
  { key: "fn_verificarConflitoBiometria", label: "verificarConflitoBiometria — verificação de conflito facial", critical: true, category: "biometria",
    payload: { embedding: SAMPLE_EMB, escopos: ["alunos", "blacklist", "procurados"] },
    expect: (d) => d && d.conflict !== undefined },

  { key: "fn_verificarCheckpoint", label: "verificarCheckpoint — pipeline de checkpoint (validação)", critical: true, category: "biometria",
    payload: { module: "escolar" }, expectStatus: 400 },

  { key: "fn_verificarBiometria", label: "verificarBiometria — reconhecimento facial (validação)", critical: false, category: "biometria",
    payload: {}, expectStatus: 400 },

  { key: "fn_despacharAgenteProximo", label: "despacharAgenteProximo — dispatcher Haversine (validação)", critical: true, category: "despacho",
    payload: {}, expectStatus: 400 },

  { key: "fn_alertarAgentesProcurado", label: "alertarAgentesProcurado — alerta vermelho (validação)", critical: false, category: "despacho",
    payload: {}, expectStatus: 400 },

  { key: "fn_triagemOcorrencia", label: "triagemOcorrencia — triagem IA (validação)", critical: true, category: "ocorrencias",
    payload: {}, expectStatus: 400 },

  { key: "fn_calcularRotaSegura", label: "calcularRotaSegura — rotas seguras (validação)", critical: false, category: "cidadao",
    payload: {}, expectStatus: 400 },

  { key: "fn_verificarCercasGeograficas", label: "verificarCercasGeograficas — geofence (validação)", critical: false, category: "defesa_civil",
    payload: {}, expectStatus: 400 },

  { key: "fn_dispararGeofenceUsuarios", label: "dispararGeofenceUsuarios — varredura de cercas", critical: false, category: "defesa_civil",
    payload: {}, expect: (d) => d && d.status === "ok" },

  { key: "fn_notificarNovoResponsavel", label: "notificarNovoResponsavel — notificação (validação)", critical: false, category: "escolar",
    payload: {}, expectStatus: 400 },

  { key: "fn_gerarBoletimOcorrencia", label: "gerarBoletimOcorrencia — BO jurídico IA (validação)", critical: false, category: "documentos",
    payload: {}, expectStatus: 400 },

  { key: "fn_gerarAnalisePreditiva", label: "gerarAnalisePreditiva — análise preditiva (sem dados)", critical: false, category: "inteligencia",
    // periodo_dias=-1 → janela impossível → 0 ocorrências → retorna "sem_dados" sem LLM/escrita
    payload: { periodo_dias: -1 }, expect: (d) => d && d.status === "sem_dados" },

  { key: "fn_gerarDocumentacaoPDF", label: "gerarDocumentacaoPDF — documentação técnica PDF", critical: false, category: "documentos",
    payload: {}, expectPdf: true },

  { key: "fn_obterMidiaCriptografada", label: "obterMidiaCriptografada — mídia criptografada (validação)", critical: false, category: "midia",
    payload: {}, expectStatus: 400 },

  { key: "fn_processarFrameExterno", label: "processarFrameExterno — API câmeras externas (auth)", critical: false, category: "visao",
    payload: {}, expectStatus: 401 },

  { key: "fn_processarFramePortao", label: "processarFramePortao — motor portão escolar (validação)", critical: false, category: "escolar",
    payload: {}, expectStatus: 400 },

  { key: "fn_simulacaoEstresseQA", label: "simulacaoEstresseQA — simulação de estresse", critical: false, category: "qa",
    skipped: true, skipReason: "Cria ocorrências sintéticas + consome LLM — pulado para evitar poluição de dados de produção" },

  { key: "fn_runSystemHealthCheck", label: "runSystemHealthCheck — checklist E2E", critical: true, category: "infra",
    skipped: true, skipReason: "Função de infraestrutura de testes — execução recursiva evitada para não poluir logs de saúde" },

  { key: "fn_cronSystemHealthCheck", label: "cronSystemHealthCheck — cron de saúde", critical: false, category: "infra",
    skipped: true, skipReason: "Função de infraestrutura de testes — evita poluição de logs de saúde" },
];

async function invokeForTest(base44, name, payload, expectPdf) {
  try {
    const res = await base44.functions.invoke(name, payload);
    // Para PDF, descartar o corpo binário (não serializar)
    const data = expectPdf ? "[PDF binário]" : res.data;
    return { ok: true, status: res.status || 200, data };
  } catch (err) {
    const status = err?.response?.status || err?.status || 0;
    let data = err?.response?.data || err?.data || null;
    if (data && expectPdf) data = "[PDF binário]";
    return { ok: false, status, data, message: err?.message || String(err) };
  }
}

function classify(test, result) {
  if (test.skipped) return { status: "warning", detail: test.skipReason };
  const { ok, status, data, message } = result;

  if (test.expectPdf) {
    if (ok && status === 200) return { status: "success", detail: "PDF gerado com sucesso (binário)" };
    return { status: "error", detail: `Esperado HTTP 200, recebido ${status}${message ? ` — ${message}` : ""}` };
  }
  if (test.expectStatus) {
    if (status === test.expectStatus) return { status: "success", detail: `Validação OK — rejeitou entrada inválida (HTTP ${status})` };
    return { status: "error", detail: `Esperado HTTP ${test.expectStatus}, recebido ${status}${message ? ` — ${message}` : ""}` };
  }
  if (test.expect) {
    if (ok && test.expect(data)) return { status: "success", detail: `Resposta válida — ${JSON.stringify(data).slice(0, 140)}` };
    return { status: "error", detail: `Resposta inesperada — ${message || JSON.stringify(data || {}).slice(0, 140)}` };
  }
  if (ok && status >= 200 && status < 300) return { status: "success", detail: `OK (HTTP ${status})` };
  return { status: "error", detail: `Esperado 2xx, recebido ${status}${message ? ` — ${message}` : ""}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });

    const runId = `fntest_${Date.now()}`;
    const runStartedAt = new Date().toISOString();
    const runDate = new Date().toISOString().split("T")[0];
    const results = [];

    for (const test of TESTS) {
      const t0 = Date.now();
      let result = { ok: false, status: 0, data: null, message: "" };
      if (!test.skipped) {
        result = await invokeForTest(base44, test.key.replace(/^fn_/, ""), test.payload, test.expectPdf);
      }
      const cls = classify(test, result);
      const latency = Date.now() - t0;
      const isError = cls.status === "error";

      const logEntry = {
        run_id: runId,
        trigger: "manual",
        profile: "system",
        flow_key: test.key,
        flow_label: test.label,
        status: cls.status,
        latency_ms: latency,
        error_message: isError ? cls.detail : (test.skipped ? null : null),
        error_payload: isError ? JSON.stringify({ category: test.category, http_status: result.status, response: result.data, message: result.message }).slice(0, 1000) : null,
        is_critical: isError && test.critical,
        run_date: runDate,
        run_started_at: runStartedAt,
      };
      await base44.asServiceRole.entities.SystemHealthLog.create(logEntry);
      results.push({ ...logEntry, category: test.category, detail: cls.detail, critical: test.critical });
    }

    const total = results.length;
    const success = results.filter((r) => r.status === "success").length;
    const errors = results.filter((r) => r.status === "error").length;
    const skipped = results.filter((r) => r.status === "warning").length;
    const criticalErrors = results.filter((r) => r.is_critical).length;

    return Response.json({
      run_id: runId, run_started_at: runStartedAt,
      total, success, errors, skipped, critical_errors: criticalErrors,
      health_pct: total > 0 ? Math.round((success / total) * 100) : 0,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});