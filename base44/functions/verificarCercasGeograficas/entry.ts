import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { latitude, longitude, user_id, user_name } = payload;

    if (latitude == null || longitude == null) {
      return Response.json({ error: 'Coordenadas obrigatórias' }, { status: 400 });
    }

    // Point-in-polygon: ray casting algorithm
    function isPointInPolygon(lat, lng, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;
        if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }

    // Buscar todas as cercas ativas
    const cercasAtivas = await base44.asServiceRole.entities.Cercas_Geograficas_Defesa_Civil.filter(
      { status: 'ativo' }
    );

    const matches = [];

    for (const cerca of cercasAtivas) {
      if (!cerca.poligono_coordenadas || cerca.poligono_coordenadas.length < 3) continue;

      const dentro = isPointInPolygon(longitude, latitude, cerca.poligono_coordenadas);

      if (dentro) {
        matches.push(cerca);

        // Criar notificação de geofence
        await base44.asServiceRole.entities.Notificacoes_Geofence.create({
          cerca_id: cerca.id,
          cerca_nome: cerca.nome,
          tipo_risco: cerca.tipo_risco,
          nivel_urgencia: cerca.nivel_urgencia,
          user_id: user_id || 'desconhecido',
          user_name: user_name || 'Usuário',
          coordenada_lat: latitude,
          coordenada_lng: longitude,
          data_disparo: new Date().toISOString(),
          mensagem: cerca.mensagem_alerta || `⚠️ Alerta de ${cerca.tipo_risco}: você está em área de risco em ${cerca.bairro || cerca.cidade || 'sua região'}. ${cerca.nivel_urgencia === 'extremo' ? 'EVACUE A ÁREA IMEDIATAMENTE!' : 'Siga as orientações da Defesa Civil.'}`,
          status_envio: 'enviado',
          canal: 'push'
        });
      }
    }

    return Response.json({
      matches: matches.map(m => ({
        id: m.id,
        nome: m.nome,
        tipo_risco: m.tipo_risco,
        nivel_urgencia: m.nivel_urgencia,
        mensagem: m.mensagem_alerta
      })),
      total: matches.length,
      dentro_de_cerca: matches.length > 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});