/**
 * CONTRATO DE API — POST /api/v1/process-frame
 *
 * Endpoint chamado pelo servidor Python externo (FaceNet/InsightFace) sempre
 * que um rosto é detectado em câmera de rua ou escolar.
 *
 * AUTENTICAÇÃO: Bearer Token no header Authorization
 *   Authorization: Bearer <PYTHON_VISION_TOKEN>
 *
 * PAYLOAD (JSON):
 * {
 *   "camera_id":     "CAM_RUA_01",           // ID da câmera de origem
 *   "timestamp":     "2026-06-30T14:23:00Z", // ISO-8601
 *   "frame_base64":  "<base64 do crop>",     // rosto recortado em JPEG/PNG (opcional)
 *   "face_embedding": [0.12, -0.34, ...]     // vetor FaceNet — 128 ou 512 dims
 * }
 *
 * RESPOSTA:
 *   { matched: false }
 *   { matched: true, criminal_id, criminal_name, similarity, nivel, alert_id }
 *
 * PARA PRODUÇÃO — configure o secret via painel:
 *   Settings -> Environment Variables -> PYTHON_VISION_TOKEN
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const EXPECTED_TOKEN = Deno.env.get("PYTHON_VISION_TOKEN") || "SUBSTITUA_PELO_TOKEN_REAL";
const DEFAULT_THRESHOLD = 80;

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.round(((dot / (Math.sqrt(normA) * Math.sqrt(normB))) + 1) / 2 * 100);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // 1. Autenticacao por Bearer Token
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token !== EXPECTED_TOKEN) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse e validacao do payload
    let body;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { camera_id, timestamp, frame_base64, face_embedding } = body;

    if (!camera_id || !timestamp || !face_embedding) {
      return Response.json({ error: "Campos obrigatorios: camera_id, timestamp, face_embedding" }, { status: 400 });
    }
    if (!Array.isArray(face_embedding) || face_embedding.length < 32) {
      return Response.json({ error: "face_embedding deve ser array numerico com minimo 32 dimensoes" }, { status: 400 });
    }

    // 3. Carregar procurados via service role
    const base44 = createClientFromRequest(req);
    const criminosos = await base44.asServiceRole.entities.WantedCriminal.filter({ status: "wanted" });
    const comEmbedding = criminosos.filter(c =>
      Array.isArray(c.face_embedding) && c.face_embedding.length >= 32
    );

    if (comEmbedding.length === 0) {
      return Response.json({ matched: false, message: "Nenhum procurado com embedding cadastrado" });
    }

    // 4. Calculo de similaridade — melhor match
    let melhorMatch = null;
    let melhorSim = 0;
    for (const criminal of comEmbedding) {
      const sim = cosineSimilarity(face_embedding, criminal.face_embedding);
      if (sim > melhorSim) { melhorSim = sim; melhorMatch = criminal; }
    }

    const threshold = melhorMatch?.threshold_alerta ?? DEFAULT_THRESHOLD;

    if (melhorSim < threshold) {
      return Response.json({ matched: false, best_similarity: melhorSim, threshold });
    }

    // 5. Match positivo — upload do frame e criacao do alerta
    let frame_url = null;
    if (frame_base64) {
      try {
        const b64 = frame_base64.replace(/^data:[^;]+;base64,/, "");
        const byteString = atob(b64);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/jpeg" });
        const up = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        frame_url = up?.file_url || null;
      } catch { /* upload falhou — continua sem foto */ }
    }

    const nivelMap = { extreme: "vermelho", high: "vermelho", medium: "laranja", low: "amarelo" };
    const nivel = nivelMap[melhorMatch.danger_level] || "vermelho";

    const descricao = `PROCURADO IDENTIFICADO — camera ${camera_id}: ${melhorMatch.name}` +
      (melhorMatch.alias ? ` (${melhorMatch.alias})` : "") +
      ` — similaridade ${melhorSim}% (threshold: ${threshold}%)`;

    const alerta = await base44.asServiceRole.entities.Alertas_Intrusao_Escolar.create({
      tipo_alerta:            "blacklist_match",
      nivel,
      descricao,
      nome_escola:            `Camera ${camera_id}`,
      id_escola_cerca:        camera_id,
      horario_tentativa:      timestamp,
      similaridade_blacklist: melhorSim,
      id_blacklist_ref:       melhorMatch.id,
      foto_captura_url:       frame_url,
      status:                 "ativo",
      bloqueio_ativo:         nivel === "vermelho",
    });

    // 6. Disparar email para agentes em turno ativo (fire-and-forget)
    base44.asServiceRole.functions.invoke('alertarAgentesProcurado', {
      criminal_name:      melhorMatch.name,
      criminal_alias:     melhorMatch.alias || '',
      similarity:         melhorSim,
      camera_id,
      foto_capturada_url: frame_url,
      foto_referencia_url: melhorMatch.photo_url || '',
      danger_level:       melhorMatch.danger_level || 'high',
      crimes:             melhorMatch.crimes || [],
      alert_id:           alerta.id,
    }).catch(() => {}); // não bloquear a resposta se o envio falhar

    return Response.json({
      matched:       true,
      criminal_id:   melhorMatch.id,
      criminal_name: melhorMatch.name,
      similarity:    melhorSim,
      threshold,
      nivel,
      alert_id:      alerta.id,
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});