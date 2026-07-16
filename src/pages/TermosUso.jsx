import { ShieldCheck, Scale, AlertTriangle, Users, UserCheck, Gavel, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TermosUso() {
  const hoje = "16 de julho de 2026";

  return (
    <div className="min-h-screen bg-background">
      {/* Cabeçalho */}
      <div className="border-b border-border/40 bg-gradient-to-b from-card to-background">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Termos e Condições de Uso</h1>
              <p className="text-sm text-muted-foreground">Plataforma Sentinela · Versão 1.0 · Atualizada em {hoje}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-3 py-1 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Documento de aceitação obrigatória
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-medium">
              <Gavel className="w-3.5 h-3.5" /> Foro: São Bernardo do Campo — SP
            </span>
          </div>
        </div>
      </div>

      {/* Corpo do documento */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 text-sm md:text-base leading-relaxed">

        {/* Premissa */}
        <div className="bg-muted/40 border-l-4 border-primary rounded-r-xl p-5">
          <h2 className="font-semibold text-base mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Consideração Inicial
          </h2>
          <p className="text-muted-foreground">
            Estes Termos e Condições de Uso (“Termos”) regulam o acesso e a utilização do aplicativo
            <strong className="text-foreground"> Sentinela</strong> (“Plataforma”), desenvolvido como ferramenta
            de comunicação cidadã e de inteligência para segurança pública. Ao criar conta, fazer login ou
            utilizar qualquer funcionalidade da Plataforma, o usuário (“Usuário”) declara ter lido,
            compreendido e aceitado integralmente o presente instrumento, vinculando-se a todos os seus
            termos. Caso não concorde, <strong className="text-foreground">não utilize a Plataforma</strong>.
          </p>
        </div>

        {/* Cláusula 1 — Isenção de Responsabilidade Crítica */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Cláusula 1 — Natureza Complementar e Isenção de Responsabilidade Crítica
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">1.1.</strong> O Sentinela é uma ferramenta
              <strong className="text-foreground"> complementar</strong> de comunicação, alerta e inteligência
              cidadã. Em <u>nenhuma hipótese</u> a Plataforma substitui, dispensa ou reduz a necessidade de
              acionamento dos serviços oficiais de emergência do Estado, em especial os números
              <strong className="text-foreground"> 190 (Polícia Militar), 192 (SAMU) e 193 (Corpo de Bombeiros)</strong>.
            </p>
            <p>
              <strong className="text-foreground">1.2.</strong> Diante de qualquer emergência real ou iminente,
              o Usuário <strong className="text-foreground">deverá prioritariamente</strong> ligar para os números
              oficiais 190, 192 ou 193. A Plataforma não constitui canal prioritário de atendimento estatal e não
              garante acionamento, despacho ou resposta de qualquer força de segurança, saúde ou defesa civil.
            </p>
            <p>
              <strong className="text-foreground">1.3.</strong> Os desenvolvedores, mantenedores e operadores do
              Sentinela (“Administradores”) <strong className="text-foreground">não se responsabilizam</strong>,
              direta ou indiretamente, pelo tempo de resposta, omissão, demora, falha ou atuação (ou ausência
              desta) das forças de segurança, serviços de saúde, defesa civil, guarda civil, polícia ou de
              qualquer órgão público na esteira de um alerta gerado pela Plataforma.
            </p>
            <p>
              <strong className="text-foreground">1.4.</strong> A Plataforma depende de infraestrutura de
              telecomunicações, conectividade à internet, disponibilidade de servidores e funcionamento de
              dispositivos do Usuário. Falhas, indisponibilidades, atrasos ou interrupções por motivos
              técnicos <strong className="text-foreground">não geram</strong> qualquer direito à indenização ou
              responsabilização dos Administradores.
            </p>
            <p>
              <strong className="text-foreground">1.5.</strong> O Usuário reconhece e concorda expressamente que
              utiliza a Plataforma por sua conta e risco, ciente de que se trata de instrumento de
              <strong className="text-foreground"> auxílio</strong>, e que a efetiva resposta a emergências é
              competência exclusiva do Estado.
            </p>
          </div>
        </section>

        {/* Cláusula 2 — Tipos de Perfis */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Cláusula 2 — Tipos de Perfis e Regras Distintas de Uso
          </h2>

          <h3 className="font-semibold text-base mt-4 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-chart-3" /> 2.1. Cidadão (Perfil Comum)
          </h3>
          <div className="space-y-2 text-muted-foreground">
            <p>O perfil de <strong className="text-foreground">Cidadão</strong> destina-se ao uso pela população em geral, observadas as seguintes regras:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">a)</strong> reportar ocorrências e denúncias de forma verídica, responsável e fundamentada;</li>
              <li><strong className="text-foreground">b)</strong> utilizar o botão de pânico, a biometria de coação e o compartilhamento de localização exclusivamente em situações reais de risco;</li>
              <li><strong className="text-foreground">c)</strong> fornecer dados de localização e mídias autênticas, abstendo-se de manipular, forjar ou adulterar informações;</li>
              <li><strong className="text-foreground">d)</strong> não utilizar a Plataforma para fins comerciais, políticos, de vigilância privada indevida ou de exposição de terceiros;</li>
              <li><strong className="text-foreground">e)</strong> observar a legislação vigente, em especial a Lei nº 13.709/2018 (LGPD), quanto aos dados pessoais de terceiros eventualmente registrados.</li>
            </ul>
          </div>

          <h3 className="font-semibold text-base mt-5 mb-2 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-warning" /> 2.2. Agente Público (Perfil de Gestão e Resposta)
          </h3>
          <div className="space-y-2 text-muted-foreground">
            <p>O perfil de <strong className="text-foreground">Agente Público</strong> — compreendendo agentes de saúde (SAMU), defesa civil, guarda civil, polícia e administradores de centros de monitoramento — destina-se ao uso institucional no exercício da função pública, observadas as seguintes regras:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">a)</strong> o acesso é concedido exclusivamente a servidores públicos devidamente identificados e autorizados pelo órgão competente;</li>
              <li><strong className="text-foreground">b)</strong> é vedado o uso particular, a divulgação de dados sigilosos fora do âmbito funcional e a apropriação indevida de informações obtidas pela Plataforma;</li>
              <li><strong className="text-foreground">c)</strong> o Agente Público deve atuar com probidade, celeridade e dentro de suas atribuições legais, respondendo administrativa, civil e criminalmente por eventual abuso de função;</li>
              <li><strong className="text-foreground">d)</strong> o tratamento de dados pessoais e sensíveis obtidos via Plataforma deve observar a Lei nº 13.709/2018 (LGPD) e os princípios da Administração Pública (art. 37 da CF/88);</li>
              <li><strong className="text-foreground">e)</strong> o Administrador de centro de monitoramento responde pela correta configuração dos fluxos, cercas, câmeras e permissões sob sua gestão.</li>
            </ul>
          </div>

          <p className="text-muted-foreground mt-4">
            <strong className="text-foreground">2.3.</strong> A verificação de identidade e vínculo funcional do
            Agente Público é de responsabilidade do órgão público declarante. Os Administradores da Plataforma
            podem solicitar, a qualquer tempo, comprovação documental, e reservam-se o direito de suspender ou
            revogar o acesso em caso de divergência ou irregularidade.
          </p>
        </section>

        {/* Cláusula 3 — Antifraude/Trote */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Cláusula 3 — Antifraude, Trote e Comunicações Falsas
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">3.1.</strong> É expressamente vedada a utilização da
              Plataforma para a comunicação <strong className="text-foreground">falsa, simulada, inverídica ou
              fraudulenta</strong> de crimes, desastres, emergências médicas, situações de risco ou de qualquer
              evento que enseje mobilização de forças de segurança, saúde ou defesa civil.
            </p>
            <p>
              <strong className="text-foreground">3.2.</strong> A prática de <strong className="text-foreground">trote</strong>
              ou comunicação falsa configura ilícito penal, nos termos da Lei nº 12.837/2013 e do Decreto-Lei
              nº 2.848/1940 (Código Penal), em especial os crimes previstos nos arts. 330 (Motim de presos),
              339 (Comunicação falsa de crime) e 340 (Falsa identificação), além de eventual responsabilidade
              por denunciação caluniosa (art. 339, CP) e crime contra a saúde pública.
            </p>
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 not-prose">
              <p className="text-foreground font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Sanções aplicáveis:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li><strong className="text-foreground">a)</strong> <strong className="text-destructive">Banimento imediato</strong> e definitivo da conta do Usuário infrator, sem prejuízo da responsabilização;</li>
                <li><strong className="text-foreground">b)</strong> Encaminhamento dos dados de identificação, registros técnicos (IP, geolocalização, dispositivo) e mídias às <strong className="text-foreground">autoridades policiais competentes</strong> para apuração e sanções penais cabíveis;</li>
                <li><strong className="text-foreground">c)</strong> Eventual cobrança de <strong className="text-foreground">custos operacionais</strong> decorrentes do acionamento indevido de equipes, quando aplicável.</li>
              </ul>
            </div>
            <p>
              <strong className="text-foreground">3.3.</strong> A Plataforma utiliza sistemas automatizados de
              detecção de trote (análise de padrões, histórico, geolocalização e inteligência artificial).
              Alertas classificados como suspeitos poderão ser colocados em quarentena, sem que isso isente o
              autor das consequências previstas nesta cláusula.
            </p>
            <p>
              <strong className="text-foreground">3.4.</strong> O Usuário autoriza, desde já, a cessão dos
              registros técnicos pertinentes às autoridades requisitantes, nos termos do art. 7º, II, da
              LGPD, dispensada a necessidade de consentimento específico para cada caso.
            </p>
          </div>
        </section>

        {/* Cláusula 4 — Dados e Privacidade */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Cláusula 4 — Proteção de Dados e Privacidade
          </h2>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">4.1.</strong> A Plataforma processa dados pessoais, sensíveis
              e biométricos (inclusive facial) em conformidade com a Lei nº 13.709/2018 (LGPD). O Usuário
              consente com o tratamento de seus dados para as finalidades de segurança pública descritas nestes
              Termos.
            </p>
            <p>
              <strong className="text-foreground">4.2.</strong> Mídias capturadas em situações de emergência são
              armazenadas com criptografia, e o acesso se dá exclusivamente via token temporário, com auditoria
              de cada visualização.
            </p>
            <p>
              <strong className="text-foreground">4.3.</strong> O Usuário pode exercer, a qualquer tempo, os
              direitos previstos nos arts. 17 e 18 da LGPD (acesso, correção, eliminação, portabilidade e
              revogação de consentimento), ressalvadas as hipóteses de guarda obrigatória por imposição legal
              ou requisição de autoridade.
            </p>
          </div>
        </section>

        {/* Cláusula 5 — Disposições Gerais */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Cláusula 5 — Disposições Gerais
          </h2>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">5.1.</strong> A Plataforma pode ser atualizada, suspensa ou
              descontinuada a qualquer tempo, sem aviso prévio, não gerando direito a indenização.
            </p>
            <p>
              <strong className="text-foreground">5.2.</strong> A omissão ou tolerância dos Administradores na
              aplicação de qualquer cláusula não constitui renúncia, podendo ser exercida a qualquer momento.
            </p>
            <p>
              <strong className="text-foreground">5.3.</strong> Caso qualquer disposição seja considerada
              nula ou inexequível, as demais permanecem válidas e plenamente eficazes.
            </p>
            <p>
              <strong className="text-foreground">5.4.</strong> Estes Termos podem ser atualizados
              periodicamente, sendo a versão vigente a publicada na Plataforma, com a data de atualização
              indicada no cabeçalho.
            </p>
          </div>
        </section>

        {/* Cláusula 6 — Foro */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" />
            Cláusula 6 — Foro Eleito
          </h2>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 not-prose">
            <p className="text-foreground">
              <strong className="text-foreground">6.1.</strong> Fica eleita, com expressa renúncia a qualquer
              outro, por mais privilegiado que seja, a <strong className="text-primary">Comarca de São Bernardo
              do Campo — Estado de São Paulo</strong> como o <strong className="text-primary">único foro
              competente</strong> para dirimir quaisquer dúvidas, controvérsias ou litígios, judiciais ou
              extrajudiciais, oriundos da interpretação, execução ou inexecução do presente instrumento,
              ressalvadas as competências absolutas e as hipóteses de competência originária dos Tribunais
              Superiores.
            </p>
          </div>
        </section>

        {/* Aceitação */}
        <section className="border-t border-border/40 pt-6">
          <div className="bg-muted/40 rounded-xl p-5 not-prose">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Aceitação.</strong> O simples uso da Plataforma, em qualquer
              dos perfis disponíveis, configura aceitação expressa e irrevogável destes Termos e Condições de
              Uso, vinculando o Usuário à sua integral observância.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <p className="text-xs text-muted-foreground">
              Sentinela — Plataforma de Segurança Cidadã · Termos v1.0 · {hoje}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/manual"><FileText className="w-3.5 h-3.5 mr-1.5" /> Voltar ao Manual</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}