import { createClientFromRequest } from "npm:@base44/sdk@0.8.39";
import admin from "npm:firebase-admin@13.0.0";

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

let fcmInicializado = false;
function getMessaging() {
  const json = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!json || !projectId) return null;
  if (!fcmInicializado) {
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    fcmInicializado = true;
  }
  return admin.messaging();
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

    const { lat, lng, type, subtype, description, address, priority } = body;

    // Validação de coordenadas
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (lat === undefined || lat === null || lat === "" ||
        lng === undefined || lng === null || lng === "" ||
        !Number.isFinite(latNum) || !Number.isFinite(lngNum) ||
        latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return Response.json(
        { error: "Latitude e longitude são obrigatórias e devem ter formato válido." },
        { status: 422 }
      );
    }

    // Validação de categoria
    if (!type || !TIPOS_VALIDOS.includes(type)) {
      return Response.json(
        { error: "Tipo de categoria inválido. Informe: crime, traffic, civil_defense, health ou panic." },
        { status: 422 }
      );
    }

    // 1) Salvar a ocorrência
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

    // 3) Recuperar tokens FCM
    const tokens = proximos
      .map((a) => a.push_token)
      .filter((t) => typeof t === "string" && t.length > 0);

    // 4) Disparar push em massa via firebase-admin (sendMulticast)
    let push = { disparado: false, motivo: null, successCount: 0, failureCount: 0 };
    if (tokens.length === 0) {
      push.motivo = "nenhum agente próximo com token FCM";
    } else {
      const messaging = getMessaging();
      if (!messaging) {
        push.motivo = "FCM_SERVICE_ACCOUNT_JSON não configurado — push ignorado";
      } else {
        const titulo = `Ocorrência: ${type}`;
        const corpo = description || subtype || "Nova ocorrência de segurança";
        const resp = await messaging.sendMulticast({
          tokens,
          notification: { title: titulo, body: corpo },
          data: {
            ocorrencia_id: String(ocorrencia.id),
            lat: String(latNum),
            lng: String(lngNum),
            tipo: type,
            prioridade: priority || "medium",
          },
        });
        push = {
          disparado: true,
          motivo: null,
          successCount: resp.successCount,
          failureCount: resp.failureCount,
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