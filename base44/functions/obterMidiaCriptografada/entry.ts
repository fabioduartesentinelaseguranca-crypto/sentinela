import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // Apenas agentes e admins podem acessar mídias criptografadas
    if (user.role !== 'agent' && user.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a agentes e administradores' }, { status: 403 });
    }

    const body = await req.json();
    const { file_uri } = body;

    if (!file_uri) {
      return Response.json({ error: 'file_uri é obrigatório' }, { status: 400 });
    }

    // Gera URL assinada com validade de 5 minutos (custódia legal)
    const result = await base44.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 300,
    });

    return Response.json({
      signed_url: result.signed_url,
      expires_em_segundos: 300,
      acessado_por: user.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});