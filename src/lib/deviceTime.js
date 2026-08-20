/**
 * deviceTime.js
 * Sempre usa a data/hora do dispositivo (cliente), nunca do servidor.
 */

/** Retorna um objeto Date correspondente ao momento atual no dispositivo */
export function now() {
  return new Date();
}

/** Retorna string ISO 8601 do momento atual no dispositivo */
export function nowISO() {
  return new Date().toISOString();
}

/** Retorna data no formato "yyyy-MM-dd" usando o dispositivo */
export function todayDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Retorna timestamp numérico atual do dispositivo */
export function nowTimestamp() {
  return Date.now();
}

/**
 * Retorna a data/hora atual do dispositivo no horário oficial de Brasília
 * (America/Sao_Paulo) como string ISO 8601 com offset -03:00.
 * Brasil não usa horário de verão desde 2019, logo o offset é fixo.
 */
export function brasiliaNowISO() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => {
    const v = parts.find((p) => p.type === t)?.value || "00";
    return t === "year" ? v : v.padStart(2, "0");
  };
  let h = get("hour");
  if (h === "24") h = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${h}:${get("minute")}:${get("second")}-03:00`;
}

/**
 * Converte um timestamp ISO (UTC sem sufixo ou com offset) para horário
 * oficial de Brasília (ISO com offset -03:00). Usado no backfill de registros
 * antigos cujo created_date foi gravado em UTC sem marcador de fuso.
 */
export function toBrasiliaISO(iso) {
  if (!iso) return null;
  const hasTz = /[zZ]$/.test(iso) || /[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : iso + "Z");
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => {
    const v = parts.find((p) => p.type === t)?.value || "00";
    return t === "year" ? v : v.padStart(2, "0");
  };
  let h = get("hour");
  if (h === "24") h = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${h}:${get("minute")}:${get("second")}-03:00`;
}

/**
 * Formata o horário de uma ocorrência no fuso oficial de Brasília
 * (America/Sao_Paulo) SEM depender do fuso do dispositivo/navegador.
 * Garante exibição consistente em qualquer dispositivo.
 */
export function formatBrasilia(occ, pattern = "dd/MM/yyyy HH:mm") {
  const d = occurrenceTime(occ);
  if (!d || isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "00";
  let h = get("hour");
  if (h === "24") h = "00";
  const dd = get("day"), mm = get("month"), yyyy = get("year"), mi = get("minute"), s = get("second");
  switch (pattern) {
    case "dd/MM HH:mm": return `${dd}/${mm} ${h}:${mi}`;
    case "dd/MM/yyyy HH:mm": return `${dd}/${mm}/${yyyy} ${h}:${mi}`;
    case "dd/MM yyyy HH:mm": return `${dd}/${mm} ${yyyy} ${h}:${mi}`;
    case "dd/MM/yyyy HH:mm:ss": return `${dd}/${mm}/${yyyy} ${h}:${mi}:${s}`;
    default: return `${dd}/${mm}/${yyyy} ${h}:${mi}`;
  }
}

/**
 * Retorna o Date correto do horário de uma ocorrência.
 * Prioriza data_hora_dispositivo (Brasília). Fallback: created_date em UTC
 * (sem sufixo) é interpretado como UTC para evitar deslocamento de fuso.
 */
export function occurrenceTime(occ) {
  if (!occ) return new Date(NaN);
  if (occ.data_hora_dispositivo) return new Date(occ.data_hora_dispositivo);
  const cd = occ.created_date;
  if (cd && !/[zZ]$/.test(cd) && !/[+-]\d{2}:?\d{2}$/.test(cd)) return new Date(cd + "Z");
  return new Date(cd);
}