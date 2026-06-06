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