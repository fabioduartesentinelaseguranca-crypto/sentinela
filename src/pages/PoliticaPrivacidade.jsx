import { Lock, MapPin, HeartPulse, EyeOff, ShieldCheck, Gavel, FileText, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PoliticaPrivacidade() {
  const hoje = "16 de julho de 2026";

  return (
    <div className="min-h-screen bg-background">
      {/* Cabeçalho */}
      <div className="border-b border-border/40 bg-gradient-to-b from-card to-background">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Política de Privacidade</h1>
              <p className="text-sm text-muted-foreground">Plataforma Sentinela · Versão 1.0 · Atualizada em {hoje}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-medium">
              <Lock className="w-3.5 h-3.5" /> Conforme a Lei nº 13.709/2018 (LGPD)
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-3 py-1 font-medium">
              <Gavel className="w-3.5 h-3.5" /> Foro: São Bernardo do Campo — SP
            </span>
          </div>
        </div>
      </div>

      {/* Corpo */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 text-sm md:text-base leading-relaxed">

        {/* Premissa */}
        <div className="bg-muted/40 border-l-4 border-primary rounded-r-xl p-5">
          <h2 className="font-semibold text-base mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Introdução
          </h2>
          <p className="text-muted-foreground">
            Esta Política de Privacidade (“Política”) descreve, de forma transparente, como a plataforma
            <strong className="text-foreground"> Sentinela</strong> (“Plataforma”), enquanto controladora de
            dados pessoais no âmbito da Administração Pública e de atividades de segurança pública, coleta,
            trata, armazena e protege os dados pessoais e sensíveis dos seus usuários (“Titulares”), em
            estrita observância à Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD) e à Constituição
            Federal. O uso da Plataforma implica a ciência e a concordância com os termos aqui descritos.
          </p>
        </div>

        {/* Cláusula 1 — Coleta de Dados */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Cláusula 1 — Dados Coletados
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>Para a consecução das finalidades descritas nesta Política, a Plataforma coleta as seguintes categorias de dados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Dados de identificação:</strong> nome completo, CPF, foto e dados de contato do Titular;</li>
              <li><strong className="text-foreground">Dados funcionais (Agentes Públicos):</strong> cargo, matrícula, órgão de lotação e vínculo funcional, necessários à validação do perfil de gestão e resposta;</li>
              <li><strong className="text-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4 text-chart-2" /> Geolocalização precisa em tempo real:</strong> capturada continuamente durante sessões ativas (botão de pânico, Caminhe Comigo, despacho e patrulha), com a finalidade exclusiva de localização e acionamento tático;</li>
              <li><strong className="text-foreground">Mídias anexas aos chamados:</strong> fotos, áudios e vídeos registrados pelo Titular ou captados automaticamente em situações de emergência, inclusive por biometria facial;</li>
              <li><strong className="text-foreground">Dados de uso e técnicos:</strong> endereço IP, tipo e identificador do dispositivo, data/hora de acesso e registros de auditoria;</li>
              <li><strong className="text-foreground">Dados biométricos faciais:</strong> vetores numéricos (embeddings) para reconhecimento e conferência de identidade.</li>
            </ul>
            <p>
              <strong className="text-foreground">1.1.</strong> A coleta obedece ao princípio da minimização:
              são tratados apenas os dados adequados, pertinentes e limitados ao necessário para as finalidades
              de segurança pública, nos termos do art. 6º, III, da LGPD.
            </p>
          </div>
        </section>

        {/* Cláusula 2 — Tratamento de Dados Sensíveis */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-destructive" />
            Cláusula 2 — Tratamento de Dados Sensíveis e Bases Legais
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">2.1.</strong> A Plataforma trata dados pessoais sensíveis,
              conforme o art. 5º, II, da LGPD, abrangendo, entre outros: dados de saúde (relatos de
              atendimentos médicos, perfis médicos de emergência, frequência cardíaca e condições
              pré-existentes) e dados biométricos (vetores faciais).
            </p>
            <p>
              <strong className="text-foreground">2.2.</strong> O tratamento de dados sensíveis encontra
              justificativa nas seguintes bases legais:
            </p>
            <div className="grid md:grid-cols-2 gap-3 not-prose">
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <p className="font-semibold text-sm text-foreground mb-1">Art. 7º, I — Tutela da vida e proteção</p>
                <p className="text-xs text-muted-foreground">Tratamento necessário para a proteção da vida e da incolumidade física do Titular ou de terceiros, fundamento central do botão de pânico e das emergências médicas.</p>
              </div>
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <p className="font-semibold text-sm text-foreground mb-1">Art. 7º, III — Interesse público / exercício de função</p>
                <p className="text-xs text-muted-foreground">Tratamento pela Administração Pública para a execução de políticas públicas de segurança, saúde e defesa civil (art. 23, I, LGPD).</p>
              </div>
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <p className="font-semibold text-sm text-foreground mb-1">Art. 7º, VI — Tutela de direitos</p>
                <p className="text-xs text-muted-foreground">Exercício regular de direitos, inclusive em processos judiciais, administrativos ou arbitrais (BOs, denúncias, perícia).</p>
              </div>
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <p className="font-semibold text-sm text-foreground mb-1">Art. 11, II, “d” — Segurança pública</p>
                <p className="text-xs text-muted-foreground">Tratamento de dados sensíveis quando indispensável à segurança pública, resguardados os direitos fundamentais.</p>
              </div>
            </div>
            <p>
              <strong className="text-foreground">2.3.</strong> A finalidade precípua do tratamento é a
              <strong className="text-foreground"> proteção da vida e da segurança pública</strong>. Os dados
              de saúde são utilizados exclusivamente para o acionamento adequado de serviços de emergência e
              atendimento médico, e os dados de segurança, para prevenção, resposta e apuração de ilícitos.
            </p>
          </div>
        </section>

        {/* Cláusula 2-A — Rastreamento em Segundo Plano de Agentes Públicos */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-chart-2" />
            Cláusula 2-A — Rastreamento em Segundo Plano de Agentes Públicos
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">2-A.1 — Consentimento de Rastreamento.</strong> O Agente
              Público é expressamente informado de que a Plataforma <strong className="text-foreground">coleta
              dados de geolocalização em tempo real</strong> (latitude e longitude) <strong className="text-foreground">mesmo
              quando o aplicativo está fechado ou não está em uso</strong> (execução em segundo plano /
              background), com a finalidade estrita de triagem e eficiência no atendimento de ocorrências de
              segurança pública e defesa civil. O aceite do Termo de Responsabilidade e Confidencialidade
              vinculado a este perfil equivale ao consentimento livre, informado e inequívoco previsto no art.
              8º da LGPD.
            </p>
            <p>
              <strong className="text-foreground">2-A.2 — Finalidade Exclusiva.</strong> Esses dados de
              localização são <strong className="text-foreground">confidenciais</strong> e utilizados
              <strong className="text-foreground"> puramente para fins operacionais da central de
              monitoramento do município de São Bernardo do Campo - SP</strong>, viabilizando o despacho
              automatizado baseado em proximidade geográfica. É <strong className="text-foreground">vedado o
              uso</strong> dos dados de geolocalização para monitoramento de vida privada, controle de
              jornada com finalidade disciplinar diversa da operação, ou qualquer finalidade que extrapole a
              execução de políticas públicas de segurança e defesa civil (art. 7º, III, LGPD).
            </p>
          </div>
        </section>

        {/* Cláusula 3 — Sigilo e Anonimato */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-warning" />
            Cláusula 3 — Sigilo e Anonimato de Denúncias
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">3.1.</strong> A Plataforma permite o envio de
              <strong className="text-foreground"> denúncias anônimas</strong>, em conformidade com o art.
              5º, XXXIV, “b”, da CF/88 e a Lei nº 13.494/2017 (Lei do Whistleblower), garantindo ao cidadão o
              direito de comunicar ilícitos sem revelar sua identidade.
            </p>
            <p>
              <strong className="text-foreground">3.2.</strong> Nas denúncias anônimas, a identidade do
              denunciante é protegida por medidas técnicas de dissociabilidade e pseudonimização
              (art. 12, LGPD), de modo que o vínculo entre o conteúdo e o Titular permanece sob sigilo técnico.
            </p>
            <p>
              <strong className="text-foreground">3.3.</strong> O acesso à identidade do denunciante é
              <strong className="text-foreground"> restrito</strong> e somente poderá ser disponibilizado a
              <strong className="text-foreground"> autoridades competentes</strong> — Polícia Civil, Polícia
              Federal e Ministério Público — <strong className="text-foreground">mediante ordem judicial ou
              requisição legal fundamentada</strong>, observado o contraditório e a ampla defesa.
            </p>
            <p>
              <strong className="text-foreground">3.4.</strong> A Plataforma e seus operadores
              <strong className="text-foreground"> não divulgam</strong>, sob qualquer hipótese, a identidade
              do denunciante a terceiros, ao denunciado ou ao público, ressalvadas as hipóteses legais do
              art. 7º, § 3º, da LGPD (cumprimento de obrigação legal ou regulatória pelo controlador).
            </p>
            <p>
              <strong className="text-foreground">3.5.</strong> Eventuais metadados técnicos (IP,
              geolocalização, dispositivo) vinculados a denúncia anônima permanecem sob guarda sigilosa e
              poderão ser compartilhados apenas nas hipóteses do item 3.3.
            </p>
          </div>
        </section>

        {/* Cláusula 4 — Segurança da Informação */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Cláusula 4 — Segurança da Informação
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">4.1.</strong> Todos os dados trafegam
              <strong className="text-foreground"> criptografados</strong> em trânsito (protocolo TLS/HTTPS) e
              são armazenados em <strong className="text-foreground">servidores seguros</strong>, com
              criptografia em repouso, observados os padrões da ABNT NBR ISO/IEC 27001 e os arts. 46 e 48 da
              LGPD.
            </p>
            <p>
              <strong className="text-foreground">4.2.</strong> As mídias (áudio, vídeo e imagem) capturadas
              em emergências são custodiadas com criptografia no lado do servidor, e o acesso se dá
              exclusivamente mediante <strong className="text-foreground">token temporário</strong> com
              expiração limitada e <strong className="text-foreground">auditoria individual</strong> de cada
              visualização, com identificação do operador, data e horário.
            </p>
            <p>
              <strong className="text-foreground">4.3.</strong> O acesso aos dados é <strong className="text-foreground">controlado por perfis</strong> (Cidadão, Agente Público, Administrador), com princípio do menor privilégio, segregação de funções e registros de auditoria.
            </p>
            <p>
              <strong className="text-foreground">4.4.</strong> Em caso de incidente de segurança que possa
              acarretar risco ou dano relevante aos Titulares, a Plataforma comunicará o fato à Autoridade
              Nacional de Proteção de Dados (ANPD) e aos afetados em prazo razoável, conforme o art. 48 da
              LGPD.
            </p>
          </div>
        </section>

        {/* Cláusula 5 — Direitos do Titular */}
        <section>
          <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Cláusula 5 — Direitos do Titular
          </h2>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">5.1.</strong> O Titular poderá exercer, gratuitamente, os
              direitos previstos no art. 18 da LGPD — confirmação de tratamento, acesso, correção,
              eliminação, portabilidade, oposição e revogação de consentimento — mediante solicitação ao
              Encarregado (DPO) pelo canal de atendimento da Plataforma.
            </p>
            <p>
              <strong className="text-foreground">5.2.</strong> O atendimento poderá ser limitado nos casos de
              guarda obrigatória por imposição legal, requisição de autoridade ou para a tutela de direitos de
              terceiros (art. 18, § 2º, LGPD).
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
              <strong className="text-foreground">6.1.</strong> Fica eleita, com renúncia expressa a qualquer
              outro, por mais privilegiado que seja, a <strong className="text-primary">Comarca de São
              Bernardo do Campo — Estado de São Paulo</strong> como <strong className="text-primary">foro
              exclusivo</strong> para dirimir quaisquer controvérsias ou litígios envolvendo privacidade,
              proteção de dados e o presente instrumento, ressalvadas as competências absolutas e originárias
              dos Tribunais Superiores.
            </p>
          </div>
        </section>

        {/* Contato DPO + rodapé */}
        <section className="border-t border-border/40 pt-6">
          <div className="bg-muted/40 rounded-xl p-5 not-prose">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Encarregado pelo Tratamento de Dados (DPO).</strong>
              Para exercer seus direitos ou esclarecer dúvidas sobre esta Política, o Titular poderá contatar o
              Encarregado pelo canal oficial de atendimento da Plataforma Sentinela. A ANPD (Autoridade
              Nacional de Proteção de Dados) também pode ser acionada para reclamações.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <p className="text-xs text-muted-foreground">
              Sentinela — Plataforma de Segurança Cidadã · Política de Privacidade v1.0 · {hoje}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/termos"><FileText className="w-3.5 h-3.5 mr-1.5" /> Termos de Uso</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/manual"><FileText className="w-3.5 h-3.5 mr-1.5" /> Voltar ao Manual</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}