import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { origem_lat, origem_lng, destino_lat, destino_lng, modo = 'a_pe' } = payload;

    if (!origem_lat || !origem_lng || !destino_lat || !destino_lng) {
      return Response.json({ error: 'Coordenadas de origem e destino obrigatórias' }, { status: 400 });
    }

    // Corredor de busca: bounding box entre origem e destino com margem
    const margem = 0.005; // ~500m
    const minLat = Math.min(origem_lat, destino_lat) - margem;
    const maxLat = Math.max(origem_lat, destino_lat) + margem;
    const minLng = Math.min(origem_lng, destino_lng) - margem;
    const maxLng = Math.max(origem_lng, destino_lng) + margem;

    // Buscar ocorrências recentes no corredor (últimos 90 dias)
    const tresMesesAtras = new Date();
    tresMesesAtras.setDate(tresMesesAtras.getDate() - 90);

    const ocorrencias = await base44.asServiceRole.entities.Occurrence.filter({
      status: 'resolved',
      created_date: { $gte: tresMesesAtras.toISOString() }
    }, '-created_date', 200);

    // Filtrar por bounding box (aproximação)
    const ocorrenciasNaRota = ocorrencias.filter(o => {
      if (!o.lat || !o.lng) return false;
      return o.lat >= minLat && o.lat <= maxLat && o.lng >= minLng && o.lng <= maxLng;
    });

    // Buscar postes de iluminação no corredor
    const postes = await base44.asServiceRole.entities.Postes_Iluminacao.list('-created_date', 500);
    const postesNaRota = postes.filter(p => {
      if (!p.coordenada_lat || !p.coordenada_lng) return false;
      return p.coordenada_lat >= minLat && p.coordenada_lat <= maxLat &&
             p.coordenada_lng >= minLng && p.coordenada_lng <= maxLng;
    });

    const postesFuncionando = postesNaRota.filter(p => p.status === 'funcionando').length;
    const postesDefeito = postesNaRota.filter(p => p.status !== 'funcionando').length;
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
    const indicePericulosidade = totalOcorrencias > 0
      ? Math.min(100, Math.round((totalOcorrencias / 10) * 100))
      : 0;

    // Score de segurança: 0-100 (100 = mais seguro)
    const scoreSeguranca = Math.max(0, Math.round(
      100 - (indicePericulosidade * 0.6) - ((100 - taxaIluminacao) * 0.4)
    ));

    // Gerar recomendações via LLM (Persona: MAPA_ROTAS)
    const PERSONA_MAPA = `[PERSONA ATIVADA: ENGENHEIRO DE TRÁFEGO E LOGÍSTICA URBANA]
Você é um Engenheiro de Tráfego e Logística Urbana. Comportamento obrigatório:
- Aplique PESOS MATEMÁTICOS: penalize caminhos com registros recentes de ocorrências (peso -0.6 por incidente no raio de 200m).
- Priorize vias com registros de alta iluminação pública (peso +0.4 por poste funcionando no raio de 100m).
- Calcule score de segurança de 0-100 para cada rota candidata.
- Recomende a rota mais segura com justificativa técnica baseada nos pesos.
- Saída OBJETIVA e CALCULADA, sem floreios narrativos.
---\n\n`;

    const analise = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${PERSONA_MAPA}Analise a segurança de uma rota para um cidadão e forneça recomendações. Dados:\n- Origem: (${origem_lat}, ${origem_lng})\n- Destino: (${destino_lat}, ${destino_lng})\n- Modo: ${modo}\n- Ocorrências recentes na área (90 dias): ${totalOcorrencias} (${JSON.stringify(crimeCounts)})\n- Iluminação: ${taxaIluminacao}% dos postes funcionando (${postesFuncionando} ok, ${postesDefeito} com defeito)\n- Score de segurança calculado: ${scoreSeguranca}/100\n\nAplique os pesos matemáticos e retorne a análise.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          nivel_risco: { type: 'string', enum: ['baixo', 'moderado', 'alto', 'critico'] },
          resumo: { type: 'string', maxLength: 200 },
          recomendacoes: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          rota_alternativa_sugerida: { type: 'boolean' },
          horario_recomendado: { type: 'string', description: 'Horário mais seguro se houver padrão' }
        },
        required: ['nivel_risco', 'resumo', 'recomendacoes']
      }
    });

    return Response.json({
      score_seguranca: scoreSeguranca,
      total_ocorrencias_corredor: totalOcorrencias,
      ocorrencias_por_tipo: crimeCounts,
      iluminacao: {
        total_postes: postesNaRota.length,
        funcionando: postesFuncionando,
        com_defeito: postesDefeito,
        taxa: taxaIluminacao
      },
      analise_ia: analise,
      ocorrencias_detalhes: ocorrenciasNaRota.slice(0, 10).map(o => ({
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