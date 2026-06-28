import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { responsavelId } = body;

    if (!responsavelId) {
      return Response.json({ error: 'responsavelId obrigatório' }, { status: 400 });
    }

    // Buscar o responsável recém criado
    const responsavel = await base44.asServiceRole.entities.Biometria_Responsaveis.get(responsavelId);
    if (!responsavel) return Response.json({ error: 'Responsável não encontrado' }, { status: 404 });

    // Buscar admins para notificar
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    const alunosStr = responsavel.alunos_nomes?.join(', ') || 'Não identificados';
    const matriculasStr = responsavel.matriculas_vinculadas?.join(', ') || 'Não informadas';
    const temBio = (responsavel.face_embedding?.length || 0) > 0;

    const subject = `[Sentinela] Novo Responsável Cadastrado: ${responsavel.nome_responsavel}`;
    const body_email = `
      <h2>Novo Responsável Biométrico Cadastrado</h2>
      <table style="border-collapse:collapse; width:100%; font-family:sans-serif; font-size:14px;">
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Nome</td><td style="padding:8px;">${responsavel.nome_responsavel}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Parentesco</td><td style="padding:8px;">${responsavel.parentesco || '—'}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Telefone</td><td style="padding:8px;">${responsavel.telefone || '—'}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Escola</td><td style="padding:8px;">${responsavel.nome_escola || '—'}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Alunos Vinculados</td><td style="padding:8px;">${alunosStr}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Matrículas</td><td style="padding:8px;">${matriculasStr}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Biometria</td><td style="padding:8px; color:${temBio ? 'green' : 'orange'};">${temBio ? '✓ Cadastrada' : '⚠ Não cadastrada'}</td></tr>
        <tr><td style="padding:8px; background:#f5f5f5; font-weight:bold;">Cadastrado por</td><td style="padding:8px;">${responsavel.cadastrado_por_nome || user.full_name}</td></tr>
      </table>
      <p style="margin-top:16px; font-size:12px; color:#888;">Acesse o painel de administração do Sentinela para validar o vínculo biométrico.</p>
    `;

    const emailPromises = admins.map(admin =>
      base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject,
        body: body_email,
        from_name: 'Sentinela — Segurança Escolar',
      })
    );

    await Promise.allSettled(emailPromises);

    return Response.json({ ok: true, notificados: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});