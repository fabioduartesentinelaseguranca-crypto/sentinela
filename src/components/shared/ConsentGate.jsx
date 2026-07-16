import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Shield, Lock, FileText, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Gate de consentimento LGPD.
 * Bloqueia o acesso do cidadão até que ele leia e concorde com:
 *  - Termos e Condições de Uso
 *  - Política de Privacidade
 * O aceite é persistido no perfil do usuário (base44.auth.updateMe).
 */
export default function ConsentGate({ children }) {
  const { user, refreshUser } = useAuth();
  const [aceitou, setAceitou] = useState(null); // null = carregando
  const [termosLido, setTermosLido] = useState(false);
  const [privacidadeLido, setPrivacidadeLido] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState("");
  const termosRef = useRef(null);
  const privacidadeRef = useRef(null);

  useEffect(() => {
    if (user) setAceitou(!!user.termos_aceitos);
  }, [user]);

  const verificarScroll = (ref, setter) => {
    const el = ref.current;
    if (!el) return;
    const noFundo = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (noFundo) setter(true);
  };

  const concordar = async () => {
    setErro("");
    setAceitando(true);
    try {
      await base44.auth.updateMe({
        termos_aceitos: true,
        termos_aceitos_em: new Date().toISOString(),
        termos_versao: "1.0",
      });
      await refreshUser();
    } catch (err) {
      setErro("Não foi possível registrar seu aceite. Tente novamente.");
    } finally {
      setAceitando(false);
    }
  };

  if (aceitou === null || aceitou) return children;

  const podeConcordar = termosLido && privacidadeLido && !aceitando;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
      <div className="max-w-3xl w-full rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="border-b border-border/40 bg-gradient-to-b from-primary/10 to-transparent px-6 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Bem-vindo ao Sentinela</h1>
            <p className="text-xs text-muted-foreground">
              Antes de começar, leia e concorde com nossa documentação legal.
            </p>
          </div>
        </div>

        {/* Documentos */}
        <div className="p-6 space-y-5 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {/* Termos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Termos e Condições de Uso
              </h2>
              <a
                href="/termos"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Abrir em tela cheia <ChevronDown className="w-3 h-3 -rotate-90" />
              </a>
            </div>
            <div
              ref={termosRef}
              onScroll={(e) => verificarScroll(termosRef, setTermosLido)}
              className="h-44 overflow-y-auto scrollbar-thin rounded-lg border border-border/50 bg-background/60 p-3 text-xs text-muted-foreground leading-relaxed"
            >
              <p className="mb-2"><strong className="text-foreground">1. Natureza complementar.</strong> O Sentinela é uma ferramenta complementar de segurança pública e <strong>não substitui</strong> os canais oficiais de emergência 190 (Polícia), 192 (SAMU) e 193 (Bombeiros). Em emergências reais, ligue primeiro.</p>
              <p className="mb-2"><strong className="text-foreground">2. Responsabilidade do Cidadão.</strong> O usuário concorda em fornecer informações verdadeiras. Denúncias falsas e trotes configuram ilícito (arts. 339-340 do CP) e geram banimento imediato e encaminhamento às autoridades.</p>
              <p className="mb-2"><strong className="text-foreground">3. Responsabilidade do Agente Público.</strong> Agentes declaram atuar no exercício regular da função e são responsáveis pelas informações registradas.</p>
              <p className="mb-2"><strong className="text-foreground">4. Tratamento de dados.</strong> A coleta e o tratamento seguem a LGPD, detalhados na Política de Privacidade.</p>
              <p className="mb-2"><strong className="text-foreground">5. Disponibilidade.</strong> Não garantimos disponibilidade ininterrupta; falhas técnicas não geram indenização.</p>
              <p><strong className="text-foreground">6. Foro.</strong> Fica eleita a Comarca de São Bernardo do Campo — SP para dirimir controvérsias.</p>
              <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                {termosLido ? "✓ Leitura concluída" : "Role até o fim para confirmar a leitura"}
              </p>
            </div>
          </div>

          {/* Privacidade */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Política de Privacidade (LGPD)
              </h2>
              <a
                href="/privacidade"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Abrir em tela cheia <ChevronDown className="w-3 h-3 -rotate-90" />
              </a>
            </div>
            <div
              ref={privacidadeRef}
              onScroll={(e) => verificarScroll(privacidadeRef, setPrivacidadeLido)}
              className="h-44 overflow-y-auto scrollbar-thin rounded-lg border border-border/50 bg-background/60 p-3 text-xs text-muted-foreground leading-relaxed"
            >
              <p className="mb-2"><strong className="text-foreground">1. Dados coletados.</strong> Nome, CPF, cargo/matrícula (agentes), geolocalização precisa em tempo real, fotos, áudios e vídeos anexados aos chamados, além de dados biométricos faciais.</p>
              <p className="mb-2"><strong className="text-foreground">2. Dados sensíveis.</strong> Dados de saúde e segurança são tratados com base no interesse público e na tutela da vida (arts. 7º, I e III, e 11, II, “d”, LGPD).</p>
              <p className="mb-2"><strong className="text-foreground">3. Sigilo e anonimato.</strong> Denúncias anônimas são protegidas. O acesso à identidade do denunciante é restrito a autoridades competentes, mediante ordem judicial.</p>
              <p className="mb-2"><strong className="text-foreground">4. Segurança.</strong> Os dados trafegam criptografados e são armazenados em servidores seguros, com auditoria de acesso.</p>
              <p className="mb-2"><strong className="text-foreground">5. Direitos do titular.</strong> Acesso, correção, eliminação e portabilidade podem ser solicitados ao Encarregado (DPO).</p>
              <p><strong className="text-foreground">6. Foro.</strong> Comarca de São Bernardo do Campo — SP.</p>
              <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                {privacidadeLido ? "✓ Leitura concluída" : "Role até o fim para confirmar a leitura"}
              </p>
            </div>
          </div>
        </div>

        {/* Consentimento */}
        <div className="border-t border-border/40 px-6 py-4 space-y-3 bg-muted/30">
          <div className="flex items-start gap-3">
            <Checkbox
              id="aceite"
              checked={termosLido && privacidadeLido}
              disabled={!termosLido || !privacidadeLido}
              onCheckedChange={() => {}}
              className="mt-0.5"
            />
            <label htmlFor="aceite" className="text-xs text-muted-foreground leading-relaxed">
              Li os <strong className="text-foreground">Termos e Condições de Uso</strong> e a{" "}
              <strong className="text-foreground">Política de Privacidade</strong> do Sentinela e declaro estar
              ciente e de acordo com as condições descritas, incluindo o tratamento dos meus dados pessoais e
              sensíveis conforme a LGPD.
            </label>
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}

          <Button
            onClick={concordar}
            disabled={!podeConcordar}
            className="w-full h-10"
          >
            {aceitando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Registrando aceite...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Concordar e Continuar</>
            )}
          </Button>
          {!podeConcordar && !aceitando && (
            <p className="text-[11px] text-center text-muted-foreground">
              Role ambos os documentos até o fim para habilitar o botão.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}