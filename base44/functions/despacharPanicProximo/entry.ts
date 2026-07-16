import { createClientFromRequest } from "npm:@base44/sdk@0.8.39";

// Distância Haversine em metros
function distanciaMetros(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Base64url
function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Minta um OAuth2 access token a partir da service account (RS256 via SubtleCrypto)
async function makeAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(encHeader + "." + encPayload);

  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signingInput);
  const assertion = encHeader + "." + encPayload + "." + b64url(new Uint8Array(sig));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + encodeURIComponent(assertion),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Falha ao obter access token FCM: " + JSON.stringify(data));
  return data.access_token;
}

async function sendFcmMulticast(projectId, sa, tokens, notification, data) {
  const accessToken = await makeAccessToken(sa);
  let successCount = 0;
  let failureCount = 0;
  await Promise.all(tokens.map(async (token) => {
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token, notification, data,
            android: { priority: "high" },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
      });
      if (res.ok) successCount++;
      else failureCount++;
    } catch { failureCount++; }
  }));
  return { successCount, failureCount };
}

const RAIO_M = 2000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Automação de entidade: payload traz event + data
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const ocorrencia = body?.data || null;
    const evento = body?.event || null;

    // Se veio de automação e NÃO é panic, ignora silenciosamente
    if (evento && ocorrencia && ocorrencia.type !== "panic") {
      return Response.json({ status: "skipped", motivo: "tipo != panic" });
    }

    // Validação de admin se chamada manual
    if (!evento) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (user.role !== "admin" && user.role !== "agent") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!ocorrencia || !ocorrencia.id) {
      return Response.json({ error: "Ocorrência não informada no payload" }, { status: 422 });
    }
    if (ocorrencia.type !== "panic") {
      return Response.json({ status: "skipped", motivo: "tipo != panic" });
    }
    const latNum = Number(ocorrencia.lat);
    const lngNum = Number(ocorrencia.lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return Response.json({ error: "Ocorrência sem coordenadas válidas" }, { status: 422 });
    }

    // Agentes disponíveis em raio de 2km
    const agentes = await base44.asServiceRole.entities.Agentes_Seguranca.filter({ status: "disponivel" });
    const origem = { lat: latNum, lng: lngNum };
    const proximos = agentes
      .filter((a) => typeof a.lat === "number" && typeof a.lng === "number")
      .map((a) => ({ ...a, _distancia_m: distanciaMetros(origem, { lat: a.lat, lng: a.lng }) }))
      .filter((a) => a._distancia_m <= RAIO_M)
      .sort((a, b) => a._distancia_m - b._distancia_m);

    const tokens = proximos.map((a) => a.push_token).filter((t) => typeof t === "string" && t.length > 0);

    let push = { disparado: false, motivo: null, successCount: 0, failureCount: 0 };
    if (tokens.length === 0) {
      push.motivo = "nenhum agente próximo com token FCM";
    } else {
      const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
      if (!saRaw) {
        push.motivo = "FCM_SERVICE_ACCOUNT_JSON não configurado";
      } else {
        const sa = JSON.parse(saRaw);
        const projectId = sa.project_id;
        const resp = await sendFcmMulticast(
          projectId, sa, tokens,
          { title: "🚨 PÂNICO — Atendimento Imediato", body: ocorrencia.description || "Chamado de pânico" },
          { ocorrencia_id: String(ocorrencia.id), lat: String(latNum), lng: String(lngNum), tipo: "panic", prioridade: "critical" }
        );
        push = { disparado: true, motivo: null, successCount: resp.successCount, failureCount: resp.failureCount };
      }
    }

    return Response.json({
      status: push.disparado ? "despachado" : "sem_push",
      ocorrencia_id: ocorrencia.id,
      agentes_no_raio: proximos.length,
      agentes: proximos.map((a) => ({ nome: a.nome, distancia_m: Math.round(a._distancia_m) })),
      push,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});