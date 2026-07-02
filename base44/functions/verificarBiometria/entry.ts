/**
 * POST /api/verificar-biometria
 * Recebe frame base64 ou file_url, extrai embedding via GPT-4o Vision
 * e compara com procurados e alunos cadastrados.
 *
 * Payload: { frame_base64?: string, file_url?: string, threshold?: number, camera_id?: string, modo?: "procurados" | "alunos" | "ambos" }
 * Resposta: { match: boolean, tipo?: "procurado"|"aluno", id?, nome?, similarity, face_detected, quality_score }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  if (!nA || !nB) return 0;
  return Math.round(((dot / (Math.sqrt(nA) * Math.sqrt(nB))) + 1) / 2 * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Auth
    let user = null;
    try { user = await base44.auth.me(); } catch { /* público via token */ }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { file_url: inputFileUrl, threshold = 78, camera_id = "MANUAL", modo = "ambos" } = body;

    if (!inputFileUrl) {
      return Response.json({ error: "Forneça file_url" }, { status: 400 });
    }

    // Usa file_url diretamente (o React faz upload antes de chamar esta função)
    const file_url = inputFileUrl;
    if (!file_url) {
      return Response.json({ error: "file_url é obrigatório" }, { status: 400 });
    }

    // GPT-4o Vision — extrai embedding + info do rosto
    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "gpt_5_4",
      prompt: `Você é um sistema de reconhecimento facial. Analise esta imagem e retorne JSON com:
- face_detected (boolean): há rosto humano visível?
- is_real_face (boolean): parece rosto real (não foto/tela/spoofing)?
- face_count (integer): quantos rostos detectados
- quality_score (number 0-100): qualidade da imagem para reconhecimento
- embedding (array de 128 números entre -1 e 1): vetor facial do rosto principal. Se não houver rosto, retorne array de 128 zeros.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          face_detected: { type: "boolean" },
          is_real_face: { type: "boolean" },
          face_count: { type: "integer" },
          quality_score: { type: "number" },
          embedding: { type: "array", items: { type: "number" } }
        }
      }
    });

    if (!resultado.face_detected) {
      return Response.json({ match: false, face_detected: false, quality_score: resultado.quality_score ?? 0, message: "Nenhum rosto detectado" });
    }
    if (!resultado.is_real_face) {
      return Response.json({ match: false, face_detected: true, quality_score: resultado.quality_score ?? 0, message: "Possível spoofing detectado — rosto não parece real" });
    }

    const embedding = resultado.embedding || [];
    let melhorMatch = null;
    let melhorSim = 0;
    let melhorTipo = null;

    // ── Comparar com PROCURADOS ──────────────────────────────────
    if (modo === "procurados" || modo === "ambos") {
      const procurados = await base44.asServiceRole.entities.WantedCriminal.filter({ status: "wanted" });
      for (const p of procurados) {
        if (!Array.isArray(p.face_embedding) || p.face_embedding.length < 32) continue;
        const sim = cosineSim(embedding, p.face_embedding);
        if (sim > melhorSim) { melhorSim = sim; melhorMatch = p; melhorTipo = "procurado"; }
      }
    }

    // ── Comparar com ALUNOS ──────────────────────────────────────
    if (modo === "alunos" || modo === "ambos") {
      const alunos = await base44.asServiceRole.entities.Alunos_Biometria.filter({ ativo: true });
      for (const a of alunos) {
        // embedding sem óculos
        if (Array.isArray(a.face_embedding) && a.face_embedding.length >= 32) {
          const sim = cosineSim(embedding, a.face_embedding);
          if (sim > melhorSim) { melhorSim = sim; melhorMatch = a; melhorTipo = "aluno"; }
        }
        // embedding com óculos (cadastro duplo)
        if (Array.isArray(a.face_embedding_oculos) && a.face_embedding_oculos.length >= 32) {
          const sim = cosineSim(embedding, a.face_embedding_oculos);
          if (sim > melhorSim) { melhorSim = sim; melhorMatch = a; melhorTipo = "aluno_oculos"; }
        }
      }
    }

    const limiar = melhorMatch?.threshold_alerta ?? threshold;

    if (melhorSim < limiar || !melhorMatch) {
      return Response.json({
        match: false,
        face_detected: true,
        quality_score: resultado.quality_score,
        best_similarity: melhorSim,
        threshold: limiar,
        embedding: embedding, // retorna para candidatos parciais no frontend
        message: "Nenhuma correspondência encontrada"
      });
    }

    // ── MATCH CONFIRMADO ─────────────────────────────────────────
    const tipo = melhorTipo?.startsWith("aluno") ? "aluno" : "procurado";
    const nome = melhorMatch.nome || melhorMatch.name || "Desconhecido";
    const foto = melhorMatch.foto_url || melhorMatch.photo_url || null;

    // Registrar alerta se for procurado
    if (tipo === "procurado") {
      await base44.asServiceRole.entities.Alertas_Intrusao_Escolar.create({
        tipo_alerta: "blacklist_match",
        nivel: melhorMatch.danger_level === "extreme" || melhorMatch.danger_level === "high" ? "vermelho" : "laranja",
        descricao: `PROCURADO IDENTIFICADO: ${nome}${melhorMatch.alias ? ` (${melhorMatch.alias})` : ""} — Confiança ${melhorSim}% · ${camera_id}`,
        id_escola_cerca: "",
        nome_escola: `Câmera ${camera_id}`,
        foto_captura_url: file_url,
        similaridade_blacklist: melhorSim,
        horario_tentativa: new Date().toISOString(),
        status: "ativo",
        bloqueio_ativo: melhorSim >= 90,
      });
    }

    return Response.json({
      match: true,
      tipo,
      id: melhorMatch.id,
      nome,
      foto_url: foto,
      similarity: melhorSim,
      threshold: limiar,
      face_detected: true,
      quality_score: resultado.quality_score,
      // Campos extras para procurados
      ...(tipo === "procurado" ? {
        alias: melhorMatch.alias,
        danger_level: melhorMatch.danger_level,
        crimes: melhorMatch.crimes,
        warrant_number: melhorMatch.warrant_number,
        reward: melhorMatch.reward,
      } : {}),
      // Campos extras para alunos
      ...(tipo === "aluno" ? {
        matricula: melhorMatch.matricula,
        turno: melhorMatch.turno,
        nome_escola: melhorMatch.nome_escola,
      } : {}),
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});