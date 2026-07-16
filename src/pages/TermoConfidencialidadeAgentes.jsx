import { Lock, ShieldAlert, FileText, Gavel, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TermoConfidencialidadeAgentes() {
  const hoje = "16 de julho de 2026";

  return (
    <div className="min-h-screen bg-background">
      {/* Cabeçalho */}
      <div className="border-b border-border/40 bg-gradient-to-b from-destructive/10 to-background">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Termo de Responsabilidade e Confidencialidade</h1>
              <p className="text-sm text-muted-foreground">Agentes Públicos · Plataforma Sentinela · Versão 1.0 · {hoje}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-3 py-1 font-medium">
              <Lock className="w-3.5 h-3.5" /> Documento obrigatório
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-medium">
              <Gavel className="w-3.5 h-3.5" /> Foro: São Bernardo do Campo — SP
            </span>
          </div>
        </div>
      </div>

      {/* Corpo */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 text-sm md:text-base leading-relaxed">

        {/* Considerandos */}
        <div className="bg-muted/40 border-l-4 border-destructive rounded-r-xl p-5">
          <h2 className="font-semibold text-base mb-2 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-destructive" /> Considerandos
          </h2>
          <p className="text-muted-foreground">
            Este Termo de Responsabilidade e Confidencialidade (“Termo”) aplica-se obrigatoriamente a todos os
            <strong className="text-foreground"> policiais, guardas civis, agentes de saúde e operadores de
            monitoramento</strong> que utilizem a plataforma <strong className="text-foreground">Sentinela</strong>
            (“Plataforma”). A aceitação expressa deste Termo é condição indispensável para o acesso e a
            utilização do sistema, sendo exigida no primeiro acesso e sempre que atualizada.
          </p>
        </div>

        {/* Cláusula 1 — Sigilo */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5 text-destructive" />
            Cláusula 1 — Dever de Sigilo Absoluto
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">1.1.</strong> O Agente Público compromete-se a manter
              <strong className="text-foreground"> sigilo absoluto</strong> sobre todas as informações às quais
              tiver acesso em razão da utilização da Plataforma, incluindo, sem limitação:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Denúncias</strong> e respectivos conteúdos, anexos e metadados;</li>
              <li><strong className="text-foreground">Identidades de cidadãos</strong> denunciantes, vítimas, suspeitos e testemunhas;</li>
              <li><strong className="text-foreground">Dados de ocorrências</strong> visualizados no app, inclusive geolocalização, mídias, perfis médicos e relatos de atendimento;</li>
              <li><strong className="text-foreground">Dados biométricos</strong> faciais e resultados de reconhecimento;</li>
              <li><strong className="text-foreground">Informações operacionais</strong> de despacho, localização de agentes em serviço e rotas táticas.</li>
            </ul>
            <p>
              <strong className="text-foreground">1.2.</strong> O dever de sigilo persiste durante e após o
              exercício da função, observados os arts. 325 do Código Penal (violação de sigilo funcional),
              154 do Código Penal e a Lei nº 13.709/2018 (LGPD).
            </p>
          </div>
        </section>

        {/* Cláusula 2 — Proibições */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-warning" />
            Cláusula 2 — Proibições Expressas
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">2.1.</strong> Fica expressamente proibido ao Agente Público:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Extrair prints</strong> de tela, fotografar a tela ou capturar o conteúdo da Plataforma por qualquer meio técnico;</li>
              <li><strong className="text-foreground">Compartilhar informações</strong> de denúncias, ocorrências ou dados de cidadãos em <strong className="text-foreground">redes sociais</strong>, aplicativos de mensagens ou qualquer canal externo à Plataforma;</li>
              <li><strong className="text-foreground">Vazar dados</strong> para terceiros, incluindo colegas não autorizados, familiares, imprensa ou qualquer pessoa fora do estrito necessidade operacional;</li>
              <li><strong className="text-foreground">Copiar, baixar ou exportar</strong> mídias, imagens ou relatórios para dispositivos pessoais ou externos, ressalvadas as hipóteses legais;</li>
              <li><strong className="text-foreground">Utilizar as informações</strong> para finalidade diversa do exercício regular da função pública.</li>
            </ul>
            <p>
              <strong className="text-foreground">2.2.</strong> O descumprimento de qualquer proibição deste
              artigo ensejará a imediata <strong className="text-foreground">suspensão do acesso</strong> à
              Plataforma, sem prejuízo das sanções cabíveis.
            </p>
          </div>
        </section>

        {/* Cláusula 3 — Sanções */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-destructive" />
            Cláusula 3 — Sanções pelo Descumprimento
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">3.1.</strong> O descumprimento deste Termo, por ação ou
              omissão, ensejará a abertura de <strong className="text-foreground">processo administrativo
              disciplinar (PAD)</strong> junto ao <strong className="text-foreground">órgão de origem</strong> do
              Agente Público, com observância da Lei nº 8.112/90 (ou estatuto aplicável), podendo resultar em
              sanções de advertência, suspensão, demissão, cassação de aposentadoria ou destituição de cargo
              em comissão.
            </p>
            <p>
              <strong className="text-foreground">3.2.</strong> Sem prejuízo da responsabilização administrativa,
              o infrator estará sujeito a <strong className="text-foreground">sanções civis</strong>, incluindo
              indenização por danos morais e materiais (art. 927 do Código Civil), e <strong className="text-foreground">sanções penais</strong>,
              com especial destaque para os crimes previstos nos arts. 325 (violação de sigilo funcional), 153
              (divulgação de segredo), 154-A e 325-A do Código Penal, além da Lei nº 13.709/2018 (LGPD).
            </p>
            <p>
              <strong className="text-foreground">3.3.</strong> A Plataforma poderá comunicar o ilícito à
              corregedoria, ao Ministério Público e à autoridade policial competente para as providências
              cabíveis.
            </p>
          </div>
        </section>

        {/* Cláusula 4 — Foro */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" />
            Cláusula 4 — Foro Eleito
          </h2>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 not-prose">
            <p className="text-foreground">
              <strong className="text-foreground">4.1.</strong> Fica eleita, com renúncia expressa a qualquer
              outro, por mais privilegiado que seja, a <strong className="text-primary">Comarca de São
              Bernardo do Campo — Estado de São Paulo</strong> como <strong className="text-primary">foro
              exclusivo</strong> para dirimir quaisquer controvérsias oriundas deste Termo e do uso da
              Plataforma por Agente Público, ressalvadas as competências absolutas e originárias dos Tribunais
              Superiores e a competência dos juízos especializados da Justiça Eleitoral e Militar.
            </p>
          </div>
        </section>

        {/* Rodapé */}
        <section className="border-t border-border/40 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Sentinela · Termo de Responsabilidade e Confidencialidade para Agentes Públicos · v1.0 · {hoje}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/termos"><FileText className="w-3.5 h-3.5 mr-1.5" /> Termos de Uso</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/privacidade"><Lock className="w-3.5 h-3.5 mr-1.5" /> Política de Privacidade</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}