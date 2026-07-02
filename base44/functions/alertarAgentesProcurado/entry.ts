/**
 * alertarAgentesProcurado
 *
 * Chamado quando há match de procurado nas câmeras de rua.
 * Envia email de alerta vermelho para todos os agentes em turno ativo.
 *
 * Payload:
 *  - criminal_name: string
 *  - criminal_alias?: string
 *  - similarity: number (0-100)
 *  - camera_id: string
 *  - foto_capturada_url?: string
 *  - foto_referencia_url?: string
 *  - danger_level: string
 *  - crimes?: string[]
 *  - alert_id: string
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      criminal_name, criminal_alias, similarity, camera_id,
      foto_capturada_url, foto_referencia_url, danger_level,
      crimes, alert_id
    } = await req.json();

    if (!criminal_name || !camera_id) {
      return Response.json({ error: 'criminal_name e camera_id são obrigatórios' }, { status: 400 });
    }

    // Buscar agentes com turno ativo
    const turnos = await base44.asServiceRole.entities.Shift.filter({ status: 'active' });
    if (!turnos.length) {
      return Response.json({ enviados: 0, message: 'Nenhum agente com turno ativo' });
    }

    const agentIds = [...new Set(turnos.map(t => t.agent_id).filter(Boolean))];
    const agentes = await base44.asServiceRole.entities.User.filter({ role: 'agent' });
    const agentesAtivos = agentes.filter(a => agentIds.includes(a.id) && a.email);

    const horaAlerta = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const nivelLabel = { low: 'Baixo', medium: 'Médio', high: 'Alto', extreme: 'EXTREMO' }[danger_level] || danger_level;
    const crimesStr = Array.isArray(crimes) ? crimes.join(', ') : (crimes || 'Não informado');

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#e5e5e5;border-radius:12px;overflow:hidden;">
        <div style="background:#dc2626;padding:20px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">🔴 ALERTA VERMELHO — PROCURADO IDENTIFICADO</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${horaAlerta}</p>
        </div>
        <div style="padding:24px;space-y:16px;">
          <div style="background:#1f1f1f;border:2px solid #dc2626;border-radius:8px;padding:16px;margin-bottom:16px;">
            <h2 style="color:#f87171;margin:0 0 8px;">${criminal_name}${criminal_alias ? ` — "${criminal_alias}"` : ''}</h2>
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Similaridade:</strong> ${similarity}%</p>
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Câmera:</strong> ${camera_id}</p>
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Periculosidade:</strong> ${nivelLabel}</p>
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">Crimes:</strong> ${crimesStr}</p>
            <p style="margin:4px 0;color:#d1d5db;"><strong style="color:#e5e5e5;">ID do Alerta:</strong> ${alert_id}</p>
          </div>
          ${foto_capturada_url || foto_referencia_url ? `
          <div style="display:flex;gap:16px;margin-bottom:16px;">
            ${foto_capturada_url ? `<div style="flex:1;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin-bottom:8px;">📸 Capturada na câmera</p><img src="${foto_capturada_url}" style="width:100%;border-radius:8px;border:2px solid #dc2626;" /></div>` : ''}
            ${foto_referencia_url ? `<div style="flex:1;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin-bottom:8px;">🗃️ Foto de referência</p><img src="${foto_referencia_url}" style="width:100%;border-radius:8px;border:2px solid #6b7280;" /></div>` : ''}
          </div>` : ''}
          <div style="background:#7f1d1d;border-radius:8px;padding:16px;text-align:center;">
            <p style="color:white;font-weight:bold;margin:0;">⚠️ PROCEDA COM MÁXIMO CUIDADO — NÃO ABORDE SOZINHO</p>
            <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:8px 0 0;">Acesse o app Sentinela para mais detalhes e coordene com a central.</p>
          </div>
        </div>
        <div style="padding:16px;text-align:center;border-top:1px solid #374151;">
          <p style="color:#6b7280;font-size:11px;margin:0;">Sentinela — Sistema de Segurança Pública • Alerta automático gerado por IA</p>
        </div>
      </div>
    `;

    let enviados = 0;
    for (const agente of agentesAtivos) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: agente.email,
          from_name: 'Sentinela — ALERTA VERMELHO',
          subject: `🔴 PROCURADO IDENTIFICADO: ${criminal_name} — Câmera ${camera_id}`,
          body: html,
        });
        enviados++;
      } catch { /* não bloquear por email individual falho */ }
    }

    return Response.json({ enviados, agentes_total: agentesAtivos.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});