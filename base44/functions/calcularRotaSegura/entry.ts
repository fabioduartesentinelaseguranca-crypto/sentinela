import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function haversineM(a, b) {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { origem_lat, origem_lng, destino_lat, destino_lng, modo = 'a_pe', rota_pontos = [] } = payload;

    if (!origem_lat || !origem_lng || !destino_lat || !destino_lng) {
      return Response.json({ error: 'Coordenadas de origem e destino obrigatórias' }, { status: 400 });
    }

    // Amostra pontos da rota para filtro de proximidade (máx ~60 pontos)
    const routePts = Array.isArray(rota_pontos) ? rota_pontos : [];
    const step = Math.max(1, Math.floor(routePts.length / 60));
    const sampled = routePts.filter((_, i) => i % step === 0).map((p) => [p[0], p[1]]);
    const RAIO_M = 150;

    const isAlongRoute = (lat, lng) => {
      for (const p of sampled) {
        if (haversineM([lat, lng], p) <= RAIO_M) return true;
      }
      return false;
    };

    const margem = 0.005;
    const minLat = Math.min(origem_lat, destino_lat) - margem;
    const maxLat = Math.max(origem_lat, destino_lat) + margem;
    const minLng = Math.min(origem_lng, destino_lng) - margem;
    const maxLng = Math.max(origem_lng, destino_lng) + margem;

    const tresMesesAtras = new Date();
    tresMesesAtras.setDate(tresMesesAtras.getDate() - 90);

    const [ocorrencias, postes] = await Promise.all([
      base44.asServiceRole.entities.Occurrence.filter(
        { created_date: { $gte: tresMesesAtras.toISOString() } }, '-created_date', 300
      ),
      base44.asServiceRole.entities.Postes_Iluminacao.list('-created_date', 500),
    ]);

    // Filtrar ocorrências ao longo da rota real (ou por bounding box se sem geometria)
    const ocorrenciasNaRota = sampled.length > 0
      ? ocorrencias.filter((o) => o.lat && o.lng && isAlongRoute(o.lat, o.lng))
      : ocorrencias.filter((o) => o.lat && o.lng && o.lat >= minLat && o.lat <= maxLat && o.lng >= minLng && o.lng <= maxLng);

    const postesNaRota = sampled.length > 0
      ? postes.filter((p) => p.coordenada_lat && p.coordenada_lng && isAlongRoute(p.coordenada_lat, p.coordenada_lng))
      : postes.filter((p) => p.coordenada_lat && p.coordenada_lng && p.coordenada_lat >= minLat && p.coordenada_lat <= maxLat && p.coordenada_lng >= minLng && p.coordenada_lng <= maxLng);

    const postesFuncionando = postesNaRota.filter((p) => p.status === 'funcionando').length;
    const postesDefeito = postesNaRota.filter((p) => p.status !== 'funcionando').length;
    const taxaIluminacao = postesNaRota.length > 0
      ? Math.round((postesFuncionando / postesNaRota.length) * 100)
      : 50;

    // Agrupar ocorrências por tipo
    const crimeCounts = {};
    for (const o of ocorrenciasNaRota) {
      const tipo = o.type || 'outro';
      crimeCounts[tipo] = (crimeCounts[tipo] || 0) + 1;
    }

    const totalOcorrencias = ocorrenciasNaRota.length;
    const semOcorrencias = totalOcorrencias === 0;

    // Score 0-100: penaliza por ocorrências ao longo do caminho (peso por tipo) + iluminação
    const pesos = { crime: 15, panic: 20, traffic: 8, civil_defense: 5, health: 5 };
    let penalidade = 0;
    for (const [tipo, count] of Object.entries(crimeCounts)) {
      penalidade += (pesos[tipo] || 6) * count;
    }
    const penalidadeIlum = (100 - taxaIluminacao) * 0.2;
    const scoreSeguranca = Math.max(0, Math.round(100 - penalidade - penalidadeIlum));

    // Tipo de risco predominante
    let tipoRiscoDominante = null;
    let tipoRiscoLabel = null;
    if (totalOcorrencias > 0) {
      const sorted = Object.entries(crimeCounts).sort((a, b) => b[1] - a[1]);
      tipoRiscoDominante = sorted[0][0];
      const labels = {
        crime: 'Crime',
        traffic: 'Acidente de Trânsito',
        civil_defense: 'Defesa Civil',
        health: 'Emergência de Saúde',
        panic: 'Emergência Pessoal',
      };
      tipoRiscoLabel = labels[tipoRiscoDominante] || tipoRiscoDominante;
    }

    // Análise por IA (opcional — não bloqueia a resposta se falhar)
    let analise = null;
    try {
      const PERSONA_MAPA = `[PERSONA ATIVADA: ENGENHEIRO DE TRÁFEGO E LOGÍSTICA URBANA]
Você é um Engenheiro de Tráfego e Logística Urbana. Comportamento obrigatório:
- Aplique PESOS MATEMÁTICOS: penalize caminhos com registros recentes de ocorrências.
- Priorize vias com boa iluminação pública.
- Calcule score de segurança de 0-100.
- Recomende a rota mais segura com justificativa técnica baseada nos pesos.
---
`;
      analise = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${PERSONA_MAPA}Analise a segurança de uma rota para um cidadão. Dados:
- Origem: (${origem_lat}, ${origem_lng})
- Destino: (${destino_lat}, ${destino_lng})
- Modo: ${modo}
- Ocorrências recentes ao longo da rota (90 dias): ${totalOcorrencias} (${JSON.stringify(crimeCounts)})
- Tipo de risco predominante: ${tipoRiscoLabel || 'nenhum'}
- Iluminação: ${taxaIluminacao}% dos postes funcionando (${postesFuncionando} ok, ${postesDefeito} com defeito)
- Score de segurança calculado: ${scoreSeguranca}/100

Forneça recomendações objetivas.`,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            nivel_risco: { type: 'string', enum: ['baixo', 'moderado', 'alto', 'critico'] },
            resumo: { type: 'string', maxLength: 200 },
            recomendacoes: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            rota_alternativa_sugerida: { type: 'boolean' },
            horario_recomendado: { type: 'string' }
          },
          required: ['nivel_risco', 'resumo', 'recomendacoes']
        }
      });
    } catch { /* análise por IA é opcional */ }

    return Response.json({
      score_seguranca: scoreSeguranca,
      total_ocorrencias_corredor: totalOcorrencias,
      ocorrencias_por_tipo: crimeCounts,
      sem_ocorrencias: semOcorrencias,
      tipo_risco_dominante: tipoRiscoDominante,
      tipo_risco_label: tipoRiscoLabel,
      iluminacao: {
        total_postes: postesNaRota.length,
        funcionando: postesFuncionando,
        com_defeito: postesDefeito,
        taxa: taxaIluminacao
      },
      analise_ia: analise,
      ocorrencias_detalhes: ocorrenciasNaRota.slice(0, 10).map((o) => ({
        id: o.id,
        type: o.type,
        subtype: o.subtype,
        address: o.address,
        created_date: o.created_date,
        lat: o.lat,
        lng: o.lng
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});