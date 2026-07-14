/**
 * POST verificarCheckpoint
 * Pipeline agnóstico por módulo. Recebe do front-end um descriptor facial
 * 128-dim gerado LOCALMENTE (face-api.js) + snapshot_url + module.
 *
 * module="escolar"   → compara contra Alunos_Biometria (c/ embedding duplo) + Blacklist_Biometrica
 * module="procurados" → compara contra WantedCriminal (status=wanted)
 *
 * Cria Access_Log em todos os casos. Pula GPT-4o Vision quando o descriptor é local.
 *
 * Payload: { module, embedding: number[128], snapshot_url, camera_id }
 *           OU (fallback) { module, file_url } → extração via GPT-4o Vision.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  if (!nA || !nB) return 0;
  return Math.round(((dot / (Math.sqrt(nA) * Math.sqrt(nB))) + 1) / 2 * 100);
}

function brasiliaHhMm() {
  const now = new Date();
  const b = new Date(now.getTime() - 3 * 60 * 60 * 1000); // Brasília = UTC-3
  return b.toISOString().slice(11, 16);
}

function toMin(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm;
}

function withinSchedule(nowHhMm, entrada, saida, tolMin = 0) {
  const now = toMin(nowHhMm), lo = toMin(entrada), hi = toMin(saida);
  if (now == null || lo == null || hi == null) return true;
  return now >= lo - (tolMin || 0) && now <= hi + (tolMin || 0);
}

function isEmbeddingValid(arr) {
  return Array.isArray(arr) && arr.length >= 32 && arr.some((v) => Math.abs(v) > 0.001);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { /* */ }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { module = "escolar", file_url, embedding: clientEmbedding, snapshot_url, camera_id = "CHECKPOINT-01" } = body;

    let embedding, snapshot, quality;

    // ── Caminho rápido: descriptor LOCAL (face-api.js) ────────────
    if (isEmbeddingValid(clientEmbedding)) {
      embedding = clientEmbedding;
      snapshot = snapshot_url || file_url || null;
      quality = null;
    } else {
      // ── Fallback: extração via GPT-4o Vision ────────────────────
      if (!file_url) return Response.json({ error: "embedding ou file_url obrigatório" }, { status: 400 });
      const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: "gpt_5_4",
        prompt: `Analise esta foto de rosto e retorne JSON: face_detected (bool), is_real_face (bool), quality_score (0-100), embedding (array 128 números -1..1). Sem rosto → 128 zeros.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            is_real_face: { type: "boolean" },
            quality_score: { type: "number" },
            embedding: { type: "array", items: { type: "number" } },
          },
        },
      });
      if (!resultado.face_detected) {
        return Response.json({ classification: "No Face", module, face_detected: false, message: "Nenhum rosto detectado" });
      }
      if (!resultado.is_real_face) {
        await base44.asServiceRole.entities.Access_Logs.create({
          timestamp: new Date().toISOString(), snapshot_url: file_url,
          classification: "Unauthorized Intruder",
          action_taken: "Possível spoofing/tentativa de fraude. Snapshot capturado.",
          camera_id,
        });
        return Response.json({ classification: "Unauthorized Intruder", module, face_detected: true, spoofing_detected: true, snapshot_url: file_url });
      }
      embedding = resultado.embedding || [];
      snapshot = file_url;
      quality = resultado.quality_score;
      if (!isEmbeddingValid(embedding)) {
        return Response.json({ classification: "No Face", module, face_detected: false, message: "Embedding inválido" });
      }
    }

    const nowIso = new Date().toISOString();
    const nowHhMm = brasiliaHhMm();
    const log = (classification, name, id, sim, action) =>
      base44.asServiceRole.entities.Access_Logs.create({
        timestamp: nowIso, snapshot_url: snapshot, classification, action_taken: action,
        person_name: name, person_id: id, similarity: sim, camera_id,
      });

    // ══════════════════════════════════════════════════════════════
    // MÓDULO PROCURADOS — base: WantedCriminal
    // ══════════════════════════════════════════════════════════════
    if (module === "procurados") {
      const WANTED_THRESHOLD = 72;
      const wanted = await base44.asServiceRole.entities.WantedCriminal.filter({ status: "wanted" });
      let wBest = null, wSim = 0;
      for (const w of wanted) {
        if (!isEmbeddingValid(w.face_embedding)) continue;
        const s = cosineSim(embedding, w.face_embedding);
        if (s > wSim) { wSim = s; wBest = w; }
      }
      if (wBest && wSim >= WANTED_THRESHOLD) {
        await log("Wanted Suspect", wBest.name || wBest.alias, wBest.id, wSim,
          `ALERTA CRÍTICO. Procurado: ${wBest.name || wBest.alias}. Nível: ${wBest.danger_level}. Recompensa: R$ ${wBest.reward || 0}.`);
        return Response.json({
          classification: "Wanted Suspect", module, face_detected: true, source: "local",
          person_name: wBest.name || wBest.alias, person_id: wBest.id,
          similarity: wSim, threat_level: wBest.danger_level,
          danger_level: wBest.danger_level, reward: wBest.reward, crimes: wBest.crimes,
          notes: wBest.description, snapshot_url: snapshot, quality_score: quality,
        });
      }
      await log("Unauthorized Intruder", null, null, wSim, "Indivíduo não identificado. Snapshot capturado.");
      return Response.json({
        classification: "Unauthorized Intruder", module, face_detected: true, source: "local",
        similarity: wSim, snapshot_url: snapshot, quality_score: quality,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // MÓDULO ESCOLAR — base: Blacklist_Biometrica (ameaça) + Alunos_Biometria
    // ══════════════════════════════════════════════════════════════
    // Prioridade 1: Blacklist (ameaça)
    const BL_THRESHOLD = 70;
    const blacklist = await base44.asServiceRole.entities.Blacklist_Biometrica.filter({ ativo: true });
    let blBest = null, blSim = 0;
    for (const b of blacklist) {
      if (!isEmbeddingValid(b.face_embedding)) continue;
      const s = cosineSim(embedding, b.face_embedding);
      if (s > blSim) { blSim = s; blBest = b; }
    }
    if (blBest && blSim >= BL_THRESHOLD) {
      await log("Wanted Suspect", blBest.nome_suspeito || "Suspeito", blBest.id, blSim,
        `Match BLACKLIST: ${blBest.descricao_risco}. Nível: ${blBest.nivel_alerta}.`);
      return Response.json({
        classification: "Wanted Suspect", module, face_detected: true, source: "local",
        person_name: blBest.nome_suspeito, person_id: blBest.id,
        similarity: blSim, threat_level: blBest.nivel_alerta,
        notes: blBest.descricao_risco, snapshot_url: snapshot, quality_score: quality,
      });
    }

    // Prioridade 2: Alunos_Biometria (embedding duplo se usa óculos)
    const AL_THRESHOLD = 72;
    const alunos = await base44.asServiceRole.entities.Alunos_Biometria.filter({ ativo: true });
    let alBest = null, alSim = 0;
    for (const a of alunos) {
      let best = isEmbeddingValid(a.face_embedding) ? cosineSim(embedding, a.face_embedding) : 0;
      if (a.usa_oculos && isEmbeddingValid(a.face_embedding_oculos)) {
        const s2 = cosineSim(embedding, a.face_embedding_oculos);
        if (s2 > best) best = s2;
      }
      if (best > alSim) { alSim = best; alBest = a; }
    }
    if (alBest && alSim >= AL_THRESHOLD) {
      const within = withinSchedule(nowHhMm, alBest.horario_entrada, alBest.horario_saida, alBest.tolerancia_minutos);
      if (within) {
        await log("Allowed Student", alBest.nome, alBest.id, alSim,
          `Aluno autorizado. Matrícula ${alBest.matricula}. Escola: ${alBest.nome_escola || "—"}.`);
        return Response.json({
          classification: "Allowed Student", module, face_detected: true, source: "local",
          person_name: alBest.nome, person_id: alBest.id,
          similarity: alSim, matricula: alBest.matricula,
          allowed_checkin_time: alBest.horario_entrada, allowed_checkout_time: alBest.horario_saida,
          snapshot_url: snapshot, quality_score: quality,
        });
      }
      await log("Student Evasion Attempt", alBest.nome, alBest.id, alSim,
        `Tentativa fora do horário permitido (${alBest.horario_entrada}-${alBest.horario_saida}, tol ${alBest.tolerancia_minutos || 0}min).`);
      return Response.json({
        classification: "Student Evasion Attempt", module, face_detected: true, source: "local",
        person_name: alBest.nome, person_id: alBest.id,
        similarity: alSim,
        allowed_checkin_time: alBest.horario_entrada, allowed_checkout_time: alBest.horario_saida,
        snapshot_url: snapshot, quality_score: quality,
      });
    }

    // Prioridade 3: Intruso
    const bestSim = Math.max(blSim, alSim);
    await log("Unauthorized Intruder", null, null, bestSim, "Indivíduo não identificado. Snapshot capturado.");
    return Response.json({
      classification: "Unauthorized Intruder", module, face_detected: true, source: "local",
      similarity: bestSim, snapshot_url: snapshot, quality_score: quality,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});