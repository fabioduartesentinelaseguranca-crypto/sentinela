/**
 * POST verificarCheckpoint
 * Recebe do front-end um descriptor facial 128-dim gerado LOCALMENTE (face-api.js)
 * e o snapshot_url. Compara contra Students + Wanted_Persons (mesmo espaço vetorial)
 * e cria Access_Log. PULA a extração via GPT-4o Vision quando o descriptor é fornecido.
 *
 * Payload: { embedding: number[128], snapshot_url, camera_id }
 *           OU (fallback) { file_url } → extração via GPT-4o Vision.
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

function isWithinSchedule(nowHhMm, checkin, checkout) {
  if (!checkin || !checkout) return true;
  return nowHhMm >= checkin && nowHhMm <= checkout;
}

function isLocalDescriptorValid(arr) {
  return Array.isArray(arr) && arr.length === 128 && arr.some((v) => Math.abs(v) > 0.001);
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
    const { file_url, embedding: clientEmbedding, snapshot_url, camera_id = "CHECKPOINT-01" } = body;

    let embedding, snapshot, quality;

    // ── Caminho rápido: descriptor LOCAL (face-api.js) ────────────
    if (isLocalDescriptorValid(clientEmbedding)) {
      embedding = clientEmbedding;
      snapshot = snapshot_url || file_url || null;
      quality = null;
    } else {
      // ── Fallback: extração via GPT-4o Vision ────────────────────
      if (!file_url) return Response.json({ error: "embedding ou file_url obrigatório" }, { status: 400 });
      const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: "gpt_5_4",
        prompt: `Analise esta foto de rosto (crop do checkpoint de segurança) e retorne JSON:
- face_detected (boolean): há um rosto humano visível?
- is_real_face (boolean): parece rosto real (não foto/tela/spoofing)?
- quality_score (number 0-100)
- embedding (array de 128 números entre -1 e 1): vetor facial. Sem rosto → 128 zeros.`,
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
        return Response.json({ classification: "No Face", face_detected: false, message: "Nenhum rosto detectado no crop" });
      }
      if (!resultado.is_real_face) {
        const nowIso = new Date().toISOString();
        await base44.asServiceRole.entities.Access_Logs.create({
          timestamp: nowIso, snapshot_url: file_url,
          classification: "Unauthorized Intruder",
          action_taken: "Possível spoofing/tentativa de fraude detectada. Snapshot capturado.",
          camera_id,
        });
        return Response.json({ classification: "Unauthorized Intruder", face_detected: true, spoofing_detected: true, snapshot_url: file_url, message: "Possível spoofing" });
      }
      embedding = resultado.embedding || [];
      snapshot = file_url;
      quality = resultado.quality_score;

      if (!isLocalDescriptorValid(embedding)) {
        return Response.json({ classification: "No Face", face_detected: false, message: "Embedding inválido" });
      }
    }

    const WANTED_THRESHOLD = 72;
    const STUDENT_THRESHOLD = 72;
    const nowIso = new Date().toISOString();
    const nowHhMm = brasiliaHhMm();

    // ── Comparar contra Wanted_Persons (prioridade) ───────────────
    const wanted = await base44.asServiceRole.entities.Wanted_Persons.filter({});
    let wantedMatch = null, wantedSim = 0;
    for (const w of wanted) {
      if (!Array.isArray(w.face_embedding) || w.face_embedding.length < 32) continue;
      const sim = cosineSim(embedding, w.face_embedding);
      if (sim > wantedSim) { wantedSim = sim; wantedMatch = w; }
    }

    // ── Comparar contra Students ─────────────────────────────────
    const students = await base44.asServiceRole.entities.Students.filter({});
    let studentMatch = null, studentSim = 0;
    for (const s of students) {
      if (!Array.isArray(s.face_embedding) || s.face_embedding.length < 32) continue;
      const sim = cosineSim(embedding, s.face_embedding);
      if (sim > studentSim) { studentSim = sim; studentMatch = s; }
    }

    // ── Prioridade 1: Procurado ──────────────────────────────────
    if (wantedMatch && wantedSim >= WANTED_THRESHOLD && wantedSim >= studentSim) {
      await base44.asServiceRole.entities.Access_Logs.create({
        timestamp: nowIso, snapshot_url: snapshot,
        classification: "Wanted Suspect",
        action_taken: `ALERTA CRÍTICO disparado. Procurado: ${wantedMatch.alias}. Sirene ativada.`,
        person_name: wantedMatch.alias, person_id: wantedMatch.id,
        similarity: wantedSim, camera_id,
      });
      return Response.json({
        classification: "Wanted Suspect", face_detected: true, source: "local",
        person_name: wantedMatch.alias, person_id: wantedMatch.id,
        similarity: wantedSim, threat_level: wantedMatch.threat_level,
        notes: wantedMatch.notes, snapshot_url: snapshot, quality_score: quality,
      });
    }

    // ── Prioridade 2: Aluno ─────────────────────────────────────
    if (studentMatch && studentSim >= STUDENT_THRESHOLD) {
      const within = isWithinSchedule(nowHhMm, studentMatch.allowed_checkin_time, studentMatch.allowed_checkout_time);
      if (within) {
        const newStatus = studentMatch.status === "inside" ? "outside" : "inside";
        await base44.asServiceRole.entities.Students.update(studentMatch.id, { status: newStatus });
        await base44.asServiceRole.entities.Access_Logs.create({
          timestamp: nowIso, snapshot_url: snapshot,
          classification: "Allowed Student",
          action_taken: `Status atualizado para ${newStatus}.`,
          person_name: studentMatch.name, person_id: studentMatch.id,
          similarity: studentSim, camera_id,
        });
        return Response.json({
          classification: "Allowed Student", face_detected: true, source: "local",
          person_name: studentMatch.name, person_id: studentMatch.id,
          similarity: studentSim, new_status: newStatus, snapshot_url: snapshot, quality_score: quality,
        });
      } else {
        await base44.asServiceRole.entities.Access_Logs.create({
          timestamp: nowIso, snapshot_url: snapshot,
          classification: "Student Evasion Attempt",
          action_taken: `Tentativa fora do horário permitido (${studentMatch.allowed_checkin_time}-${studentMatch.allowed_checkout_time}).`,
          person_name: studentMatch.name, person_id: studentMatch.id,
          similarity: studentSim, camera_id,
        });
        return Response.json({
          classification: "Student Evasion Attempt", face_detected: true, source: "local",
          person_name: studentMatch.name, person_id: studentMatch.id,
          similarity: studentSim,
          allowed_checkin_time: studentMatch.allowed_checkin_time,
          allowed_checkout_time: studentMatch.allowed_checkout_time,
          snapshot_url: snapshot, quality_score: quality,
        });
      }
    }

    // ── Prioridade 3: Intruso não autorizado ────────────────────
    await base44.asServiceRole.entities.Access_Logs.create({
      timestamp: nowIso, snapshot_url: snapshot,
      classification: "Unauthorized Intruder",
      action_taken: "Indivíduo não identificado. Snapshot capturado para registro.",
      similarity: Math.max(wantedSim, studentSim), camera_id,
    });
    return Response.json({
      classification: "Unauthorized Intruder", face_detected: true, source: "local",
      similarity: Math.max(wantedSim, studentSim),
      snapshot_url: snapshot, quality_score: quality,
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});