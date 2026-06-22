import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Obter todos os usuários com última localização registrada
    const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const usuariosComLocalizacao = usuarios.filter(u => u.last_location?.lat && u.last_location?.lng);

    // Obter todas as cercas ativas
    const cercasAtivas = await base44.asServiceRole.entities.Cercas_Geograficas_Defesa_Civil.filter(
      { status: 'ativo' }
    );

    if (cercasAtivas.length === 0 || usuariosComLocalizacao.length === 0) {
      return Response.json({ status: 'ok', notificacoes: 0, message: 'Sem cercas ativas ou usuários com localização' });
    }

    // Point-in-polygon
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

    let totalNotificacoes = 0;
    const notificados = [];

    for (const usuario of usuariosComLocalizacao) {
      for (const cerca of cercasAtivas) {
        if (!cerca.poligono_coordenadas || cerca.poligono_coordenadas.length < 3) continue;

        const dentro = isPointInPolygon(
          usuario.last_location.lng,
          usuario.last_location.lat,
          cerca.poligono_coordenadas
        );

        if (dentro) {
          // Verificar se já foi notificado desta cerca nas últimas 6 horas
          const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
          const notificacoesExistentes = await base44.asServiceRole.entities.Notificacoes_Geofence.filter({
            cerca_id: cerca.id,
            user_id: usuario.id,
            data_disparo: { $gte: seisHorasAtras }
          });

          if (notificacoesExistentes.length === 0) {
            await base44.asServiceRole.entities.Notificacoes_Geofence.create({
              cerca_id: cerca.id,
              cerca_nome: cerca.nome,
              tipo_risco: cerca.tipo_risco,
              nivel_urgencia: cerca.nivel_urgencia,
              user_id: usuario.id,
              user_name: usuario.full_name || 'Usuário',
              coordenada_lat: usuario.last_location.lat,
              coordenada_lng: usuario.last_location.lng,
              data_disparo: new Date().toISOString(),
              mensagem: cerca.mensagem_alerta || `⚠️ ALERTA ${cerca.nivel_urgencia.toUpperCase()}: ${cerca.tipo_risco} - ${cerca.nome}`,
              status_envio: 'enviado',
              canal: 'push'
            });
            totalNotificacoes++;
            notificados.push({
              user_id: usuario.id,
              user_name: usuario.full_name,
              cerca: cerca.nome,
              tipo: cerca.tipo_risco
            });
          }
        }
      }
    }

    return Response.json({
      status: 'ok',
      cercas_ativas: cercasAtivas.length,
      usuarios_verificados: usuariosComLocalizacao.length,
      notificacoes_enviadas: totalNotificacoes,
      notificados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});