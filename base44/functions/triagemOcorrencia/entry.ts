import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const occurrence = payload.data || payload;

    if (!occurrence || !occurrence.id) {
      return Response.json({ error: 'Ocorrência inválida' }, { status: 400 });
    }

    const descricao = occurrence.description || '';
    const transcricao = occurrence.media_urls?.join(' ') || '';
    const conteudo = `${descricao} ${transcricao}`.trim();

    if (!conteudo) {
      return Response.json({ status: 'sem_conteudo', message: 'Nada a analisar' });
    }

    // --- A. Classificação de urgência via LLM (Persona: TRIAGEM) ---
    const PERSONA_TRIAGEM = `[PERSONA ATIVADA: TRIADOR TÉCNICO DE EMERGÊNCIA - ALTA VELOCIDADE]
Você é um Triador Técnico de Emergência. Comportamento obrigatório:
- FRIO, DIRETO E MATEMÁTICO. Zero empatia, zero palavras amigáveis.
- Extraia APENAS palavras-chave de gravidade do relato.
- Categorize o evento no menor número de tokens possível.
- Prioridade: 'CRÍTICO_RISCO_MORTE' para risco iminente à vida.
- Sem introduções, sem conclusões. APENAS DADOS.
---\n\n`;

    const triagem = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${PERSONA_TRIAGEM}Analise este relato de ocorrência de segurança pública e classifique-o estritamente. Retorne APENAS o JSON solicitado.\n\nRELATO: "${conteudo}"\n\nContexto adicional:\n- Tipo atual: ${occurrence.type || 'não definido'}\n- Subtipo atual: ${occurrence.subtype || 'não definido'}\n- Endereço: ${occurrence.address || 'não informado'}`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          tipo_classificado: { type: 'string', enum: ['crime', 'traffic', 'civil_defense', 'health', 'panic'] },
          subtipo: { type: 'string', description: 'Subtipo específico (ex: roubo_mao_armada, acidente_com_vitima, enchente, parada_cardiaca, panico_com_ameaca)' },
          prioridade: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          palavras_chave_gravidade: { type: 'array', items: { type: 'string' } },
          orgao_recomendado: { type: 'string', enum: ['policia_militar', 'samu', 'bombeiros', 'defesa_civil', 'policia_civil', 'multiplos'] },
          resumo_despacho_ia: { type: 'string', maxLength: 300, description: 'Resumo executivo de EXATAMENTE 3 linhas para leitura rápida no rádio policial' },
          justificativa: { type: 'string', maxLength: 200 },
          risco_morte: { type: 'boolean' }
        },
        required: ['tipo_classificado', 'subtipo', 'prioridade', 'orgao_recomendado', 'justificativa', 'resumo_despacho_ia']
      }
    });

    // --- B. Detecção de trote ---
    const historico = await base44.asServiceRole.entities.Occurrence.filter(
      { reporter_id: occurrence.reporter_id },
      '-created_date',
      20
    );

    let scoreSuspeita = 0;
    const evidencias = [];
    const fatores = {
      discrepancia_gps: false,
      multiplos_relatos_simultaneos: false,
      historico_suspeito: false,
      ip_dispositivo_inconsistente: false,
      descricao_vaga: false
    };

    // Múltiplos relatos em curto período
    const agora = new Date();
    const relatosRecentes = historico.filter(h => {
      const diffMin = (agora - new Date(h.created_date)) / 60000;
      return diffMin < 30;
    });
    if (relatosRecentes.length >= 3) {
      scoreSuspeita += 25;
      fatores.multiplos_relatos_simultaneos = true;
      evidencias.push(`${relatosRecentes.length} relatos nos últimos 30 minutos`);
    }

    // Histórico suspeito
    const quarentenasAnteriores = await base44.asServiceRole.entities.Alertas_Quarentena.filter(
      { user_id: occurrence.reporter_id, status_validacao: 'confirmado_trote' }
    );
    if (quarentenasAnteriores.length > 0) {
      scoreSuspeita += 40;
      fatores.historico_suspeito = true;
      evidencias.push(`${quarentenasAnteriores.length} trotes confirmados anteriormente`);
    }

    // Descrição muito vaga
    if (conteudo.length < 15) {
      scoreSuspeita += 10;
      fatores.descricao_vaga = true;
      evidencias.push('Descrição excessivamente vaga');
    }

    // Aplicar classificação da IA
    const classificacao = triagem;
    const resumoDespacho = classificacao.resumo_despacho_ia || '';
    await base44.asServiceRole.entities.Occurrence.update(occurrence.id, {
      type: classificacao.tipo_classificado,
      subtype: classificacao.subtipo,
      priority: classificacao.prioridade,
      description: occurrence.description
        ? `${occurrence.description}\n\n📋 RESUMO DESPACHO IA:\n${resumoDespacho}`
        : `📋 RESUMO DESPACHO IA:\n${resumoDespacho}`
    });

    // Se for saúde, anexar perfil médico
    let perfilMedico = null;
    if (classificacao.tipo_classificado === 'health' && occurrence.reporter_id) {
      const perfis = await base44.asServiceRole.entities.Perfis_Medicos_Usuarios.filter(
        { user_id: occurrence.reporter_id }
      );
      if (perfis.length > 0) {
        perfilMedico = perfis[0];
        await base44.asServiceRole.entities.Occurrence.update(occurrence.id, {
          description: `${occurrence.description || ''}\n\n[PERFIL MÉDICO ANEXADO AUTOMATICAMENTE]\nTipo Sanguíneo: ${perfilMedico.tipo_sanguineo}\nAlergias: ${(perfilMedico.alergias || []).join(', ') || 'Nenhuma'}\nCondições: ${(perfilMedico.condicoes_preexistentes || []).join(', ') || 'Nenhuma'}\nContato Emergência: ${perfilMedico.contato_emergencia_nome || 'N/A'} - ${perfilMedico.contato_emergencia_telefone || 'N/A'}`
        });
      }
    }

    // Quarentena se score > 60
    if (scoreSuspeita > 60) {
      await base44.asServiceRole.entities.Alertas_Quarentena.create({
        ocorrencia_id: occurrence.id,
        user_id: occurrence.reporter_id || 'anonimo',
        user_name: occurrence.reporter_id ? 'usuário' : 'anônimo',
        motivo_suspeita: evidencias.join('; '),
        evidencias,
        score_suspeita: scoreSuspeita,
        fatores_analisados: fatores,
        status_validacao: 'pendente'
      });

      // Se for Alertas_Inteligencia_IA, atualizar status
      if (payload.event?.entity_name === 'Alertas_Inteligencia_IA') {
        await base44.asServiceRole.entities.Alertas_Inteligencia_IA.update(occurrence.id, {
          status_alerta: 'SUSPEITA_TROTE'
        });
      }
    }

    return Response.json({
      status: 'ok',
      classificacao,
      score_suspeita: scoreSuspeita,
      em_quarentena: scoreSuspeita > 60,
      perfil_medico_anexado: !!perfilMedico
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});