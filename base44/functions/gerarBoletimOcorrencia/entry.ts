import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse request — expects { alerta_id }
    const body = await req.json();
    const alertaId = body.alerta_id;
    if (!alertaId) return Response.json({ error: 'alerta_id is required' }, { status: 400 });

    // ── 1. Fetch the alerta ──────────────────────────────
    const alerta = await base44.asServiceRole.entities.Alertas_Inteligencia_IA.get(alertaId);
    if (!alerta) return Response.json({ error: 'Alerta not found' }, { status: 404 });

    // ── 2. Fetch related occurrence ──────────────────────
    let ocorrencia = null;
    if (alerta.id_usuario) {
      const occs = await base44.asServiceRole.entities.Occurrence.filter({ reporter_id: alerta.id_usuario }, '-created_date', 5);
      ocorrencia = occs?.[0] || null;
    }

    // ── 3. Fetch related media / chat messages ───────────
    let chatMessages = [];
    if (ocorrencia?.id) {
      chatMessages = await base44.asServiceRole.entities.ChatMessage.filter({ occurrence_id: ocorrencia.id }, 'created_date', 50);
    }

    // ── 4. Compile the context for the LLM ───────────────
    const contexto = {
      alerta: {
        tipo_gatilho: alerta.tipo_gatilho,
        data_hora: alerta.data_hora_brasilia,
        latitude: alerta.geolocalizacao_latitude,
        longitude: alerta.geolocalizacao_longitude,
        status: alerta.status_alerta,
        transcricao_audio: alerta.transcricao_audio_ia || '(não disponível)',
        tags_acusticas: alerta.analise_acustica_tags || [],
        resumo_despacho: alerta.resumo_despacho_ia || '',
        grau_prioridade: alerta.grau_prioridade_ia || 'NÃO INFORMADO',
      },
      ocorrencia: ocorrencia ? {
        tipo: ocorrencia.type,
        subtipo: ocorrencia.subtype,
        descricao: ocorrencia.description,
        endereco: ocorrencia.address,
        status: ocorrencia.status,
        prioridade: ocorrencia.priority,
        resolucao: ocorrencia.resolution_notes || '(não informada)',
      } : null,
      mensagens_chat: chatMessages.map(m => ({
        remetente: m.sender_name,
        funcao: m.sender_role,
        conteudo: m.content,
        horario: m.created_date,
      })),
    };

    const prompt = `Você é um oficial de polícia experiente e perito em redação jurídica. Sua tarefa é redigir um Boletim de Ocorrência oficial com base nos dados compilados de um atendimento de emergência policial.

DADOS DO ATENDIMENTO:
${JSON.stringify(contexto, null, 2)}

INSTRUÇÕES ESTRITAS:
Redija o Boletim de Ocorrência exatamente nas seguintes seções, usando linguagem formal, técnica e impessoal:

---

**I. DADOS DO ACIONAMENTO**
- Data e hora oficiais de Brasília do acionamento.
- Localização exata (latitude/longitude convertida para endereço descritivo, quando possível).
- Tipo de gatilho que acionou o sistema (CALCULADORA_PANICO, SENHA_COERCAO ou DESVIO_ROTA).
- Tempo estimado de resposta com base nos dados disponíveis.

**II. DINÂMICA DOS FATOS**
- Narrativa cronológica detalhada do incidente, reconstruída a partir da transcrição de áudio, tags acústicas e mensagens trocadas no chat de emergência.
- Descreva a sequência de eventos de forma objetiva: o que foi captado pelo áudio ambiente, gritos, menções a armas ou ameaças, e a evolução da situação.
- Inclua, se disponível, a interação entre o cidadão e os agentes no chat de primeiros socorros.

**III. EVIDÊNCIAS E ELEMENTOS MATERIAIS**
- Liste as tags acústicas extraídas pela IA (gritos, estresse, menção a arma).
- Descreva objetos ou situações relevantes identificados automaticamente.
- Mencione se há arquivos de mídia anexados (áudio, vídeo) e sua relevância probatória.

**IV. PROVIDÊNCIAS ADOTADAS**
- Classificação preliminar do incidente conforme o Código Penal Brasileiro.
- Órgãos acionados e medidas tomadas pela equipe de despacho.
- Desfecho da ocorrência e encaminhamento sugerido (delegacia, perícia, medida protetiva, etc.).

**V. CONCLUSÃO E ENCAMINHAMENTO**
- Resumo final e recomendação de encaminhamento do caso.
- Observações relevantes para a autoridade policial.

IMPORTANTE: 
- Se algum dado não estiver disponível, escreva "(não informado)" no campo.
- Mantenha o tom jurídico formal em todo o documento.
- O horário oficial é o de Brasília (GMT-3).
- Data atual de referência: ${new Date().toISOString()}`;

    // ── 5. Invoke Claude Sonnet 4.6 ──────────────────────
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    const textoJuridico = typeof llmResponse === 'string' ? llmResponse : llmResponse?.content || JSON.stringify(llmResponse);

    // ── 6. Create the BO record ──────────────────────────
    const bo = await base44.asServiceRole.entities.Boletins_Ocorrencia_Gerados.create({
      id_alerta: alertaId,
      id_ocorrencia: ocorrencia?.id || null,
      texto_juridico_bo: textoJuridico,
      tags_reconhecimento_visual: [],
      telemetria_iot: {},
      data_emissao: new Date().toISOString(),
      status_assinatura: 'rascunho',
    });

    return Response.json({ success: true, bo_id: bo.id, texto_juridico_bo: textoJuridico });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});