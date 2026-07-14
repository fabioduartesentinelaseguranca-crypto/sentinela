/**
 * POST despacharAgenteProximo
 *
 * Dispatcher geolocalizado de resposta tática. Acionado quando o checkpoint
 * detecta um "Unauthorized Intruder" (contexto escolar) ou "Wanted Suspect"
 * (contexto justice/procurados).
 *
 * 1. Resolve as coordenadas GPS da câmera (Camera table) que gerou o evento.
 * 2. Consulta Agentes_Seguranca ativos (status != fora_servico) com lat/lng.
 * 3. Calcula a distância de cada agente até a câmera pela Fórmula de Haversine.
 * 4. Persiste um Alertas_Intrusao_Escolar com o agente mais próximo designado.
 * 5. Envia um payload em tempo real (email para a central de despacho / admins)
 *    contendo: tipo do evento, data/hora, nome + GPS da câmera + link do mapa,
 *    crop facial do indivíduo e dados do agente designado.
 *
 * Payload:
 *  { event_type: "Intruder Detection" | "Wanted Person Identified",
 *    camera_id, camera_name?, camera_lat?, camera_lng?,
 *    snapshot_url, person_name?, similarity?, module, danger_level?, crimes? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const EARTH_R_M = 6371000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_R_M * Math.asin(Math.sqrt(a)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { /* dispatcher interno */ }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const {
      event_type = "Intruder Detection", module = "escolar",
      camera_id, camera_name, camera_lat, camera_lng,
      snapshot_url, person_name, similarity, danger_level, crimes,
    } = body;

    if (!camera_id) return Response.json({ error: "camera_id é obrigatório" }, { status: 400 });

    // 1. Resolve câmera (GPS)
    let camLat = camera_lat, camLng = camera_lng, camName = camera_name || camera_id;
    if (camLat == null || camLng == null || !camera_name) {
      try {
        const cam = await base44.asServiceRole.entities.Camera.get(camera_id);
        if (cam) {
          if (camLat == null) camLat = cam.lat;
          if (camLng == null) camLng = cam.lng;
          if (!camera_name) camName = [cam.name, cam.zone].filter(Boolean).join(" · ");
        }
      } catch { /* camera_id pode ser um identificador livre */ }
    }

    // 2. Agentes ativos
    const agentes = await base44.asServiceRole.entities.Agentes_Seguranca.list();
    const ativos = agentes.filter((a) =>
      a.status !== "fora_servico" && typeof a.lat === "number" && typeof a.lng === "number"
    );

    // 3. Haversine → ranking por proximidade
    const ranked = ativos
      .map((a) => ({ ...a, distancia_m: haversineMeters(camLat, camLng, a.lat, a.lng) }))
      .sort((a, b) => a.distancia_m - b.distancia_m);

    const closest = ranked[0] || null;
    const topN = ranked.slice(0, 3);

    // 4. Persiste alerta em tempo real
    const isWanted = event_type === "Wanted Person Identified";
    const alerta = await base44.asServiceRole.entities.Alertas_Intrusao_Escolar.create({
      tipo_alerta: isWanted ? "procurado_identificado" : "intruso_identificado",
      nivel: "vermelho",
      module,
      descricao: `${event_type}${person_name ? ` — ${person_name}` : ""}. Similaridade ${similarity ?? 0}%. Agente designado: ${closest?.nome || "nenhum disponível"}${closest ? ` (${closest.distancia_m} m)` : ""}.`,
      foto_captura_url: snapshot_url || null,
      similaridade_blacklist: similarity ?? null,
      camera_id, camera_name: camName, camera_lat: camLat, camera_lng: camLng,
      horario_tentativa: new Date().toISOString(),
      agente_designado_id: closest?.id || null,
      agente_designado_nome: closest?.nome || null,
      agente_designado_distancia_m: closest?.distancia_m ?? null,
      dispatched_at: new Date().toISOString(),
      status: "ativo",
    });

    // 5. Notifica a central de despacho (admins)
    const mapLink = (camLat != null && camLng != null)
      ? `https://www.google.com/maps?q=${camLat},${camLng}`
      : null;
    const hora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const agentesTxt = topN.length
      ? topN.map((a, i) => `${i + 1}. ${a.nome} — ${a.distancia_m} m${a.veiculo ? ` · ${a.veiculo}` : ""}${a.telefone ? ` · ${a.telefone}` : ""}`).join("<br/>")
      : "Nenhum agente ativo com localização disponível.";
    const crimesStr = Array.isArray(crimes) ? crimes.join(", ") : (crimes || "Não informado");

    const html = `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;background:#0f0f0f;color:#e5e5e5;border-radius:12px;overflow:hidden;">
        <div style="background:${isWanted ? "#dc2626" : "#d97706"};padding:20px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:22px;">🚨 DESPACHO TÁTICO — ${event_type.toUpperCase()}</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">${hora} · Módulo ${module}</p>
        </div>
        <div style="padding:20px;">
          <div style="background:#1f1f1f;border:2px solid ${isWanted ? "#dc2626" : "#d97706"};border-radius:8px;padding:14px;margin-bottom:14px;">
            ${person_name ? `<p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Indivíduo:</strong> ${person_name}</p>` : ""}
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Similaridade:</strong> ${similarity ?? 0}%</p>
            ${isWanted && danger_level ? `<p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Periculosidade:</strong> ${danger_level}</p>` : ""}
            ${isWanted ? `<p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Crimes:</strong> ${crimesStr}</p>` : ""}
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Câmera:</strong> ${camName}</p>
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">GPS:</strong> ${camLat ?? "—"}, ${camLng ?? "—"}</p>
            ${mapLink ? `<p style="margin:4px 0;"><a href="${mapLink}" style="color:#60a5fa;">📍 Ver no mapa</a></p>` : ""}
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Alerta ID:</strong> ${alerta.id}</p>
          </div>
          ${snapshot_url ? `<div style="text-align:center;margin-bottom:14px;"><img src="${snapshot_url}" style="max-width:100%;border-radius:8px;border:2px solid #374151;" /></div>` : ""}
          <div style="background:#111827;border-radius:8px;padding:14px;">
            <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;font-weight:bold;">AGENTES DESIGNADOS (Haversine — mais próximos):</p>
            <div style="color:#e5e5e5;font-size:13px;">${agentesTxt}</div>
          </div>
        </div>
        <div style="padding:12px;text-align:center;border-top:1px solid #374151;">
          <p style="color:#6b7280;font-size:11px;margin:0;">Sentinela — Despacho Tático Geolocalizado · gerado automaticamente</p>
        </div>
      </div>`;

    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
    let enviados = 0;
    for (const adm of admins) {
      if (!adm.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: adm.email,
          from_name: "Sentinela — Despacho Tático",
          subject: `🚨 ${event_type} — Câmera ${camName}${closest ? ` · Agente ${closest.nome} (${closest.distancia_m}m)` : ""}`,
          body: html,
        });
        enviados++;
      } catch { /* não bloquear por email individual */ }
    }

    // Payload push (para gateway FCM/APNs futuro) — carrega push_tokens dos agentes top
    const pushPayload = topN.map((a) => ({
      token: a.push_token || null,
      agent_id: a.id,
      agent_name: a.nome,
      distancia_m: a.distancia_m,
      event_type,
      camera_name: camName,
      camera_lat: camLat,
      camera_lng: camLng,
      map_link: mapLink,
      snapshot_url: snapshot_url || null,
      person_name: person_name || null,
      similarity: similarity ?? null,
      alert_id: alerta.id,
      timestamp: new Date().toISOString(),
    }));

    return Response.json({
      alert_id: alerta.id,
      dispatched: enviados,
      closest_agent: closest ? { id: closest.id, nome: closest.nome, distancia_m: closest.distancia_m, veiculo: closest.veiculo } : null,
      ranked_agents: topN.map((a) => ({ id: a.id, nome: a.nome, distancia_m: a.distancia_m })),
      push_payload: pushPayload,
      camera: { id: camera_id, name: camName, lat: camLat, lng: camLng },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});