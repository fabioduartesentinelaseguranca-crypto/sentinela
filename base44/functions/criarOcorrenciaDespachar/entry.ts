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
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signingInput);
  const assertion = encHeader + "." + encPayload + "." + b64url(new Uint8Array(sig));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" +
      encodeURIComponent(assertion),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Falha ao obter access token FCM: " + JSON.stringify(data));
  return data.access_token;
}

// Dispara push individual via FCM HTTP v1 para cada token (substitui sendMulticast)
async function sendFcmMulticast(projectId, sa, tokens, notification, data) {
  const accessToken = await makeAccessToken(sa);
  let successCount = 0;
  let failureCount = 0;
  const responses = [];
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification,
                data,
                android: { priority: "high" },
                apns: { payload: { aps: { sound: "default" } } },
              },
            }),
          }
        );
        if (res.ok) successCount++;
        else {
          failureCount++;
          responses.push({ token, ok: false, status: res.status, error: await res.text() });
        }
      } catch (e) {
        failureCount++;
        responses.push({ token, ok: false, error: e.message });
      }
    })
  );
  return { successCount, failureCount, responses };
}

const TIPOS_VALIDOS = ["crime", "traffic", "civil_defense", "health", "panic"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo JSON inválido" }, { status: 400 });
    }

    const { lat, lng, type, subtype, description, address, priority, data_hora_dispositivo } = body;

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (
      lat === undefined || lat === null || lat === "" ||
      lng === undefined || lng === null || lng === "" ||
      !Number.isFinite(latNum) || !Number.isFinite(lngNum) ||
      latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180
    ) {
      return Response.json(
        { error: "Latitude e longitude são obrigatórias e devem ter formato válido." },
        { status: 422 }
      );
    }

    if (!type || !TIPOS_VALIDOS.includes(type)) {
      return Response.json(
        { error: "Tipo de categoria inválido. Informe: crime, traffic, civil_defense, health ou panic." },
        { status: 422 }
      );
    }

    // 1) Salvar a ocorrência (horário do dispositivo em Brasília, se informado)
    const ocorrencia = await base44.entities.Occurrence.create({
      type,
      subtype,
      description,
      lat: latNum,
      lng: lngNum,
      address,
      priority: priority || "medium",
      status: "open",
      reporter_id: user.id,
      data_hora_dispositivo: data_hora_dispositivo || undefined,
    });

    // 2) Consulta geoespacial: agentes disponíveis em raio de 2km
    const RAIO_M = 2000;
    const agentes = await base44.entities.Agentes_Seguranca.filter({ status: "disponivel" });
    const origem = { lat: latNum, lng: lngNum };
    const proximos = agentes
      .filter((a) => typeof a.lat === "number" && typeof a.lng === "number")
      .map((a) => ({ ...a, _distancia_m: distanciaMetros(origem, { lat: a.lat, lng: a.lng }) }))
      .filter((a) => a._distancia_m <= RAIO_M)
      .sort((a, b) => a._distancia_m - b._distancia_m);

    const tokens = proximos
      .map((a) => a.push_token)
      .filter((t) => typeof t === "string" && t.length > 0);

    // 3) Disparo push em massa via FCM HTTP v1 (sem firebase-admin)
    let push = { disparado: false, motivo: null, successCount: 0, failureCount: 0 };
    if (tokens.length === 0) {
      push.motivo = "nenhum agente próximo com token FCM";
    } else {
      const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
      if (!saRaw) {
        push.motivo = "FCM_SERVICE_ACCOUNT_JSON não configurado — push ignorado";
      } else {
        const sa = JSON.parse(saRaw);
        const projectId = sa.project_id;
        const titulo = `Ocorrência: ${type}`;
        const corpo = description || subtype || "Nova ocorrência de segurança";
        const data = {
          ocorrencia_id: String(ocorrencia.id),
          lat: String(latNum),
          lng: String(lngNum),
          tipo: type,
          prioridade: priority || "medium",
        };
        const resp = await sendFcmMulticast(projectId, sa, tokens, { title: titulo, body: corpo }, data);
        push = {
          disparado: true,
          motivo: null,
          successCount: resp.successCount,
          failureCount: resp.failureCount,
          responses: resp.responses,
        };
      }
    }

    return Response.json(
      {
        status: 201,
        ocorrencia_id: ocorrencia.id,
        agentes_no_raio: proximos.length,
        agentes: proximos.map((a) => ({ nome: a.nome, distancia_m: Math.round(a._distancia_m) })),
        tokens_enviados: tokens,
        push,
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});