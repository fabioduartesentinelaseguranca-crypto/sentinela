import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

function calcAgentScore(resolved, avgResponseMin, positiveFeedbacks, avgRating) {
  const responseBonus = avgResponseMin > 0 ? Math.max(0, 60 - avgResponseMin) * 2 : 0;
  return (resolved * 10) + responseBonus + (positiveFeedbacks * 5) + (avgRating * 10);
}

function diffMin(a, b) {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.round(ms / 60000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [allUsers, logs, occs, feedbacks] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.PointsLog.list('-created_date', 1000),
      base44.asServiceRole.entities.Occurrence.list('-created_date', 500),
      base44.asServiceRole.entities.CitizenFeedback.list('-created_date', 500),
    ]);

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

    const citizenRanked = allUsers
      .filter((u) => (u.role === 'citizen' || !u.role) && (pointsMap[u.id] || 0) > 0)
      .map((u) => {
        const logPts = logs.filter((l) => l.user_id === u.id).reduce((a, l) => a + (l.points || 0), 0);
        const myOccs = occs.filter((o) => o.reporter_id === u.id);
        return {
          id: u.id,
          full_name: u.full_name,
          computedPoints: pointsMap[u.id] || 0,
          occTotal: myOccs.length,
          occResolved: myOccs.filter((o) => o.status === 'resolved').length,
          bonusPts: logPts,
        };
      })
      .sort((a, b) => b.computedPoints - a.computedPoints);

    // === Ranking de agentes ===
    const agents = allUsers.filter((u) => u.role === 'agent');
    const agentRanked = agents.map((agent) => {
      const assigned = occs.filter((o) => o.assigned_agent_id === agent.id);
      const inProgress = assigned.filter((o) => o.status === 'in_progress');
      const resolved = assigned.filter((o) => o.status === 'resolved');
      const times = resolved
        .filter((o) => o.updated_date && o.created_date)
        .map((o) => diffMin(o.updated_date, o.created_date))
        .filter((t) => t > 0 && t < 600);
      const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
      const agentFbs = feedbacks.filter((f) => f.agent_id === agent.id);
      const avgRating = agentFbs.length ? agentFbs.reduce((a, b) => a + (b.rating || 0), 0) / agentFbs.length : 0;
      const positiveFbs = agentFbs.filter((f) => f.rating >= 4).length;
      const baseScore = calcAgentScore(resolved.length, avgTime, positiveFbs, avgRating);
      const score = baseScore + inProgress.length * 3;
      return {
        id: agent.id,
        full_name: agent.full_name,
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

    // Cidadão vê apenas sua própria pontuação e posição
    if (role === 'citizen') {
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