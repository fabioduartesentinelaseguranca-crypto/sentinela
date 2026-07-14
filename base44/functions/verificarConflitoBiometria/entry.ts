/**
 * POST verificarConflitoBiometria
 *
 * Previne cadastros com embeddings sobrepostos (falsos positivos futuros).
 * Recebe um descriptor 128-dim gerado localmente (face-api.js) e compara contra
 * TODOS os embeddings existentes nos escopos solicitados.
 *
 * Regra (spec): conflito se similaridade > 75% (equiv. distância euclidiana < 0.45)
 * com uma PESSOA DIFERENTE já cadastrada.
 *
 * Payload: { embedding: number[128], escopos: ["alunos","blacklist","procurados"] }
 * Resposta: { conflict: boolean, similarity, matched_name?, matched_id?, scope? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function cosineSimPct(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  if (!nA || !nB) return 0;
  return Math.round(((dot / (Math.sqrt(nA) * Math.sqrt(nB))) + 1) / 2 * 100);
}

function isEmbeddingValid(arr) {
  return Array.isArray(arr) && arr.length >= 32 && arr.some((v) => Math.abs(v) > 0.001);
}

const CONFLICT_SIM = 75; // > 75% => estrutura facial muito similar a outro cadastro

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
    const { embedding, escopos = ["alunos", "blacklist", "procurados"] } = body;
    if (!isEmbeddingValid(embedding)) return Response.json({ error: "embedding 128-dim obrigatório" }, { status: 400 });

    let best = { similarity: 0, matched_name: null, matched_id: null, scope: null };

    if (escopos.includes("alunos")) {
      const alunos = await base44.asServiceRole.entities.Alunos_Biometria.list();
      for (const a of alunos) {
        for (const emb of [a.face_embedding, a.face_embedding_oculos]) {
          if (!isEmbeddingValid(emb)) continue;
          const s = cosineSimPct(embedding, emb);
          if (s > best.similarity) best = { similarity: s, matched_name: a.nome, matched_id: a.id, scope: "alunos" };
        }
      }
    }

    if (escopos.includes("blacklist")) {
      const bl = await base44.asServiceRole.entities.Blacklist_Biometrica.filter({ ativo: true });
      for (const b of bl) {
        if (!isEmbeddingValid(b.face_embedding)) continue;
        const s = cosineSimPct(embedding, b.face_embedding);
        if (s > best.similarity) best = { similarity: s, matched_name: b.nome_suspeito || "Suspeito (blacklist)", matched_id: b.id, scope: "blacklist" };
      }
    }

    if (escopos.includes("procurados")) {
      const wanted = await base44.asServiceRole.entities.WantedCriminal.filter({ status: "wanted" });
      for (const w of wanted) {
        if (!isEmbeddingValid(w.face_embedding)) continue;
        const s = cosineSimPct(embedding, w.face_embedding);
        if (s > best.similarity) best = { similarity: s, matched_name: w.name || w.alias || "Procurado", matched_id: w.id, scope: "procurados" };
      }
    }

    const conflict = best.similarity > CONFLICT_SIM;
    return Response.json({
      conflict,
      similarity: best.similarity,
      threshold: CONFLICT_SIM,
      matched_name: best.matched_name,
      matched_id: best.matched_id,
      scope: best.scope,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});