import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { periodo_dias = 30, regiao, bairro, cidade } = payload;

    // Período de análise
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo_dias);

    // Buscar ocorrências finalizadas no período
    const query = {
      status: 'resolved',
      created_date: { $gte: dataInicio.toISOString(), $lte: dataFim.toISOString() }
    };

    const ocorrencias = await base44.asServiceRole.entities.Occurrence.filter(
      query, '-created_date', 500
    );

    if (ocorrencias.length === 0) {
      return Response.json({ status: 'sem_dados', message: 'Nenhuma ocorrência finalizada no período' });
    }

    // Agrupar por tipo
    const porTipo = {};
    const porBairro = {};
    const porHora = {};
    const heatmapPontos = [];

    for (const o of ocorrencias) {
      const tipo = o.type || 'outro';
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;

      const bairro = o.address?.split(',')[0]?.trim() || 'não_mapeado';
      porBairro[bairro] = (porBairro[bairro] || 0) + 1;

      if (o.created_date) {
        const hora = new Date(o.created_date).getHours();
        const faixa = `${hora}h-${hora + 2}h`;
        porHora[faixa] = (porHora[faixa] || 0) + 1;
      }

      if (o.lat && o.lng) {
        heatmapPontos.push({ lat: o.lat, lng: o.lng, intensidade: 1 });
      }
    }

    // Consolidar heatmap (agrupar pontos próximos)
    const heatmapConsolidado = [];
    const usado = new Set();
    for (let i = 0; i < heatmapPontos.length; i++) {
      if (usado.has(i)) continue;
      let intensidade = 1;
      let latSum = heatmapPontos[i].lat;
      let lngSum = heatmapPontos[i].lng;
      let count = 1;
      for (let j = i + 1; j < heatmapPontos.length; j++) {
        if (usado.has(j)) continue;
        const dist = Math.sqrt(
          Math.pow(heatmapPontos[i].lat - heatmapPontos[j].lat, 2) +
          Math.pow(heatmapPontos[i].lng - heatmapPontos[j].lng, 2)
        );
        if (dist < 0.002) {
          latSum += heatmapPontos[j].lat;
          lngSum += heatmapPontos[j].lng;
          intensidade++;
          count++;
          usado.add(j);
        }
      }
      heatmapConsolidado.push({
        lat: latSum / count,
        lng: lngSum / count,
        intensidade
      });
    }

    // Tipo mais incidente
    const tipoPrincipal = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0] || ['outro', 0];

    // Faixa horária mais crítica
    const faixaCritica = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0] || ['00h-02h', 0];

    // Bairro mais afetado
    const bairroCritico = Object.entries(porBairro).sort((a, b) => b[1] - a[1])[0] || ['não_mapeado', 0];

    // Persona: ANALISE_PREDITIVA
    const PERSONA_PRED = `[PERSONA ATIVADA: CIENTISTA DE DADOS CRIMINAIS E ESTATÍSTICO DE SEGURANÇA]
Você é um Cientista de Dados Criminais e Estatístico de Segurança. Comportamento obrigatório:
- IGNORE narrativas e textos longos. Processe APENAS dados tabulares.
- Use raciocínio lógico avançado para consolidar tendências.
- Calcule variações percentuais com precisão.
- Identifique padrões sazonais e polígonos de geofencing recomendados.
- Tom TÉCNICO E ANALÍTICO, sem floreios.
---\n\n`;

    const analise = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${PERSONA_PRED}Analise os seguintes dados criminais do período de ${periodo_dias} dias e gere um relatório preditivo:\n\n- Total de ocorrências finalizadas: ${ocorrencias.length}\n- Distribuição por tipo: ${JSON.stringify(porTipo)}\n- Tipo principal: ${tipoPrincipal[0]} (${tipoPrincipal[1]} casos)\n- Distribuição por bairro: ${JSON.stringify(porBairro)}\n- Bairro mais afetado: ${bairroCritico[0]} (${bairroCritico[1]} casos)\n- Faixa horária crítica: ${faixaCritica[0]} (${faixaCritica[1]} casos)\n- Período: ${dataInicio.toISOString().split('T')[0]} a ${dataFim.toISOString().split('T')[0]}\n\nIdentifique tendências, calcule variações e recomende ações táticas de policiamento preventivo.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título descritivo do relatório preditivo' },
          resumo: { type: 'string', maxLength: 500, description: 'Resumo executivo de até 5 linhas' },
          tendencia: { type: 'string', enum: ['alta', 'estavel', 'queda', 'pico'] },
          percentual_variacao_estimado: { type: 'number', description: 'Variação percentual estimada (ex: 35 para +35%)' },
          fatores_contribuintes: { type: 'array', items: { type: 'string' } },
          recomendacoes: { type: 'string', description: 'Recomendações táticas acionáveis' },
          faixa_horaria_critica_inicio: { type: 'string' },
          faixa_horaria_critica_fim: { type: 'string' },
          dias_criticos: { type: 'array', items: { type: 'string' } }
        },
        required: ['titulo', 'resumo', 'tendencia', 'recomendacoes']
      }
    });

    // Salvar relatório
    const relatorio = await base44.asServiceRole.entities.Analises_Preditivas.create({
      titulo: analise.titulo,
      resumo: analise.resumo,
      tipo_crime: tipoPrincipal[0],
      regiao: regiao || cidade || 'geral',
      bairro: bairro || bairroCritico[0],
      cidade: cidade || '',
      tendencia: analise.tendencia,
      percentual_variacao: analise.percentual_variacao_estimado || 0,
      fatores_contribuintes: analise.fatores_contribuintes || [],
      recomendacoes: analise.recomendacoes,
      faixa_horaria_inicio: analise.faixa_horaria_critica_inicio || faixaCritica[0].split('h-')[0] + ':00',
      faixa_horaria_fim: analise.faixa_horaria_critica_fim || faixaCritica[0].split('h-')[1].replace('h', '') + ':00',
      dias_criticos: analise.dias_criticos || [],
      data_geracao: new Date().toISOString(),
      periodo_analise_inicio: dataInicio.toISOString().split('T')[0],
      periodo_analise_fim: dataFim.toISOString().split('T')[0],
      total_ocorrencias_periodo: ocorrencias.length,
      heatmap_coordenadas: heatmapConsolidado,
      status: 'publicado',
      nivel_confianca: ocorrencias.length > 50 ? 'alta' : ocorrencias.length > 20 ? 'media' : 'baixa'
    });

    return Response.json({
      status: 'ok',
      relatorio_id: relatorio.id,
      total_ocorrencias_analisadas: ocorrencias.length,
      tipo_principal: tipoPrincipal[0],
      analise
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});