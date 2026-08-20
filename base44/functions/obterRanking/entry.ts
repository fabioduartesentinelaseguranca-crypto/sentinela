import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

function calcAgentScore(resolved, avgResponseMin, positiveFeedbacks, avgRating) {
  const responseBonus = avgResponseMin > 0 ? Math.max(0, 60 - avgResponseMin) * 2 : 0;
  return (resolved * 10) + responseBonus + (positiveFeedbacks * 5) + (avgRating * 10);
}

function diffMin(a, b) {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.round(ms / 60000);
}

const NON_CITIZEN_ROLES = ['agent', 'admin', 'psychologist'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca todos os dados com service role (bypassa RLS). Cada fetch tem
    // fallback individual para que uma falha não zere todo o ranking.
    const [allUsers, logs, occs, feedbacks] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.PointsLog.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.Occurrence.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.CitizenFeedback.list('-created_date', 500).catch(() => []),
    ]);

    // Mapas de nome e role construídos a partir de User.list E PointsLog
    // (PointsLog.user_name garante nomes mesmo se User.list for restrito)
    const nameMap = {};
    const roleMap = {};
    allUsers.forEach((u) => {
      if (u.id) {
        if (u.full_name) nameMap[u.id] = u.full_name;
        roleMap[u.id] = u.role;
      }
    });
    logs.forEach((l) => {
      if (l.user_id && l.user_name && !nameMap[l.user_id]) nameMap[l.user_id] = l.user_name;
    });

    // === Ranking de cidadãos ===
    const pointsMap = {};
    logs.forEach((l) => {
      if (l.user_id) pointsMap[l.user_id] = (pointsMap[l.user_id] || 0) + (l.points || 0);
    });
    const occsCounted = new Set(logs.filter((l) => l.occurrence_id).map((l) => l.occurrence_id));
    occs.forEach((o) => {
      if (!o.reporter_id || occsCounted.has(o.id)) return;
      const pts = o.status === 'resolved' ? 25 : o.status === 'in_progress' ? 10 : 5;
      pointsMap[o.reporter_id] = (pointsMap[o.reporter_id] || 0) + pts;
    });
    allUsers.forEach((u) => {
      if (!pointsMap[u.id] && (u.points || 0) > 0) pointsMap[u.id] = u.points;
    });

    // Candidatos a cidadão: todo user_id com pontos (de PointsLog/Occurrence/User.points)
    const citizenIds = new Set(Object.keys(pointsMap));
    allUsers.forEach((u) => {
      if (!NON_CITIZEN_ROLES.includes(u.role) && (pointsMap[u.id] || 0) > 0) citizenIds.add(u.id);
    });

    // Apenas IDs de usuários reais (presentes em User.list ou PointsLog) —
    // evita entradas fantasmas como reporter_id "system"
    const knownUserIds = new Set([...allUsers.map((u) => u.id), ...logs.map((l) => l.user_id)]);

    const citizenRanked = [...citizenIds]
      .filter((id) => knownUserIds.has(id))
      .filter((id) => !NON_CITIZEN_ROLES.includes(roleMap[id]))
      .filter((id) => (pointsMap[id] || 0) > 0)
      .map((id) => {
        const logPts = logs.filter((l) => l.user_id === id).reduce((a, l) => a + (l.points || 0), 0);
        const myOccs = occs.filter((o) => o.reporter_id === id);
        return {
          id,
          full_name: nameMap[id] || 'Cidadão',
          computedPoints: pointsMap[id] || 0,
          occTotal: myOccs.length,
          occResolved: myOccs.filter((o) => o.status === 'resolved').length,
          bonusPts: logPts,
        };
      })
      .sort((a, b) => b.computedPoints - a.computedPoints);

    // === Ranking de agentes ===
    const agentIds = new Set(allUsers.filter((u) => u.role === 'agent').map((u) => u.id));
    // Inclui também users com role 'agent' conhecidos via roleMap
    Object.keys(roleMap).forEach((id) => { if (roleMap[id] === 'agent') agentIds.add(id); });

    const agentRanked = [...agentIds].map((id) => {
      const assigned = occs.filter((o) => o.assigned_agent_id === id);
      const inProgress = assigned.filter((o) => o.status === 'in_progress');
      const resolved = assigned.filter((o) => o.status === 'resolved');
      const times = resolved
        .filter((o) => o.updated_date && o.created_date)
        .map((o) => diffMin(o.updated_date, o.created_date))
        .filter((t) => t > 0 && t < 600);
      const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
      const agentFbs = feedbacks.filter((f) => f.agent_id === id);
      const avgRating = agentFbs.length ? agentFbs.reduce((a, b) => a + (b.rating || 0), 0) / agentFbs.length : 0;
      const positiveFbs = agentFbs.filter((f) => f.rating >= 4).length;
      const baseScore = calcAgentScore(resolved.length, avgTime, positiveFbs, avgRating);
      const score = baseScore + inProgress.length * 3;
      return {
        id,
        full_name: nameMap[id] || 'Agente',
        assignedCount: assigned.length,
        resolvedCount: resolved.length,
        inProgressCount: inProgress.length,
        avgTime,
        avgRating,
        positiveFbs,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    const role = user.role || 'citizen';
    const isCitizenRole = !NON_CITIZEN_ROLES.includes(role);

    // Cidadão vê apenas sua própria pontuação e posição
    if (isCitizenRole) {
      const idx = citizenRanked.findIndex((c) => c.id === user.id);
      const myEntry = idx >= 0
        ? { ...citizenRanked[idx], position: idx + 1, total: citizenRanked.length }
        : {
            id: user.id,
            full_name: user.full_name,
            computedPoints: 0,
            occTotal: 0,
            occResolved: 0,
            bonusPts: 0,
            position: null,
            total: citizenRanked.length,
          };
      return Response.json({ role: 'citizen', myEntry });
    }

    // Agente ou admin vê o ranking geral completo (cidadãos + agentes)
    return Response.json({ role, citizens: citizenRanked, agents: agentRanked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});