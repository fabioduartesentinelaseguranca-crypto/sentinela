import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, Lock, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Gate de consentimento para Agentes Públicos.
 * Bloqueia o acesso (agentes e operadores) até a leitura e aceite do
 * Termo de Responsabilidade e Confidencialidade.
 * Persiste o aceite no perfil do usuário via base44.auth.updateMe.
 */
export default function AgentConsentGate({ children }) {
  const { user, refreshUser } = useAuth();
  const [aceitou, setAceitou] = useState(null);
  const [lido, setLido] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState("");
  const termoRef = useRef(null);

  useEffect(() => {
    if (user) setAceitou(!!user.termo_confidencialidade_aceito);
  }, [user]);

  const verificarScroll = () => {
    const el = termoRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLido(true);
  };

  const concordar = async () => {
    setErro("");
    setAceitando(true);
    try {
      await base44.auth.updateMe({
        termo_confidencialidade_aceito: true,
        termo_confidencialidade_aceito_em: new Date().toISOString(),
        termo_confidencialidade_versao: "1.0",
      });
      await refreshUser();
    } catch (err) {
      setErro("Não foi possível registrar seu aceite. Tente novamente.");
    } finally {
      setAceitando(false);
    }
  };

  if (aceitou === null || aceitou) return children;

  const podeConcordar = lido && !aceitando;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
      <div className="max-w-3xl w-full rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="border-b border-border/40 bg-gradient-to-b from-destructive/10 to-transparent px-6 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Termo de Responsabilidade e Confidencialidade</h1>
            <p className="text-xs text-muted-foreground">
              Leitura e aceite obrigatórios para agentes públicos no primeiro acesso.
            </p>
          </div>
        </div>

        {/* Documento */}
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-destructive" /> Termo de Confidencialidade
              </h2>
              <a
                href="/termo-agentes"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Abrir em tela cheia <ChevronDown className="w-3 h-3 -rotate-90" />
              </a>
            </div>
            <div
              ref={termoRef}
              onScroll={verificarScroll}
              className="h-72 overflow-y-auto scrollbar-thin rounded-lg border border-border/50 bg-background/60 p-4 text-xs text-muted-foreground leading-relaxed"
            >
              <p className="mb-2"><strong className="text-foreground">Cláusula 1 — Dever de Sigilo Absoluto.</strong> O Agente Público compromete-se a manter sigilo absoluto sobre todas as denúncias, identidades de cidadãos e dados de ocorrências visualizados no app, durante e após o exercício da função (art. 325, CP).</p>
              <p className="mb-2"><strong className="text-foreground">Cláusula 2 — Proibições.</strong> É expressamente proibido: extrair prints ou fotografar a tela; compartilhar informações em redes sociais ou aplicativos de mensagem; vazar dados para terceiros; copiar ou exportar mídias para dispositivos pessoais; usar as informações fora do exercício regular da função.</p>
              <p className="mb-2"><strong className="text-foreground">Cláusula 3 — Sanções.</strong> O descumprimento ensejará processo administrativo disciplinar (PAD) junto ao órgão de origem (Lei nº 8.112/90 ou estatuto aplicável), além de sanções civis (art. 927, CC) e penais (arts. 153, 325 e 325-A, CP, e LGPD), com comunicação à corregedoria e ao Ministério Público.</p>
              <p className="mb-2"><strong className="text-foreground">Cláusula 4 — Foro.</strong> Eleição da Comarca de São Bernardo do Campo — SP, com renúncia a qualquer outro, ressalvadas as competências absolutas e originárias dos Tribunais Superiores.</p>
              <p className="mt-3 text-center text-[10px] text-muted-foreground/70">
                {lido ? "✓ Leitura concluída" : "Role até o fim para confirmar a leitura"}
              </p>
            </div>
          </div>
        </div>

        {/* Consentimento */}
        <div className="border-t border-border/40 px-6 py-4 space-y-3 bg-muted/30">
          <div className="flex items-start gap-3">
            <Checkbox
              id="aceite-agente"
              checked={lido}
              disabled={!lido}
              onCheckedChange={() => {}}
              className="mt-0.5"
            />
            <label htmlFor="aceite-agente" className="text-xs text-muted-foreground leading-relaxed">
              Li o <strong className="text-foreground">Termo de Responsabilidade e Confidencialidade</strong> e
              declaro estar ciente do meu dever de sigilo absoluto, das proibições de extração e
              compartilhamento de informações, e das sanções administrativas, civis e penais pelo
              descumprimento.
            </label>
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}

          <Button onClick={concordar} disabled={!podeConcordar} className="w-full h-10">
            {aceitando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Registrando aceite...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Concordar e Continuar</>
            )}
          </Button>
          {!podeConcordar && !aceitando && (
            <p className="text-[11px] text-center text-muted-foreground">
              Role o documento até o fim para habilitar o botão.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}