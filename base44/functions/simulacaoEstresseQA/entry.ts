import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Coordenadas reais de São Paulo (espalhadas por bairros distintos)
const COORDENADAS_SP = [
  { bairro: 'Sé', lat: -23.5505, lng: -46.6333 },
  { bairro: 'Pinheiros', lat: -23.5667, lng: -46.6933 },
  { bairro: 'Itaquera', lat: -23.5378, lng: -46.4556 },
  { bairro: 'Santana', lat: -23.4800, lng: -46.6250 },
  { bairro: 'Lapa', lat: -23.5222, lng: -46.7056 },
  { bairro: 'Moema', lat: -23.5978, lng: -46.6639 },
  { bairro: 'Vila Mariana', lat: -23.5833, lng: -46.6333 },
  { bairro: 'Tatuapé', lat: -23.5467, lng: -46.5767 },
  { bairro: 'Campo Limpo', lat: -23.6367, lng: -46.7639 },
  { bairro: 'São Miguel', lat: -23.4958, lng: -46.4403 },
];

const OCORRENCIAS_MOCK = [
  { descricao: 'Assalto à mão armada em ônibus na Avenida Paulista. Dois suspeitos armados com revólver, 5 vítimas rendidas. Disparos ouvidos.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'crime' },
  { descricao: 'Alagamento severo na Marginal Tietê, altura da Ponte das Bandeiras. Carros ilhados, pessoas presas em veículos. Água subindo rapidamente.', tipo_gatilho: 'DESVIO_ROTA', tipo: 'civil_defense' },
  { descricao: 'Idoso desmaiado no Terminal de Ônibus Parque Dom Pedro II. Não responde a estímulos, respiração irregular. Possível parada cardiorrespiratória.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'health' },
  { descricao: 'Criança engasgada em lanchonete no Shopping Center Norte. Mãe desesperada pede socorro. Criança com lábios arroxeados.', tipo_gatilho: 'SENHA_COERCAO', tipo: 'health' },
  { descricao: 'Tiroteio em frente à estação Brás da CPTM. Troca de tiros entre facções, pedestres correndo. Viatura da PM isolou área.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'crime' },
  { descricao: 'Acidente grave na Rodovia dos Bandeirantes km 18. Caminhão tombado sobre carro de passeio, vítima presa nas ferragens. Vazamento de combustível.', tipo_gatilho: 'DESVIO_ROTA', tipo: 'traffic' },
  { descricao: 'Deslizamento de terra na Zona Norte, bairro Brasilândia. Três casas soterradas, 12 pessoas desaparecidas. Defesa Civil já no local.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'civil_defense' },
  { descricao: 'Homem tentando suicídio no Viaduto do Chá, centro de SP. Negociador da PM no local. Multidão aglomerada. Trânsito parado.', tipo_gatilho: 'SENHA_COERCAO', tipo: 'panic' },
  { descricao: 'Incêndio em prédio residencial de 8 andares na Rua Augusta. Moradores presos nos andares superiores. Corpo de Bombeiros combatendo as chamas.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'civil_defense' },
  { descricao: 'Mulher grávida entrando em trabalho de parto dentro do Metrô Sé. Contrações a cada 3 minutos. Bolsa rompida.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'health' },
  { descricao: 'Roubo de carga de eletrônicos na Rodovia Anchieta km 23. Caminhão interceptado por quadrilha armada com fuzis. Motorista feito refém.', tipo_gatilho: 'SENHA_COERCAO', tipo: 'crime' },
  { descricao: 'Colisão entre dois ônibus na Praça da Sé. 15 feridos, dois graves. SAMU no local. Pista interditada.', tipo_gatilho: 'DESVIO_ROTA', tipo: 'traffic' },
  { descricao: 'Vazamento de gás em condomínio na Mooca. Forte odor, 40 famílias evacuadas. Equipe da Comgás e Bombeiros no local.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'civil_defense' },
  { descricao: 'Adolescente com crise convulsiva em escola pública no bairro de Guaianases. Professores desesperados, sem treinamento de primeiros socorros.', tipo_gatilho: 'CALCULADORA_PANICO', tipo: 'health' },
  { descricao: 'Tentativa de latrocínio em posto de gasolina na Marginal Pinheiros. Frentista baleado, suspeito fugiu de moto. Câmeras captaram a placa.', tipo_gatilho: 'SENHA_COERCAO', tipo: 'crime' },
];

const AGENTES_MOCK = [
  { nome: 'Cabo Oliveira', tipo: 'policial', lat: -23.5505, lng: -46.6333, veiculo: 'PM-4521' },
  { nome: 'Tenente Costa', tipo: 'policial', lat: -23.5978, lng: -46.6639, veiculo: 'PM-3317' },
  { nome: 'Socorrista Almeida', tipo: 'socorrista', lat: -23.5222, lng: -46.7056, veiculo: 'SAMU-089' },
  { nome: 'Capitão Nogueira', tipo: 'bombeiro', lat: -23.5833, lng: -46.6333, veiculo: 'CBM-0214' },
  { nome: 'Sargento Ribeiro', tipo: 'policial', lat: -23.6367, lng: -46.7639, veiculo: 'PM-5003' },
];

function gerarIdExecucao() {
  return `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function logEtapa(base44, execucaoId, etapa, status, detalhe, dados = {}) {
  const entry = {
    execucao_id: execucaoId,
    etapa,
    status,
    detalhe,
    data_execucao: new Date().toISOString(),
    ...dados
  };
  await base44.asServiceRole.entities.Logs_Auditoria_QA.create(entry);
  return entry;
}

Deno.serve(async (req) => {
  const execucaoId = gerarIdExecucao();
  const inicioGeral = Date.now();
  const resultados = { etapas: [], erros: 0, sucessos: 0, timeouts: 0 };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ═══════════════════ ETAPA 1: AGENTES DE TESTE ═══════════════════
    const t0 = Date.now();
    let agentes = [];
    try {
      agentes = await base44.asServiceRole.entities.Agentes_Seguranca.filter({ status: 'disponivel' });
      if (agentes.length < 3) {
        for (const a of AGENTES_MOCK) {
          const existente = await base44.asServiceRole.entities.Agentes_Seguranca.filter({ nome: a.nome });
          if (existente.length === 0) {
            await base44.asServiceRole.entities.Agentes_Seguranca.create(a);
          }
        }
        agentes = await base44.asServiceRole.entities.Agentes_Seguranca.filter({ status: 'disponivel' });
      }
      const tempo = Date.now() - t0;
      await logEtapa(base44, execucaoId, 'geracao_dados', 'success',
        `Agentes de teste prontos: ${agentes.length} disponíveis`, { tempo_ms: tempo });
      resultados.sucessos++;
      resultados.etapas.push({ etapa: 'geracao_dados', status: 'success', tempo_ms: tempo });
    } catch (e) {
      const tempo = Date.now() - t0;
      await logEtapa(base44, execucaoId, 'geracao_dados', 'error',
        `Falha ao criar agentes: ${e.message}`,
        { tempo_ms: tempo, error_message: e.message, error_details: e.stack });
      resultados.erros++;
      resultados.etapas.push({ etapa: 'geracao_dados', status: 'error', tempo_ms: tempo, erro: e.message });
    }

    // ═══════════════════ ETAPA 2: GERAÇÃO DE OCORRÊNCIAS ═══════════════════
    const t1 = Date.now();
    const ocorrenciasCriadas = [];
    try {
      const qtd = 12 + Math.floor(Math.random() * 8); // 12-19
      const agora = new Date();
      const selecionadas = OCORRENCIAS_MOCK.sort(() => Math.random() - 0.5).slice(0, qtd);

      for (let i = 0; i < selecionadas.length; i++) {
        const mock = selecionadas[i];
        const coordIdx = i % COORDENADAS_SP.length;
        const coord = COORDENADAS_SP[coordIdx];
        const timestamp = new Date(agora.getTime() - (i * 60000)).toISOString();

        const ocorrencia = await base44.asServiceRole.entities.Alertas_Inteligencia_IA.create({
          tipo_gatilho: mock.tipo_gatilho,
          data_hora_brasilia: timestamp,
          geolocalizacao_latitude: coord.lat + (Math.random() - 0.5) * 0.008,
          geolocalizacao_longitude: coord.lng + (Math.random() - 0.5) * 0.008,
          status_alerta: 'TRIAGEM_IA',
          transcricao_audio_ia: mock.descricao,
        });
        ocorrenciasCriadas.push(ocorrencia);
      }

      const tempo = Date.now() - t1;
      await logEtapa(base44, execucaoId, 'criacao_ocorrencias', 'success',
        `${ocorrenciasCriadas.length} ocorrências simuladas criadas`, { tempo_ms: tempo });
      resultados.sucessos++;
      resultados.etapas.push({ etapa: 'criacao_ocorrencias', status: 'success', tempo_ms: tempo, count: ocorrenciasCriadas.length });
    } catch (e) {
      const tempo = Date.now() - t1;
      await logEtapa(base44, execucaoId, 'criacao_ocorrencias', 'error',
        `Falha ao gerar ocorrências: ${e.message}`,
        { tempo_ms: tempo, error_message: e.message, error_details: e.stack });
      resultados.erros++;
      resultados.etapas.push({ etapa: 'criacao_ocorrencias', status: 'error', tempo_ms: tempo, erro: e.message });
    }

    // ═══════════════════ ETAPA 3: TRIAGEM IA ═══════════════════
    const t2 = Date.now();
    let triadas = 0;
    try {
      for (const occ of ocorrenciasCriadas) {
        const tTriagem = Date.now();
        try {
          const resposta = await base44.asServiceRole.functions.invoke('triagemOcorrencia', {
            data: {
              id: occ.id,
              description: occ.transcricao_audio_ia || '',
              type: 'panic',
              address: `${COORDENADAS_SP[Math.floor(Math.random()*COORDENADAS_SP.length)].bairro}, SP`,
              reporter_id: 'qa_bot',
            },
            event: { type: 'create', entity_name: 'Alertas_Inteligencia_IA', entity_id: occ.id }
          });

          const tempoTriagem = Date.now() - tTriagem;
          if (resposta.status === 'ok') {
            triadas++;
            await logEtapa(base44, execucaoId, 'triagem_ia', 'success',
              `Triagem OK: prioridade ${resposta.classificacao?.prioridade || 'N/A'}`,
              { tempo_ms: tempoTriagem, ocorrencia_id: occ.id });
          } else {
            await logEtapa(base44, execucaoId, 'triagem_ia', 'error',
              `Triagem retornou status inesperado: ${JSON.stringify(resposta)}`,
              { tempo_ms: tempoTriagem, ocorrencia_id: occ.id, error_message: 'status não ok' });
          }
        } catch (e) {
          const tempoTriagem = Date.now() - tTriagem;
          await logEtapa(base44, execucaoId, 'triagem_ia', 'error',
            `Erro na triagem da ocorrência ${occ.id}: ${e.message}`,
            { tempo_ms: tempoTriagem, ocorrencia_id: occ.id, error_message: e.message, error_details: e.stack });
          resultados.erros++;
        }
      }

      const tempoTotal = Date.now() - t2;
      await logEtapa(base44, execucaoId, 'triagem_ia', 'success',
        `Resumo triagem: ${triadas}/${ocorrenciasCriadas.length} processadas com sucesso`,
        { tempo_ms: tempoTotal });
      resultados.etapas.push({ etapa: 'triagem_ia', status: 'success', tempo_ms: tempoTotal, triadas, total: ocorrenciasCriadas.length });
    } catch (e) {
      const tempo = Date.now() - t2;
      await logEtapa(base44, execucaoId, 'triagem_ia', 'error',
        `Falha geral na etapa de triagem: ${e.message}`,
        { tempo_ms: tempo, error_message: e.message });
      resultados.erros++;
    }

    // ═══════════════════ ETAPA 4: ATRIBUIÇÃO DE AGENTES ═══════════════════
    const t3 = Date.now();
    let atribuicoes = 0;
    try {
      agentes = await base44.asServiceRole.entities.Agentes_Seguranca.filter({ status: 'disponivel' });

      for (const occ of ocorrenciasCriadas) {
        // Encontrar agente mais próximo
        let maisProximo = null;
        let menorDist = Infinity;
        for (const ag of agentes) {
          if (!ag.lat || !ag.lng) continue;
          const dist = calcularDistanciaKm(occ.geolocalizacao_latitude, occ.geolocalizacao_longitude, ag.lat, ag.lng);
          if (dist < menorDist) { menorDist = dist; maisProximo = ag; }
        }

        if (maisProximo) {
          const tAttr = Date.now();
          await base44.asServiceRole.entities.Alertas_Inteligencia_IA.update(occ.id, {
            status_alerta: 'DESPACHADO_POLICIA',
            resumo_despacho_ia: `Despachado ${maisProximo.nome} (${maisProximo.veiculo}) - distância ${menorDist.toFixed(1)}km`
          });
          const tempoAttr = Date.now() - tAttr;
          atribuicoes++;
          await logEtapa(base44, execucaoId, 'atribuicao_agente', 'success',
            `${maisProximo.nome} (${maisProximo.veiculo}) atribuído a ${menorDist.toFixed(1)}km`,
            { tempo_ms: tempoAttr, ocorrencia_id: occ.id, agente_id: maisProximo.id });
        }
      }

      const tempoTotal = Date.now() - t3;
      resultados.etapas.push({ etapa: 'atribuicao_agente', status: 'success', tempo_ms: tempoTotal, atribuicoes });
    } catch (e) {
      const tempo = Date.now() - t3;
      await logEtapa(base44, execucaoId, 'atribuicao_agente', 'error',
        `Falha na atribuição: ${e.message}`,
        { tempo_ms: tempo, error_message: e.message, error_details: e.stack });
      resultados.erros++;
    }

    // ═══════════════════ ETAPA 5: PROGRESSÃO DE STATUS ═══════════════════
    const t4 = Date.now();
    let finalizados = 0;
    try {
      for (const occ of ocorrenciasCriadas) {
        try {
          // EM_ANDAMENTO
          await base44.asServiceRole.entities.Alertas_Inteligencia_IA.update(occ.id, {
            status_alerta: 'EM_ANDAMENTO'
          });
          // Pequena pausa para simular atendimento
          await new Promise(r => setTimeout(r, 100));

          // FINALIZADO
          await base44.asServiceRole.entities.Alertas_Inteligencia_IA.update(occ.id, {
            status_alerta: 'FINALIZADO'
          });
          finalizados++;
        } catch (e) {
          await logEtapa(base44, execucaoId, 'progressao_status', 'error',
            `Erro ao progredir status de ${occ.id}: ${e.message}`,
            { ocorrencia_id: occ.id, error_message: e.message });
          resultados.erros++;
        }
      }

      const tempoTotal = Date.now() - t4;
      await logEtapa(base44, execucaoId, 'progressao_status', 'success',
        `${finalizados}/${ocorrenciasCriadas.length} ocorrências progrediram até FINALIZADO`,
        { tempo_ms: tempoTotal });
      resultados.etapas.push({ etapa: 'progressao_status', status: 'success', tempo_ms: tempoTotal, finalizados, total: ocorrenciasCriadas.length });
    } catch (e) {
      const tempo = Date.now() - t4;
      await logEtapa(base44, execucaoId, 'progressao_status', 'error',
        `Falha na progressão: ${e.message}`,
        { tempo_ms: tempo, error_message: e.message });
      resultados.erros++;
    }

    // ═══════════════════ ETAPA 6: HEALTH CHECK FINAL ═══════════════════
    const totalEtapas = resultados.etapas.length;
    const etapasOk = resultados.etapas.filter(e => e.status === 'success').length;
    const percentual = totalEtapas > 0 ? Math.round((etapasOk / totalEtapas) * 100) : 0;
    const tempoTotalGeral = Date.now() - inicioGeral;

    const tempos = resultados.etapas.map(e => e.tempo_ms || 0);
    const etapaMaisLenta = tempos.length > 0 ? Math.max(...tempos) : 0;
    const etapaMaisRapida = tempos.length > 0 ? Math.min(...tempos) : 0;
    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;

    await logEtapa(base44, execucaoId, 'health_check', percentual >= 80 ? 'success' : 'error',
      `Saúde do sistema: ${percentual}% (${etapasOk}/${totalEtapas} etapas OK) | Tempo total: ${(tempoTotalGeral/1000).toFixed(1)}s`,
      { tempo_ms: tempoTotalGeral });

    return Response.json({
      execucao_id: execucaoId,
      status: percentual >= 80 ? 'saudavel' : 'degradado',
      health_percent: percentual,
      etapas_ok: etapasOk,
      total_etapas: totalEtapas,
      erros: resultados.erros,
      tempo_total_ms: tempoTotalGeral,
      tempo_medio_etapas_ms: tempoMedio,
      etapa_mais_lenta_ms: etapaMaisLenta,
      etapa_mais_rapida_ms: etapaMaisRapida,
      gargalos: resultados.etapas.filter(e => e.tempo_ms > tempoMedio * 1.5).map(e => ({
        etapa: e.etapa,
        tempo_ms: e.tempo_ms
      })),
      ocorrencias_simuladas: ocorrenciasCriadas.length,
      resumo_etapas: resultados.etapas
    });
  } catch (error) {
    await logEtapa(base44, execucaoId, 'health_check', 'error',
      `Falha catastrófica: ${error.message}`,
      { error_message: error.message, error_details: error.stack }).catch(() => {});
    return Response.json({ error: error.message, execucao_id: execucaoId }, { status: 500 });
  }
});