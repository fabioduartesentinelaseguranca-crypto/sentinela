/**
 * Motor de Entrada/Saída — Portão Escolar
 *
 * Recebe uma imagem do portão (base64 ou file_url), gera embedding via GPT-4o Vision,
 * executa matching por cosseno contra os alunos da escola,
 * salva o Registro_Acesso_Escolar e dispara alerta/email se o horário estiver fora do esperado.
 *
 * Payload:
 *  - file_url: string           — URL da imagem já uploaded
 *  - id_escola_cerca: string    — ID da escola/cerca
 *  - tipo_evento: "entrada" | "saida"
 *  - operador_id?: string       — ID do operador/agente (opcional)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Similaridade cosseno retorna 0–100
function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.round(((dot / (Math.sqrt(normA) * Math.sqrt(normB))) + 1) / 2 * 100);
}

// Verifica se o horário do evento está dentro da janela esperada (com tolerância)
function avaliarHorario(tipo_evento, horario_entrada, horario_saida, tolerancia_minutos) {
  if (!horario_entrada || !horario_saida) return { dentro_horario: true, motivo_alerta: null };

  const now = new Date();
  const minNow = now.getHours() * 60 + now.getMinutes();
  const tol = Number(tolerancia_minutos) || 15;

  const [hE, mE] = horario_entrada.split(':').map(Number);
  const [hS, mS] = horario_saida.split(':').map(Number);
  const minEntrada = hE * 60 + mE;
  const minSaida = hS * 60 + mS;

  if (tipo_evento === 'entrada') {
    const atraso = minNow - (minEntrada + tol);
    if (atraso > 0) return { dentro_horario: false, motivo_alerta: `Entrada com atraso de ${atraso} min além da tolerância.` };
    return { dentro_horario: true, motivo_alerta: null };
  }

  if (tipo_evento === 'saida') {
    const antecipacao = (minSaida - tol) - minNow;
    if (antecipacao > 0) return { dentro_horario: false, motivo_alerta: `Saída antecipada: ${antecipacao} min antes do horário permitido.` };

    const atraso = minNow - (minSaida + tol);
    if (atraso > 0) return { dentro_horario: false, motivo_alerta: `Saída com atraso crítico de ${atraso} min após tolerância.` };

    return { dentro_horario: true, motivo_alerta: null };
  }

  return { dentro_horario: true, motivo_alerta: null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, id_escola_cerca, tipo_evento, operador_id } = await req.json();

    if (!file_url || !id_escola_cerca || !tipo_evento) {
      return Response.json({ error: 'Parâmetros obrigatórios: file_url, id_escola_cerca, tipo_evento' }, { status: 400 });
    }

    // ── 1. GERAR EMBEDDING DO FRAME VIA GPT-4o Vision ──────────────
    const analise = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gpt_5_4',
      prompt: `Analise esta imagem de câmera de portão escolar e retorne JSON com:
- face_detected (boolean): há pelo menos um rosto humano visível?
- is_real_face (boolean): o rosto parece real (não foto/máscara/vídeo)?
- spoofing_type (string): "nenhum" se real
- embedding (array de 128 números entre -1 e 1): vetor facial das características do rosto (formato, olhos, nariz, boca). Se nenhum rosto, 128 zeros.
- quality_score (number 0-100): qualidade para reconhecimento`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          face_detected: { type: 'boolean' },
          is_real_face: { type: 'boolean' },
          spoofing_type: { type: 'string' },
          embedding: { type: 'array', items: { type: 'number' } },
          quality_score: { type: 'number' },
        },
      },
    });

    if (!analise.face_detected) {
      return Response.json({ status: 'sem_rosto', message: 'Nenhum rosto detectado no frame.' });
    }

    if (!analise.is_real_face) {
      return Response.json({ status: 'spoofing', spoofing_type: analise.spoofing_type, message: 'Tentativa de spoofing detectada.' });
    }

    const embedding = analise.embedding || [];

    // ── 2. BUSCAR ALUNOS DA ESCOLA ──────────────────────────────────
    const alunos = await base44.asServiceRole.entities.Alunos_Biometria.filter({ id_escola_cerca, ativo: true });

    let melhorMatch = null;
    let melhorSim = 0;

    for (const aluno of alunos) {
      if (!aluno.face_embedding?.length) continue;

      let sim = cosineSimilarity(embedding, aluno.face_embedding);

      // Testar também embedding com óculos se existir
      if (aluno.face_embedding_oculos?.length) {
        const simOc = cosineSimilarity(embedding, aluno.face_embedding_oculos);
        if (simOc > sim) sim = simOc;
      }

      if (sim > melhorSim) {
        melhorSim = sim;
        melhorMatch = aluno;
      }
    }

    const THRESHOLD = 70; // mínimo de similaridade para identificar

    if (!melhorMatch || melhorSim < THRESHOLD) {
      // Pessoa não identificada — não é aluno cadastrado
      return Response.json({
        status: 'nao_identificado',
        quality_score: analise.quality_score,
        melhor_sim: melhorSim,
        message: 'Nenhum aluno correspondente encontrado.',
      });
    }

    const aluno = melhorMatch;

    // ── 3. AVALIAR HORÁRIO ──────────────────────────────────────────
    const { dentro_horario, motivo_alerta } = avaliarHorario(
      tipo_evento,
      aluno.horario_entrada,
      aluno.horario_saida,
      aluno.tolerancia_minutos,
    );

    // ── 4. SALVAR REGISTRO DE ACESSO ────────────────────────────────
    const registro = await base44.asServiceRole.entities.Registros_Acesso_Escolar.create({
      id_aluno: aluno.id,
      nome_aluno: aluno.nome,
      matricula: aluno.matricula,
      id_escola_cerca,
      nome_escola: aluno.nome_escola || '',
      tipo_evento,
      data_hora: new Date().toISOString(),
      confianca_score: melhorSim,
      metodo: 'facial',
      dentro_horario,
      alerta_disparado: !dentro_horario,
      motivo_alerta: motivo_alerta || '',
      registrado_por_id: operador_id || user.id,
    });

    // ── 5. DISPARAR ALERTA AOS RESPONSÁVEIS (se fora do horário) ───
    if (!dentro_horario && aluno.responsaveis_ids?.length) {
      const responsaveis = await base44.asServiceRole.entities.Biometria_Responsaveis.filter({
        id_escola_cerca,
        ativo: true,
      });

      const responsaveisDoAluno = responsaveis.filter(r =>
        aluno.responsaveis_ids.includes(r.id) && r.matriculas_vinculadas?.includes(aluno.matricula)
      );

      const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const tipoLabel = tipo_evento === 'entrada' ? 'Entrada' : 'Saída';

      for (const resp of responsaveisDoAluno) {
        // Notificar via email (canal disponível na plataforma)
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: `${resp.nome_responsavel} <${resp.telefone || 'sem-email@sentinela.app'}>`,
          from_name: 'Sentinela — Alerta Escolar',
          subject: `⚠️ Alerta: ${tipoLabel} irregular de ${aluno.nome}`,
          body: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#dc2626;">⚠️ Alerta de ${tipoLabel} Escolar</h2>
              <p>Olá, <strong>${resp.nome_responsavel}</strong>.</p>
              <p>Foi registrada uma <strong>${tipoLabel.toLowerCase()} irregular</strong> de <strong>${aluno.nome}</strong> às <strong>${horaAtual}</strong>.</p>
              <div style="background:#fef2f2;border:1px solid #fecaca;padding:16px;border-radius:8px;margin:16px 0;">
                <strong>Motivo do alerta:</strong><br/>
                ${motivo_alerta}
              </div>
              <p><strong>Escola:</strong> ${aluno.nome_escola || id_escola_cerca}</p>
              <p><strong>Horário normal de ${tipo_evento}:</strong> ${tipo_evento === 'entrada' ? aluno.horario_entrada : aluno.horario_saida}</p>
              <p><strong>Confiança do reconhecimento:</strong> ${melhorSim}%</p>
              <hr style="margin:24px 0;"/>
              <p style="font-size:12px;color:#666;">Sentinela — Sistema de Segurança Escolar</p>
            </div>
          `,
        }).catch(() => {}); // email falhou silenciosamente — não bloquear o fluxo
      }
    }

    return Response.json({
      status: 'identificado',
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        matricula: aluno.matricula,
        foto_url: aluno.foto_url,
        horario_entrada: aluno.horario_entrada,
        horario_saida: aluno.horario_saida,
      },
      tipo_evento,
      confianca_score: melhorSim,
      dentro_horario,
      motivo_alerta,
      registro_id: registro.id,
      alerta_disparado: !dentro_horario,
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});