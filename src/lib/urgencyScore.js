/**
 * Urgency scoring system for occurrences.
 * Higher score = higher priority in agent queue.
 */

// Base score by type
const TYPE_SCORE = {
  panic: 100,
  crime: 60,
  health: 50,
  civil_defense: 35,
  traffic: 20,
};

// Multiplier by priority field
const PRIORITY_MULTIPLIER = {
  critical: 2.5,
  high: 1.8,
  medium: 1.0,
  low: 0.6,
};

// Bonus by subtype keywords
const SUBTYPE_BONUS = {
  "Homicídio": 40,
  "Roubo a mão armada": 30,
  "Sequestro": 40,
  "Estupro": 35,
  "SAMU": 30,
  "Infarto": 30,
  "Acidente com vítima": 25,
  "Enchente": 20,
  "Desabamento": 25,
};

/**
 * Returns a numeric urgency score for an occurrence.
 * @param {object} occurrence
 * @param {object[]} reporterOccurrences - past occurrences by same reporter
 */
export function calcUrgencyScore(occurrence, reporterOccurrences = []) {
  const base = TYPE_SCORE[occurrence.type] ?? 30;
  const multiplier = PRIORITY_MULTIPLIER[occurrence.priority] ?? 1.0;
  const subtypeBonus = SUBTYPE_BONUS[occurrence.subtype] ?? 0;

  // Reporter credibility: more resolved reports = higher trust bonus
  const resolvedByReporter = reporterOccurrences.filter((o) => o.status === "resolved").length;
  const reporterBonus = Math.min(resolvedByReporter * 3, 30); // max +30

  // Time decay: older unattended occurrences gain urgency (+1 per minute, max +60)
  const ageMinutes = (Date.now() - new Date(occurrence.created_date).getTime()) / 60000;
  const ageBonus = Math.min(Math.floor(ageMinutes), 60);

  const total = Math.round(base * multiplier + subtypeBonus + reporterBonus + ageBonus);
  return total;
}

/**
 * Sorts occurrences by urgency score descending.
 * Filters out resolved ones.
 */
export function sortByUrgency(occurrences, allOccurrences = []) {
  const active = occurrences.filter((o) => o.status !== "resolved" && o.status !== "canceled");

  return active
    .map((o) => {
      const reporterHistory = allOccurrences.filter((x) => x.reporter_id === o.reporter_id);
      return { ...o, _urgencyScore: calcUrgencyScore(o, reporterHistory) };
    })
    .sort((a, b) => b._urgencyScore - a._urgencyScore);
}

/**
 * Returns a label + color class for urgency score.
 */
export function urgencyLabel(score) {
  if (score >= 160) return { label: "CRÍTICO", cls: "bg-emergency text-white" };
  if (score >= 100) return { label: "ALTO", cls: "bg-warning/20 text-warning border border-warning/40" };
  if (score >= 60)  return { label: "MÉDIO", cls: "bg-primary/20 text-primary border border-primary/30" };
  return { label: "BAIXO", cls: "bg-muted text-muted-foreground" };
}