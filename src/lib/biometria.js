import { base44 } from "@/api/base44Client";

/**
 * Verifica conflito biométrico contra cadastros existentes antes de salvar.
 * Retorna { conflict, similarity, matched_name, matched_id, scope }.
 * Em caso de falha de rede, não bloqueia o cadastro (retorna conflict:false).
 */
export async function verificarConflitoBiometria(embedding, escopos = ["alunos", "blacklist", "procurados"]) {
  if (!Array.isArray(embedding) || embedding.length < 32) return { conflict: false };
  try {
    const resp = await base44.functions.invoke("verificarConflitoBiometria", { embedding, escopos });
    return resp.data || { conflict: false };
  } catch {
    return { conflict: false };
  }
}

/**
 * Helper de formulário: retorna true se o cadastro deve ser BLOQUEADO por conflito.
 * Já exibe o toast de erro padronizado.
 */
export async function bloquearSeConflito(embedding, escopos) {
  const c = await verificarConflitoBiometria(embedding, escopos);
  if (c.conflict) {
    const { toast } = await import("sonner");
    toast.error(
      `Conflito Biométrico: esta estrutura facial é muito similar a "${c.matched_name}" (${c.similarity}%). ` +
      `Tire outra foto com iluminação ou ângulo diferentes para evitar falsos positivos.`
    );
    return true;
  }
  return false;
}