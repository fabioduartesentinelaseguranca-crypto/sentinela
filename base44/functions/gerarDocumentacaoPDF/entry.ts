import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// ─── COLOR PALETTE ───────────────────────────────────────────
const C = {
  primary: [30, 100, 200],
  dark: [20, 25, 35],
  gray: [100, 100, 110],
  lightGray: [160, 165, 175],
  white: [255, 255, 255],
  black: [25, 30, 40],
  accent: [0, 180, 120],
  warn: [240, 150, 30],
  danger: [220, 50, 50],
  bgLight: [248, 250, 252],
  bgDark: [240, 244, 248],
};

function rgb(c) { return c; }

// ─── HELPERS ─────────────────────────────────────────────────
function checkPage(doc, y, needed = 40) {
  if (y > doc.internal.pageSize.height - needed) {
    doc.addPage();
    return 25;
  }
  return y;
}

function sectionTitle(doc, title, y) {
  y = checkPage(doc, y, 30);
  doc.setFillColor(...rgb(C.dark));
  doc.rect(15, y, 180, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...rgb(C.white));
  doc.text(title, 20, y + 6.5);
  return y + 16;
}

function subTitle(doc, title, y) {
  y = checkPage(doc, y, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...rgb(C.primary));
  doc.text(title, 20, y);
  doc.setDrawColor(...rgb(C.primary));
  doc.setLineWidth(0.4);
  doc.line(20, y + 2.5, 90, y + 2.5);
  return y + 10;
}

function bodyText(doc, text, y, indent = 20) {
  y = checkPage(doc, y, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 65);
  const lines = doc.splitTextToSize(text, 190 - indent);
  doc.text(lines, indent, y);
  return y + (lines.length * 4.5) + 3;
}

function bulletList(doc, items, y, indent = 25) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 65);
  for (const item of items) {
    y = checkPage(doc, y, 10);
    const lines = doc.splitTextToSize(item, 185 - indent);
    doc.text('\u2022 ' + lines[0], indent - 5, y);
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        y += 4.5;
        y = checkPage(doc, y, 10);
        doc.text('  ' + lines[i], indent, y);
      }
    }
    y += lines.length * 4.5;
  }
  return y + 2;
}

function infoBox(doc, title, text, y) {
  y = checkPage(doc, y, 25);
  doc.setFillColor(235, 245, 255);
  doc.setDrawColor(...rgb(C.primary));
  doc.setLineWidth(0.6);
  doc.roundedRect(18, y - 2, 174, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C.primary));
  doc.text(title.toUpperCase(), 22, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 65);
  const txtLines = doc.splitTextToSize(text, 166);
  doc.text(txtLines, 22, y + 12);
  const boxH = 14 + (txtLines.length * 4.5);
  doc.roundedRect(18, y - 2, 174, boxH, 2, 2, 'FD');
  doc.setFillColor(235, 245, 255);
  doc.setTextColor(...rgb(C.primary));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), 22, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 65);
  doc.text(txtLines, 22, y + 10);
  return y + boxH + 6;
}

// ─── ENTITY TABLE ────────────────────────────────────────────
function entityTable(doc, name, schema, y) {
  y = checkPage(doc, y, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...rgb(C.primary));
  doc.text(name, 20, y);
  y += 6;

  if (schema.description) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...rgb(C.gray));
    const descLines = doc.splitTextToSize(schema.description, 170);
    doc.text(descLines, 20, y);
    y += (descLines.length * 4) + 2;
  }

  // Table
  const cols = ['Campo', 'Tipo', 'Obrig.', 'Descri\u00e7\u00e3o'];
  const w = [52, 38, 16, 64];
  let x = 20;
  y = checkPage(doc, y, 15);

  // Header
  doc.setFillColor(...rgb(C.primary));
  doc.rect(x, y, w.reduce((a, b) => a + b, 0), 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  x = 20;
  cols.forEach((c, i) => {
    doc.text(c, x + 2, y + 5);
    x += w[i];
  });
  y += 9;

  const props = schema.properties || {};
  const req = schema.required || [];
  let idx = 0;
  for (const [key, prop] of Object.entries(props)) {
    y = checkPage(doc, y, 8);
    const bg = idx % 2 === 0 ? '#F1F5F9' : '#FFFFFF';
    doc.setFillColor(...hexToRgb(bg));
    doc.rect(20, y - 1, w.reduce((a, b) => a + b, 0), 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(40, 40, 50);

    x = 20;
    const cells = [
      key,
      fmtType(prop),
      req.includes(key) ? 'Sim' : 'N\u00e3o',
      (prop.description || '').substring(0, 90)
    ];
    cells.forEach((c, i) => {
      doc.text(String(c), x + 2, y + 5.5);
      x += w[i];
    });
    y += 9;
    idx++;
  }

  // RLS
  if (schema.rls) {
    y += 2;
    y = checkPage(doc, y, 15);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.lightGray));
    const rlsLines = doc.splitTextToSize('RLS: ' + schema.rls, 170);
    doc.text(rlsLines, 20, y);
    y += (rlsLines.length * 3.5) + 3;
  }

  return y + 4;
}

function fmtType(prop) {
  if (prop.enum) return 'enum';
  if (prop.type === 'array') return prop.items?.type ? 'array<' + prop.items.type + '>' : 'array<object>';
  if (prop.type === 'object') return 'object';
  return prop.type || 'string';
}

function hexToRgb(h) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [240, 240, 240];
}

// ─── ENTITIES ────────────────────────────────────────────────
const E = {
  "Occurrence": {
    description: "Registro central de ocorr\u00eancias reportadas por cidad\u00e3os ou agentes. Entidade principal do sistema.",
    properties: {
      type: { type: "string", enum: ["crime","traffic","civil_defense","health","panic"], description: "Tipo principal da ocorr\u00eancia" },
      subtype: { type: "string", description: "Subtipo espec\u00edfico (ex: roubo, acidente, enchente, SAMU)" },
      status: { type: "string", enum: ["open","in_progress","resolved","canceled"], description: "Status atual da ocorr\u00eancia", default: "open" },
      description: { type: "string", description: "Descri\u00e7\u00e3o detalhada" },
      lat: { type: "number", description: "Latitude da localiza\u00e7\u00e3o" },
      lng: { type: "number", description: "Longitude da localiza\u00e7\u00e3o" },
      address: { type: "string", description: "Endere\u00e7o descritivo" },
      media_urls: { type: "array", items: { type: "string" }, description: "URLs de fotos, v\u00eddeos e \u00e1udios anexados" },
      reporter_id: { type: "string", description: "ID do cidad\u00e3o que reportou" },
      assigned_agent_id: { type: "string", description: "ID do agente designado para atendimento" },
      priority: { type: "string", enum: ["low","medium","high","critical"], description: "N\u00edvel de prioridade", default: "medium" },
      resolution_notes: { type: "string", description: "Notas de resolu\u00e7\u00e3o preenchidas pelo agente" },
      awarded_points: { type: "number", description: "Pontos concedidos ao cidad\u00e3o quando resolvida", default: 0 },
    },
    required: ["type"],
    rls: "Cidad\u00e3os criam e leem as pr\u00f3prias. Agentes leem e atualizam todas. Admins t\u00eam acesso total."
  },
  "Alertas_Inteligencia_IA": {
    description: "Alertas disparados por IA (Calculadora de P\u00e2nico, Senha de Coer\u00e7\u00e3o, Desvio de Rota). Alimenta a Central de Despacho em tempo real.",
    properties: {
      id_usuario: { type: "string", description: "UUID do cidad\u00e3o que acionou" },
      tipo_gatilho: { type: "string", enum: ["CALCULADORA_PANICO","SENHA_COERCAO","DESVIO_ROTA"], description: "Tipo de gatilho disparador" },
      data_hora_brasilia: { type: "string", format: "date-time", description: "Hor\u00e1rio exato do acionamento (GMT-3)" },
      geolocalizacao_latitude: { type: "number", description: "Latitude capturada do GPS" },
      geolocalizacao_longitude: { type: "number", description: "Longitude capturada do GPS" },
      status_alerta: { type: "string", enum: ["TRIAGEM_IA","DESPACHADO_POLICIA","EM_ANDAMENTO","FINALIZADO","SUSPEITA_TROTE"], description: "Status no fluxo de despacho" },
      url_audio_video_criptografado: { type: "string", description: "Link da m\u00eddia criptografada capturada em segundo plano" },
      transcricao_audio_ia: { type: "string", description: "Texto integral extra\u00eddo por IA do \u00e1udio" },
      analise_acustica_tags: { type: "array", items: { type: "string" }, description: "Tags geradas pela IA (Gritos, Men\u00e7\u00e3o_Arma, Estresse_Alto)" },
      resumo_despacho_ia: { type: "string", description: "Resumo executivo de at\u00e9 3 linhas para despacho r\u00e1pido" },
      grau_prioridade_ia: { type: "string", enum: ["CR\u00cdTICO_RISCO_MORTE","ALTO","M\u00c9DIO","BAIXO"], description: "Prioridade classificada automaticamente pela IA" },
    },
    required: ["tipo_gatilho","data_hora_brasilia"],
    rls: "Cidad\u00e3os criam e leem os pr\u00f3prios. Agentes e Admins leem e atualizam todos."
  },
  "Boletins_Ocorrencia_Gerados": {
    description: "Boletins de Ocorr\u00eancia jur\u00eddicos gerados automaticamente por IA ao finalizar um alerta. Inclui texto jur\u00eddico, tags visuais e telemetria IoT.",
    properties: {
      id_alerta: { type: "string", description: "ID do Alerta de Intelig\u00eancia de origem" },
      id_ocorrencia: { type: "string", description: "ID da Ocorr\u00eancia associada" },
      texto_juridico_bo: { type: "string", description: "Texto completo do BO redigido pela IA (Claude)" },
      tags_reconhecimento_visual: { type: "array", items: { type: "string" }, description: "Tags extra\u00eddas por vis\u00e3o computacional" },
      telemetria_iot: { type: "object", description: "Dados de telemetria IoT da viatura: velocidade, sirene, rota GPS" },
      data_emissao: { type: "string", format: "date-time", description: "Data/hora de emiss\u00e3o no fuso de Bras\u00edlia" },
      status_assinatura: { type: "string", enum: ["rascunho","assinado","rejeitado"], description: "Status da assinatura digital" },
      assinatura_agente_responsavel: { type: "string", description: "Nome completo do agente que assinou" },
      assinatura_agente_id: { type: "string", description: "ID do agente signat\u00e1rio" },
      texto_revisado_bo: { type: "string", description: "Vers\u00e3o final revisada pelo agente" },
      observacoes_revisao: { type: "string", description: "Observa\u00e7\u00f5es da revis\u00e3o" },
    },
    required: ["id_alerta"],
    rls: "Agentes criam e leem. Admins acesso total. Cidad\u00e3os leem os pr\u00f3prios via id_alerta."
  },
  "Perimetros_Seguranca_Infantil": {
    description: "Geofencing para prote\u00e7\u00e3o de crian\u00e7as. Pais/respons\u00e1veis definem per\u00edmetros seguros e monitoram entrada/sa\u00edda.",
    properties: {
      user_id: { type: "string", description: "ID do respons\u00e1vel (pai/m\u00e3e)" },
      user_name: { type: "string", description: "Nome do respons\u00e1vel" },
      nome_crianca: { type: "string", description: "Nome da crian\u00e7a protegida" },
      nome_local: { type: "string", description: "Nome descritivo do local (ex: Escola Municipal Jo\u00e3o Silva)" },
      tipo: { type: "string", enum: ["escola","creche","parque","rota_escolar","casa_parente","outro"], description: "Tipo de local" },
      lat: { type: "number", description: "Latitude do centro do per\u00edmetro" },
      lng: { type: "number", description: "Longitude do centro do per\u00edmetro" },
      raio_metros: { type: "number", description: "Raio do per\u00edmetro em metros", default: 300 },
      horario_inicio: { type: "string", description: "Hor\u00e1rio de in\u00edcio do monitoramento (HH:MM)" },
      horario_fim: { type: "string", description: "Hor\u00e1rio de fim do monitoramento (HH:MM)" },
      dias_semana: { type: "array", items: { type: "integer" }, description: "Dias da semana (0=Domingo a 6=S\u00e1bado)" },
      dispositivo_crianca_id: { type: "string", description: "ID do dispositivo da crian\u00e7a para pareamento" },
      ativo: { type: "boolean", description: "Per\u00edmetro ativo?", default: true },
    },
    required: ["user_id","nome_crianca","nome_local","lat","lng"],
    rls: "Acesso restrito ao pr\u00f3prio user_id."
  },
  "Perfis_Medicos_Usuarios": {
    description: "Perfil m\u00e9dico do cidad\u00e3o para uso em emerg\u00eancias. Cont\u00e9m tipo sangu\u00edneo, alergias, condi\u00e7\u00f5es e contatos de emerg\u00eancia.",
    properties: {
      user_id: { type: "string", description: "ID do cidad\u00e3o" },
      user_name: { type: "string", description: "Nome do cidad\u00e3o" },
      tipo_sanguineo: { type: "string", enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-","nao_informado"], description: "Tipo sangu\u00edneo" },
      alergias: { type: "array", items: { type: "string" }, description: "Lista de alergias conhecidas" },
      restricoes_medicamentos: { type: "array", items: { type: "string" }, description: "Medicamentos contraindicados" },
      condicoes_preexistentes: { type: "array", items: { type: "string" }, description: "Condi\u00e7\u00f5es m\u00e9dicas pr\u00e9-existentes" },
      medicamentos_uso_continuo: { type: "array", items: { type: "string" }, description: "Medicamentos de uso cont\u00ednuo" },
      contato_emergencia_nome: { type: "string", description: "Nome do contato de emerg\u00eancia" },
      contato_emergencia_telefone: { type: "string", description: "Telefone do contato de emerg\u00eancia" },
      contato_emergencia_parentesco: { type: "string", description: "Parentesco do contato" },
      plano_saude: { type: "string", description: "Plano de sa\u00fade" },
      observacoes: { type: "string", description: "Informa\u00e7\u00f5es adicionais relevantes para emerg\u00eancia" },
    },
    required: ["user_id"],
    rls: "Cidad\u00e3o gerencia o pr\u00f3prio. Agentes leem em emerg\u00eancia. Admins acesso total."
  },
  "Configuracoes_Biometria_Coacao": {
    description: "Biometria Invertida: PIN de coa\u00e7\u00e3o digitado na calculadora disfar\u00e7ada que dispara alerta silencioso com captura de \u00e1udio/v\u00eddeo.",
    properties: {
      user_id: { type: "string", description: "ID do cidad\u00e3o" },
      user_name: { type: "string", description: "Nome do cidad\u00e3o" },
      coacao_pin: { type: "string", description: "PIN de coa\u00e7\u00e3o (dispara alerta ao ser digitado na calculadora)" },
      coacao_ativada: { type: "boolean", description: "Recurso de coa\u00e7\u00e3o ativo?", default: true },
      disarm_pin: { type: "string", description: "PIN normal de desarme (desarma de verdade)" },
      metodo_coacao: { type: "string", enum: ["pin","digital_coacao","face_coacao"], description: "M\u00e9todo biom\u00e9trico configurado", default: "pin" },
    },
    required: ["user_id"],
    rls: "Acesso restrito ao pr\u00f3prio user_id."
  },
  "Logs_Frequencia_Cardiaca_Wearables": {
    description: "Registro de batimentos card\u00edacos via wearables (smartwatch, Health Connect, Health Kit) para detec\u00e7\u00e3o de p\u00e2nico aut\u00f4nomo.",
    properties: {
      user_id: { type: "string", description: "ID do cidad\u00e3o" },
      user_name: { type: "string", description: "Nome do cidad\u00e3o" },
      bpm: { type: "number", description: "Batimentos por minuto registrados" },
      data_registro: { type: "string", format: "date-time", description: "Data/hora do registro" },
      origem: { type: "string", enum: ["smartwatch","manual","health_connect","health_kit"], description: "Origem dos dados" },
      acao_tomada: { type: "string", enum: ["nenhuma","alerta_enviado","panico_autonomo","confirmado_seguro","queda_detectada"], description: "A\u00e7\u00e3o autom\u00e1tica executada" },
      status_resposta: { type: "string", enum: ["pendente","seguro","nao_respondeu"], description: "Status da verifica\u00e7\u00e3o" },
      coordenada_lat: { type: "number", description: "Latitude no momento do registro" },
      coordenada_lng: { type: "number", description: "Longitude no momento do registro" },
    },
    required: ["user_id","bpm"],
    rls: "Acesso restrito ao pr\u00f3prio user_id. Admins acesso total."
  },
  "Sessoes_CaminheComigo": {
    description: "Sess\u00f5es de compartilhamento de localiza\u00e7\u00e3o em tempo real durante deslocamentos. Gera link compartilh\u00e1vel e detecta anomalias de movimento.",
    properties: {
      user_id: { type: "string", description: "ID do cidad\u00e3o" },
      user_name: { type: "string", description: "Nome do cidad\u00e3o" },
      status: { type: "string", enum: ["active","ended"], description: "Status da sess\u00e3o" },
      share_token: { type: "string", description: "Token \u00fanico para link de compartilhamento" },
      origem_lat: { type: "number", description: "Latitude de origem" },
      origem_lng: { type: "number", description: "Longitude de origem" },
      destino_lat: { type: "number", description: "Latitude do destino" },
      destino_lng: { type: "number", description: "Longitude do destino" },
      destino_nome: { type: "string", description: "Nome do destino (ex: Casa, Trabalho)" },
      contato_notificado: { type: "string", description: "Contato de emerg\u00eancia notificado" },
      contato_telefone: { type: "string", description: "Telefone do contato" },
      started_at: { type: "string", format: "date-time", description: "In\u00edcio da sess\u00e3o" },
      ended_at: { type: "string", format: "date-time", description: "Fim da sess\u00e3o" },
    },
    required: ["user_id","share_token"],
    rls: "Cidad\u00e3o gerencia as pr\u00f3prias sess\u00f5es. Admins acesso total."
  },
  "Anjos_Guarda": {
    description: "Cadastro de volunt\u00e1rios comunit\u00e1rios (Anjos da Guarda) que auxiliam cidad\u00e3os em situa\u00e7\u00f5es de risco no bairro.",
    properties: {
      user_id: { type: "string", description: "ID do volunt\u00e1rio" },
      user_name: { type: "string", description: "Nome completo do volunt\u00e1rio" },
      telefone: { type: "string", description: "Telefone de contato" },
      bairro: { type: "string", description: "Bairro(s) de atua\u00e7\u00e3o" },
      cidade: { type: "string", description: "Cidade" },
      lat: { type: "number", description: "Latitude da resid\u00eancia/base" },
      lng: { type: "number", description: "Longitude da resid\u00eancia/base" },
      status: { type: "string", enum: ["pendente","aprovado","suspenso","inativo"], description: "Status de aprova\u00e7\u00e3o" },
      certificacoes: { type: "array", items: { type: "string" }, description: "Certifica\u00e7\u00f5es (primeiros socorros, brigadista, etc.)" },
      disponibilidade: { type: "string", enum: ["disponivel","indisponivel","dormindo"], description: "Disponibilidade atual" },
      total_atendimentos: { type: "number", description: "Total de atendimentos realizados" },
      avaliacao_media: { type: "number", description: "Avalia\u00e7\u00e3o m\u00e9dia (1 a 5)" },
      observacoes: { type: "string", description: "Observa\u00e7\u00f5es" },
    },
    required: ["user_id","user_name","bairro"],
    rls: "Aprovados s\u00e3o vis\u00edveis a todos. Cidad\u00e3o gerencia o pr\u00f3prio cadastro. Admins aprovam."
  },
  "Agentes_Seguranca": {
    description: "Cadastro de agentes de seguran\u00e7a p\u00fablica (policiais, socorristas, bombeiros) com localiza\u00e7\u00e3o e status operacional.",
    properties: {
      nome: { type: "string", description: "Nome completo do agente" },
      tipo: { type: "string", enum: ["policial","socorrista","bombeiro"], description: "Tipo de agente de seguran\u00e7a" },
      lat: { type: "number", description: "Latitude da base/localiza\u00e7\u00e3o" },
      lng: { type: "number", description: "Longitude da base/localiza\u00e7\u00e3o" },
      status: { type: "string", enum: ["disponivel","em_atendimento","fora_servico"], description: "Status operacional" },
      veiculo: { type: "string", description: "Viatura ou unidade (ex: PM-4521, SAMU-089)" },
    },
    required: ["nome","tipo"],
    rls: "Apenas Admins criam e gerenciam. Agentes e Admins leem."
  },
  "Shift": {
    description: "Registro de turnos de trabalho dos agentes. Controla in\u00edcio, fim, viatura e status do plant\u00e3o.",
    properties: {
      agent_id: { type: "string", description: "ID do agente" },
      vehicle_plate: { type: "string", description: "Placa da viatura" },
      vehicle_prefix: { type: "string", description: "Prefixo da viatura" },
      start_time: { type: "string", format: "date-time", description: "In\u00edcio do turno" },
      end_time: { type: "string", format: "date-time", description: "Fim do turno" },
      status: { type: "string", enum: ["active","ended"], description: "Status do turno" },
      notes: { type: "string", description: "Observa\u00e7\u00f5es do turno" },
    },
    required: ["vehicle_prefix"],
    rls: "Agente gerencia o pr\u00f3prio turno. Admins acesso total."
  },
  "Alertas_Quarentena": {
    description: "Sistema de detec\u00e7\u00e3o de trotes. Alertas suspeitos s\u00e3o colocados em quarentena para revis\u00e3o por IA e valida\u00e7\u00e3o humana.",
    properties: {
      ocorrencia_id: { type: "string", description: "ID da ocorr\u00eancia suspeita" },
      user_id: { type: "string", description: "ID do usu\u00e1rio que reportou" },
      user_name: { type: "string", description: "Nome do reportante" },
      motivo_suspeita: { type: "string", description: "Raz\u00e3o da detec\u00e7\u00e3o de poss\u00edvel trote" },
      evidencias: { type: "array", items: { type: "string" }, description: "Lista de evid\u00eancias detectadas pela IA" },
      score_suspeita: { type: "number", description: "Score de 0 a 100 da probabilidade de trote" },
      fatores_analisados: { type: "object", description: "Checklist: discrep\u00e2ncia GPS, m\u00faltiplos relatos, hist\u00f3rico, IP, descri\u00e7\u00e3o vaga" },
      status_validacao: { type: "string", enum: ["pendente","em_analise","confirmado_trote","falso_positivo"], description: "Status da valida\u00e7\u00e3o" },
      revisado_por_id: { type: "string", description: "ID do admin/agente que revisou" },
      data_revisao: { type: "string", format: "date-time", description: "Data da revis\u00e3o" },
    },
    required: ["ocorrencia_id","user_id","motivo_suspeita"],
    rls: "Agentes e Admins leem e atualizam."
  },
  "Cercas_Geograficas_Defesa_Civil": {
    description: "Cercas geogr\u00e1ficas para alertas de Defesa Civil. Define pol\u00edgonos de \u00e1reas de risco e dispara notifica\u00e7\u00f5es push.",
    properties: {
      nome: { type: "string", description: "Nome descritivo da cerca geogr\u00e1fica" },
      tipo_risco: { type: "string", enum: ["alagamento","deslizamento","incendio","estrutural","quimico","tsunami","tornado","outro"], description: "Tipo de risco de defesa civil" },
      poligono_coordenadas: { type: "array", items: { type: "object" }, description: "V\u00e9rtices do pol\u00edgono [{lat, lng}, ...]" },
      bairro: { type: "string", description: "Bairro(s) abrangido(s)" },
      cidade: { type: "string", description: "Cidade" },
      estado: { type: "string", description: "Estado" },
      nivel_urgencia: { type: "string", enum: ["extremo","alto","medio","baixo"], description: "N\u00edvel de urg\u00eancia" },
      mensagem_alerta: { type: "string", description: "Mensagem push enviada aos usu\u00e1rios dentro da cerca" },
      status: { type: "string", enum: ["ativo","inativo","programado"], description: "Status da cerca" },
      data_ativacao: { type: "string", format: "date-time", description: "Data de ativa\u00e7\u00e3o" },
      data_desativacao: { type: "string", format: "date-time", description: "Data de desativa\u00e7\u00e3o" },
    },
    required: ["nome","tipo_risco","poligono_coordenadas"],
    rls: "Apenas Admins criam e gerenciam. Cercas ativas vis\u00edveis a agentes e cidad\u00e3os."
  },
  "Notificacoes_Geofence": {
    description: "Registro de notifica\u00e7\u00f5es enviadas a usu\u00e1rios que entraram em \u00e1reas de risco de Defesa Civil.",
    properties: {
      cerca_id: { type: "string", description: "ID da cerca que disparou" },
      cerca_nome: { type: "string", description: "Nome da cerca" },
      tipo_risco: { type: "string", description: "Tipo de risco" },
      nivel_urgencia: { type: "string", description: "N\u00edvel de urg\u00eancia" },
      user_id: { type: "string", description: "ID do usu\u00e1rio notificado" },
      coordenada_lat: { type: "number", description: "Latitude do dispositivo no momento" },
      coordenada_lng: { type: "number", description: "Longitude do dispositivo no momento" },
      data_disparo: { type: "string", format: "date-time", description: "Data/hora do disparo" },
      mensagem: { type: "string", description: "Conte\u00fado da notifica\u00e7\u00e3o enviada" },
      status_envio: { type: "string", enum: ["enviado","pendente","falhou","lido"], description: "Status do envio" },
      canal: { type: "string", enum: ["push","sms","email","todos"], description: "Canal de envio" },
    },
    required: ["cerca_id","user_id"],
    rls: "Usu\u00e1rio v\u00ea as pr\u00f3prias. Agentes e Admins veem todas."
  },
  "Analises_Preditivas": {
    description: "Relat\u00f3rios de an\u00e1lise preditiva criminal gerados por IA. Incluem tend\u00eancias, heatmaps e recomenda\u00e7\u00f5es t\u00e1ticas.",
    properties: {
      titulo: { type: "string", description: "T\u00edtulo do relat\u00f3rio preditivo" },
      resumo: { type: "string", description: "Resumo executivo da an\u00e1lise" },
      tipo_crime: { type: "string", description: "Categoria criminal analisada" },
      subtipos: { type: "array", items: { type: "string" }, description: "Subtipos criminais" },
      regiao: { type: "string", description: "Regi\u00e3o analisada" },
      bairro: { type: "string", description: "Bairro analisado" },
      cidade: { type: "string", description: "Cidade analisada" },
      percentual_variacao: { type: "number", description: "Varia\u00e7\u00e3o percentual detectada" },
      tendencia: { type: "string", enum: ["alta","estavel","queda","pico"], description: "Tend\u00eancia identificada" },
      faixa_horaria_inicio: { type: "string", description: "In\u00edcio da faixa cr\u00edtica (HH:MM)" },
      faixa_horaria_fim: { type: "string", description: "Fim da faixa cr\u00edtica (HH:MM)" },
      dias_criticos: { type: "array", items: { type: "string" }, description: "Dias da semana mais afetados" },
      data_geracao: { type: "string", format: "date-time", description: "Data de gera\u00e7\u00e3o do relat\u00f3rio" },
      periodo_analise_inicio: { type: "string", format: "date", description: "In\u00edcio do per\u00edodo analisado" },
      periodo_analise_fim: { type: "string", format: "date", description: "Fim do per\u00edodo analisado" },
      total_ocorrencias_periodo: { type: "number", description: "Total de ocorr\u00eancias no per\u00edodo" },
      heatmap_coordenadas: { type: "array", items: { type: "object" }, description: "Pontos de calor [{lat, lng, intensidade}]" },
      recomendacoes: { type: "string", description: "Recomenda\u00e7\u00f5es t\u00e1ticas para policiamento" },
      fatores_contribuintes: { type: "array", items: { type: "string" }, description: "Fatores contribuintes identificados" },
      status: { type: "string", enum: ["rascunho","publicado","arquivado"], description: "Status do relat\u00f3rio" },
      nivel_confianca: { type: "string", enum: ["alta","media","baixa"], description: "N\u00edvel de confian\u00e7a da an\u00e1lise" },
    },
    required: ["titulo","tipo_crime","regiao"],
    rls: "Agentes e Admins criam e leem. Apenas Admins atualizam."
  },
  "Postes_Iluminacao": {
    description: "Cadastro de postes de ilumina\u00e7\u00e3o p\u00fablica para correla\u00e7\u00e3o com seguran\u00e7a urbana e manuten\u00e7\u00e3o.",
    properties: {
      coordenada_lat: { type: "number", description: "Latitude do poste" },
      coordenada_lng: { type: "number", description: "Longitude do poste" },
      endereco: { type: "string", description: "Endere\u00e7o" },
      bairro: { type: "string", description: "Bairro" },
      cidade: { type: "string", description: "Cidade" },
      status: { type: "string", enum: ["funcionando","com_defeito","desligado","manutencao"], description: "Status do poste" },
      tipo: { type: "string", enum: ["led","sodio","mercurio","solar","outro"], description: "Tipo de l\u00e2mpada" },
      potencia_watts: { type: "number", description: "Pot\u00eancia em watts" },
      altura_metros: { type: "number", description: "Altura em metros" },
      ultima_manutencao: { type: "string", format: "date", description: "Data da \u00faltima manuten\u00e7\u00e3o" },
      id_prefeitura: { type: "string", description: "Identificador oficial da prefeitura" },
    },
    required: ["coordenada_lat","coordenada_lng"],
    rls: "Leitura p\u00fablica para todos os perfis. Apenas Admins gerenciam."
  },
  "Logs_Auditoria_QA": {
    description: "Logs de auditoria de qualidade (QA) \u2014 registra cada etapa dos testes de estresse do sistema.",
    properties: {
      execucao_id: { type: "string", description: "ID \u00fanico da execu\u00e7\u00e3o de QA" },
      etapa: { type: "string", enum: ["geracao_dados","criacao_ocorrencias","triagem_ia","atribuicao_agente","progressao_status","finalizacao","health_check"], description: "Etapa do fluxo sendo auditada" },
      status: { type: "string", enum: ["success","error","timeout","skipped"], description: "Status da etapa" },
      tempo_ms: { type: "number", description: "Tempo de resposta em milissegundos" },
      ocorrencia_id: { type: "string", description: "ID da ocorr\u00eancia testada" },
      agente_id: { type: "string", description: "ID do agente envolvido" },
      error_message: { type: "string", description: "Mensagem de erro capturada" },
      error_details: { type: "string", description: "Detalhes t\u00e9cnicos do erro (stack trace, payload)" },
      detalhe: { type: "string", description: "Descri\u00e7\u00e3o leg\u00edvel do que foi testado" },
      data_execucao: { type: "string", format: "date-time", description: "Data da execu\u00e7\u00e3o" },
    },
    required: ["execucao_id","etapa","status"],
    rls: "Apenas Admins t\u00eam acesso."
  },
  "PointsLog": {
    description: "Registro de pontos concedidos a cidad\u00e3os e agentes por contribui\u00e7\u00f5es e resolu\u00e7\u00f5es de ocorr\u00eancias.",
    properties: {
      user_id: { type: "string", description: "ID do usu\u00e1rio" },
      user_name: { type: "string", description: "Nome do usu\u00e1rio" },
      points: { type: "number", description: "Quantidade de pontos concedidos" },
      reason: { type: "string", description: "Motivo da concess\u00e3o" },
      occurrence_id: { type: "string", description: "ID da ocorr\u00eancia relacionada" },
    },
    required: ["points"],
    rls: "Leitura p\u00fablica."
  },
  "SystemHealthLog": {
    description: "Logs de health check automatizado do sistema \u2014 executa verifica\u00e7\u00f5es peri\u00f3dicas de todos os fluxos.",
    properties: {
      run_id: { type: "string", description: "ID \u00fanico da execu\u00e7\u00e3o" },
      trigger: { type: "string", enum: ["cron","manual"], description: "Origem do gatilho" },
      profile: { type: "string", enum: ["citizen","agent","admin","system"], description: "Perfil simulado no teste" },
      flow_key: { type: "string", description: "Identificador do fluxo testado" },
      flow_label: { type: "string", description: "Nome leg\u00edvel do fluxo" },
      status: { type: "string", enum: ["success","error","warning"], description: "Status do teste" },
      latency_ms: { type: "number", description: "Tempo de resposta em ms" },
      error_message: { type: "string", description: "Mensagem de erro (se houver)" },
      error_payload: { type: "string", description: "Payload detalhado do erro em JSON" },
      is_critical: { type: "boolean", description: "Indica se \u00e9 um erro cr\u00edtico" },
      run_date: { type: "string", format: "date", description: "Data da execu\u00e7\u00e3o" },
      run_started_at: { type: "string", format: "date-time", description: "In\u00edcio da execu\u00e7\u00e3o" },
    },
    required: ["run_id","profile","flow_key","status"],
    rls: "Acesso p\u00fablico para leitura."
  },
  "TrainingProgress": {
    description: "Progresso de treinamento dos agentes \u2014 m\u00f3dulos, quizzes, tarefas pr\u00e1ticas e revis\u00e3o por admin.",
    properties: {
      agent_id: { type: "string", description: "ID do agente" },
      agent_name: { type: "string", description: "Nome do agente" },
      module_id: { type: "string", description: "ID do m\u00f3dulo de treinamento" },
      module_title: { type: "string", description: "T\u00edtulo do m\u00f3dulo" },
      status: { type: "string", enum: ["not_started","watching","quiz","passed","failed"], description: "Status do progresso" },
      score: { type: "number", description: "Percentual obtido no quiz" },
      attempts: { type: "number", description: "N\u00famero de tentativas" },
      completed_at: { type: "string", format: "date-time", description: "Data de conclus\u00e3o" },
      submitted_task: { type: "string", description: "Resposta/exerc\u00edcio submetido pelo agente" },
      review_status: { type: "string", enum: ["pending","approved","revision"], description: "Status da revis\u00e3o" },
      review_feedback: { type: "string", description: "Feedback do administrador" },
      reviewed_at: { type: "string", format: "date-time", description: "Data da revis\u00e3o" },
    },
    required: ["agent_id","module_id"],
    rls: "Agente v\u00ea o pr\u00f3prio. Admins veem todos."
  },
};

// ─── BACKEND FUNCTIONS ───────────────────────────────────────
const FUNCTIONS = [
  { name: "calcularRotaSegura", desc: "Calcula a rota mais segura entre dois pontos usando IA, considerando ilumina\u00e7\u00e3o p\u00fablica, \u00edndices criminais e presen\u00e7a de agentes.", trigger: "Sob demanda (cidad\u00e3o solicita rota segura)", credits: "M\u00e9dio" },
  { name: "cronSystemHealthCheck", desc: "Automa\u00e7\u00e3o agendada que executa o health check completo do sistema periodicamente (cron).", trigger: "Agendado (cron)", credits: "Baixo" },
  { name: "dispararGeofenceUsuarios", desc: "Varre usu\u00e1rios dentro de cercas geogr\u00e1ficas de Defesa Civil e dispara notifica\u00e7\u00f5es push/SMS/email.", trigger: "Agendado / Sob demanda", credits: "Alto" },
  { name: "gerarAnalisePreditiva", desc: "Gera relat\u00f3rios de an\u00e1lise preditiva criminal com IA (Claude), analisando padr\u00f5es hist\u00f3ricos de ocorr\u00eancias.", trigger: "Sob demanda (painel admin)", credits: "Alto" },
  { name: "gerarBoletimOcorrencia", desc: "Gera Boletim de Ocorr\u00eancia jur\u00eddico automaticamente ao finalizar um alerta. Utiliza Claude Sonnet 4.6 com telemetria, tags visuais e transcri\u00e7\u00f5es.", trigger: "Autom\u00e1tico ao finalizar alerta", credits: "Alto" },
  { name: "gerarDocumentacaoPDF", desc: "Gera documenta\u00e7\u00e3o t\u00e9cnica completa do sistema em PDF com cat\u00e1logo de entidades, fluxos e arquitetura.", trigger: "Sob demanda (painel admin)", credits: "Baixo" },
  { name: "obterMidiaCriptografada", desc: "Descriptografa e retorna URL tempor\u00e1ria para acesso seguro \u00e0 m\u00eddia capturada em segundo plano durante alertas.", trigger: "Sob demanda (Central de Despacho)", credits: "Baixo" },
  { name: "runSystemHealthCheck", desc: "Executa verifica\u00e7\u00e3o completa de sa\u00fade do sistema testando todos os fluxos (cidad\u00e3o, agente, admin).", trigger: "Sob demanda (painel admin)", credits: "M\u00e9dio" },
  { name: "simulacaoEstresseQA", desc: "Simula\u00e7\u00e3o de estresse para QA \u2014 gera dados sint\u00e9ticos, cria ocorr\u00eancias e testa o fluxo completo de triagem e despacho.", trigger: "Sob demanda (painel QA)", credits: "M\u00e9dio" },
  { name: "triagemOcorrencia", desc: "Executa a triagem inicial de uma ocorr\u00eancia via IA, classificando prioridade e detectando poss\u00edveis trotes.", trigger: "Autom\u00e1tico ao criar ocorr\u00eancia", credits: "M\u00e9dio" },
  { name: "verificarCercasGeograficas", desc: "Verifica se h\u00e1 usu\u00e1rios dentro de cercas geogr\u00e1ficas ativas de Defesa Civil e dispara alertas.", trigger: "Agendado / Sob demanda", credits: "Alto" },
];

// ─── MAIN ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PH = doc.internal.pageSize.height;
    let y = 20;

    // ═══ COVER PAGE ═══
    // Background stripe
    doc.setFillColor(...rgb(C.dark));
    doc.rect(0, 0, 210, 297, 'F');

    // Accent bar
    doc.setFillColor(...rgb(C.primary));
    doc.rect(0, 90, 210, 3, 'F');
    doc.rect(0, 200, 210, 3, 'F');

    // Logo area
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(...rgb(C.white));
    doc.text('SENTINELA', 105, 70, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(...rgb(C.lightGray));
    doc.text('SEGURAN\u00c7A CIDAD\u00c3', 105, 82, { align: 'center' });

    // Document info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...rgb(C.white));
    doc.text('Documenta\u00e7\u00e3o T\u00e9cnica Completa', 105, 115, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(...rgb(C.lightGray));
    doc.text('Vers\u00e3o 3.0 \u2014 Junho 2026', 105, 125, { align: 'center' });

    // Description
    doc.setFontSize(9);
    doc.setTextColor(140, 150, 160);
    const descs = [
      'Plataforma integrada de seguran\u00e7a p\u00fablica com intelig\u00eancia artificial,',
      'biometria invertida, geofencing, an\u00e1lise preditiva criminal,',
      'central de despacho em tempo real e rede comunit\u00e1ria de prote\u00e7\u00e3o.'
    ];
    descs.forEach((d, i) => doc.text(d, 105, 150 + (i * 6), { align: 'center' }));

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('CONFIDENCIAL \u2014 USO INTERNO', 105, 280, { align: 'center' });

    // ═══ TABLE OF CONTENTS ═══
    doc.addPage();
    y = 30;
    y = sectionTitle(doc, '\u00cdNDICE', y);
    y += 8;

    const toc = [
      ['1.', 'VIS\u00c3O GERAL DO SISTEMA', 'Prop\u00f3sito, funcionalidades e escopo'],
      ['2.', 'ARQUITETURA E TECNOLOGIAS', 'Stack t\u00e9cnica e infraestrutura'],
      ['3.', 'SISTEMA DE PAP\u00c9IS (ROLES)', 'Perfis de acesso e permiss\u00f5es'],
      ['4.', 'CAT\u00c1LOGO DE ENTIDADES', 'Schema completo de todas as entidades'],
      ['5.', 'MAPA DE RELACIONAMENTOS', 'Diagrama conceitual entre entidades'],
      ['6.', 'BACKEND FUNCTIONS', 'Fun\u00e7\u00f5es serverless do sistema'],
      ['7.', 'FLUXOS PRINCIPAIS', 'Fluxos fim-a-fim detalhados'],
      ['8.', 'M\u00d3DULOS DO SISTEMA', 'M\u00f3dulos e componentes React'],
      ['9.', 'SEGURAN\u00c7A E RLS', 'Pol\u00edticas de seguran\u00e7a e acesso a dados'],
    ];

    toc.forEach(([num, title, desc]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...rgb(C.primary));
      doc.text(num, 25, y);
      doc.text(title, 37, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...rgb(C.lightGray));
      doc.text(desc, 37, y + 5.5);
      y += 13;
    });

    // ═══ 1. VIS\u00c3O GERAL ═══
    doc.addPage();
    y = 25;
    y = sectionTitle(doc, '1. VIS\u00c3O GERAL DO SISTEMA', y);
    y = bodyText(doc, 'O SENTINELA \u00e9 uma plataforma de seguran\u00e7a cidad\u00e3 que integra cidad\u00e3os, agentes de seguran\u00e7a p\u00fablica (policiais, bombeiros, socorristas), psic\u00f3logos e administradores em um ecossistema unificado de preven\u00e7\u00e3o, resposta e an\u00e1lise de incidentes.', y);

    y = bodyText(doc, 'A plataforma utiliza intelig\u00eancia artificial avan\u00e7ada (Claude, Gemini, Whisper) para triagem autom\u00e1tica de ocorr\u00eancias, detec\u00e7\u00e3o de trotes, an\u00e1lise preditiva criminal, gera\u00e7\u00e3o autom\u00e1tica de boletins de ocorr\u00eancia jur\u00eddicos e reconhecimento de padr\u00f5es ac\u00fasticos em \u00e1udio capturado durante emerg\u00eancias.', y);

    y += 3;
    y = subTitle(doc, 'Pilares do Sistema', y);
    y = bulletList(doc, [
      'PROTE\u00c7\u00c3O (Cidad\u00e3o): Biometria Invertida com PIN de coa\u00e7\u00e3o via calculadora disfar\u00e7ada, monitoramento card\u00edaco por wearables, geofencing infantil, rotas seguras, Caminhe Comigo, perfil m\u00e9dico de emerg\u00eancia.',
      'AUTONOMIA (Agente): Central do Agente com mapa t\u00e1tico, checklist de viatura e equipamentos, gerenciamento de turno, chat unificado, r\u00e1dio offline, patrulha virtual, monitoramento de fadiga.',
      'GEST\u00c3O (Admin): Dashboard anal\u00edtico com 30+ abas, KPIs estrat\u00e9gicos, heatmaps operacionais, aloca\u00e7\u00e3o inteligente de turnos, invent\u00e1rio t\u00e1tico, manuten\u00e7\u00e3o de frota, gest\u00e3o de treinamentos.',
      'DESPACHO (Central): Tela full-screen em tempo real com fila de alertas priorizada, mapa t\u00e1tico, reprodutor de \u00e1udio criptografado e transcri\u00e7\u00e3o com highlights.',
      'INTELIG\u00caNCIA (IA): Triagem autom\u00e1tica, gera\u00e7\u00e3o de BO jur\u00eddico, an\u00e1lise preditiva criminal, detec\u00e7\u00e3o de trotes, reconhecimento ac\u00fastico de amea\u00e7as.',
      'COMUNIDADE (Rede): Anjos da Guarda volunt\u00e1rios, den\u00fancias an\u00f4nimas, ranking gamificado de cidad\u00e3os, feed de not\u00edcias de seguran\u00e7a.',
    ], y);

    // ═══ 2. ARQUITETURA ═══
    y += 5;
    y = sectionTitle(doc, '2. ARQUITETURA E TECNOLOGIAS', y);

    y = subTitle(doc, 'Frontend', y);
    y = bulletList(doc, [
      'React 18 com Vite (build r\u00e1pido, HMR)',
      'Tailwind CSS + shadcn/ui (design system com tema escuro)',
      'React Router DOM v6 (roteamento SPA com layouts por perfil)',
      'Leaflet + React-Leaflet (mapas interativos com marcadores e heatmaps)',
      'Recharts (gr\u00e1ficos anal\u00edticos e dashboards)',
      'React Quill (editor de texto rico para BOs)',
      'Framer Motion (anima\u00e7\u00f5es de interface)',
      '@hello-pangea/dnd (drag and drop para filas de despacho)',
      '@tanstack/react-query (gerenciamento de estado de dados)',
    ], y);

    y = subTitle(doc, 'Backend (BaaS Base44)', y);
    y = bulletList(doc, [
      'Autentica\u00e7\u00e3o JWT com provedor de identidade integrado',
      'Banco de dados NoSQL com Row-Level Security (RLS)',
      'Fun\u00e7\u00f5es serverless em Deno (JavaScript runtime seguro)',
      'Armazenamento de arquivos com criptografia e URLs tempor\u00e1rias',
      'Integra\u00e7\u00f5es de IA: InvokeLLM (Claude, Gemini), Whisper (transcri\u00e7\u00e3o)',
      'Sistema de filas e automa\u00e7\u00f5es (cron, entity triggers, webhooks)',
      'Subscriptions em tempo real para Central de Despacho',
      'SDK cliente unificado (@base44/sdk)',
    ], y);

    y = subTitle(doc, 'Modelos de IA', y);
    y = bulletList(doc, [
      'Claude Sonnet 4.6: Gera\u00e7\u00e3o de BOs jur\u00eddicos e an\u00e1lises complexas',
      'Claude Opus 4.6: An\u00e1lises preditivas de alta complexidade',
      'Gemini 3.1 Pro: Triagem com contexto de internet (web search)',
      'Gemini 3 Flash: Triagem r\u00e1pida com baixo consumo de cr\u00e9ditos',
      'Whisper: Transcri\u00e7\u00e3o de \u00e1udio para texto em tempo real',
    ], y);

    // ═══ 3. ROLES ═══
    y += 5;
    y = sectionTitle(doc, '3. SISTEMA DE PAP\u00c9IS (ROLES)', y);
    y = bodyText(doc, 'O SENTINELA opera com 4 pap\u00e9is distintos. Cada usu\u00e1rio pode acumular m\u00faltiplos pap\u00e9is, e o sistema de layout se adapta automaticamente ao papel mais elevado do usu\u00e1rio.', y);

    const roles = [
      { role: 'CITIZEN (Cidad\u00e3o)', color: C.accent, desc: 'Usu\u00e1rio final do sistema. Reporta ocorr\u00eancias, configura biometria de coa\u00e7\u00e3o, gerencia per\u00edmetros infantis e perfil m\u00e9dico. Utiliza rotas seguras e Caminhe Comigo. Acesso restrito aos pr\u00f3prios dados.' },
      { role: 'AGENT (Agente de Seguran\u00e7a)', color: C.primary, desc: 'Profissional de seguran\u00e7a p\u00fablica. Atende ocorr\u00eancias, gerencia turnos e viaturas, acessa mapa t\u00e1tico, central de despacho, chat unificado e checklist de equipamentos. V\u00ea todas as ocorr\u00eancias e alertas. Participa de treinamentos e avalia\u00e7\u00f5es psicol\u00f3gicas.' },
      { role: 'PSYCHOLOGIST (Psic\u00f3logo)', color: [150, 70, 200], desc: 'Profissional de sa\u00fade mental. Acesso ao painel de bem-estar dos agentes, avalia\u00e7\u00f5es psicol\u00f3gicas peri\u00f3dicas, agendamentos e relat\u00f3rios de fadiga operacional.' },
      { role: 'ADMIN (Administrador)', color: C.danger, desc: 'Acesso total ao sistema. Gerencia usu\u00e1rios, agentes, viaturas, invent\u00e1rio, c\u00e2meras, treinamentos, an\u00e1lises preditivas, cercas geogr\u00e1ficas e configura\u00e7\u00f5es do sistema. \u00c9 o \u00fanico capaz de executar testes de QA e health checks.' },
    ];

    roles.forEach(r => {
      y = checkPage(doc, y, 25);
      doc.setFillColor(r.color[0], r.color[1], r.color[2]);
      doc.rect(18, y, 3, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(r.color[0], r.color[1], r.color[2]);
      doc.text(r.role, 25, y + 6);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 55, 65);
      const rLines = doc.splitTextToSize(r.desc, 165);
      doc.text(rLines, 25, y);
      y += (rLines.length * 4) + 4;
    });

    // ═══ 4. ENTITIES CATALOG ═══
    doc.addPage();
    y = 25;
    y = sectionTitle(doc, '4. CAT\u00c1LOGO DE ENTIDADES', y);
    y = bodyText(doc, 'O sistema possui 19 entidades principais organizadas por dom\u00ednio funcional. Cada entidade \u00e9 apresentada com seu schema completo de campos, tipos, obrigatoriedade e descri\u00e7\u00f5es.', y);

    for (const [name, schema] of Object.entries(E)) {
      y = entityTable(doc, name, schema, y);
    }

    // ═══ 5. RELATIONSHIPS ═══
    doc.addPage();
    y = 25;
    y = sectionTitle(doc, '5. MAPA DE RELACIONAMENTOS', y);
    y = bodyText(doc, 'Diagrama conceitual dos principais relacionamentos entre entidades do sistema. A cardinalidade \u00e9 representada como 1---1 (um para um), 1---* (um para muitos) e *---* (muitos para muitos).', y);
    y += 2;

    const rels = [
      ['User (cidad\u00e3o)', '1\u2014\u2014*', 'Occurrence', 'reporta'],
      ['User (agente)', '1\u2014\u2014*', 'Occurrence', 'atende'],
      ['User (cidad\u00e3o)', '1\u2014\u2014*', 'Alertas_Inteligencia_IA', 'dispara'],
      ['Alertas_Inteligencia_IA', '1\u2014\u20141', 'Boletins_Ocorrencia_Gerados', 'gera'],
      ['Alertas_Inteligencia_IA', '1\u2014\u20141', 'Occurrence', 'associado a'],
      ['User (respons\u00e1vel)', '1\u2014\u2014*', 'Perimetros_Seguranca_Infantil', 'configura'],
      ['User (cidad\u00e3o)', '1\u2014\u20141', 'Perfis_Medicos_Usuarios', 'possui'],
      ['User (cidad\u00e3o)', '1\u2014\u20141', 'Configuracoes_Biometria_Coacao', 'configura'],
      ['User (cidad\u00e3o)', '1\u2014\u2014*', 'Logs_Frequencia_Cardiaca_Wearables', 'registra'],
      ['User (cidad\u00e3o)', '1\u2014\u2014*', 'Sessoes_CaminheComigo', 'inicia'],
      ['User (volunt\u00e1rio)', '1\u2014\u20141', 'Anjos_Guarda', 'cadastra'],
      ['User (agente)', '1\u2014\u2014*', 'Shift', 'trabalha em'],
      ['User (reportante)', '1\u2014\u2014*', 'Alertas_Quarentena', 'gera'],
      ['Occurrence', '1\u2014\u20141', 'Alertas_Quarentena', 'suspeita de'],
      ['Cercas_Geograficas_Defesa_Civil', '1\u2014\u2014*', 'Notificacoes_Geofence', 'dispara'],
      ['User (cidad\u00e3o)', '1\u2014\u2014*', 'Notificacoes_Geofence', 'recebe'],
      ['User', '1\u2014\u2014*', 'PointsLog', 'acumula'],
      ['Occurrence', '1\u2014\u2014*', 'PointsLog', 'referenciada em'],
      ['User (agente)', '*\u2014\u2014*', 'TrainingModule', 'progride em'],
      ['User (agente)', '1\u2014\u2014*', 'ShiftBreadcrumb', 'registra rota'],
    ];

    rels.forEach(([from, card, to, desc]) => {
      y = checkPage(doc, y, 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...rgb(C.primary));
      doc.text(from, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 55, 65);
      doc.text(card, 75, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...rgb(C.primary));
      doc.text(to, 100, y);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...rgb(C.lightGray));
      doc.text('\u2192 ' + desc, 155, y);
      y += 5.5;
    });

    // ═══ 6. BACKEND FUNCTIONS ═══
    y += 5;
    y = sectionTitle(doc, '6. BACKEND FUNCTIONS', y);
    y = bodyText(doc, 'Fun\u00e7\u00f5es serverless em Deno que implementam a l\u00f3gica de neg\u00f3cio do sistema. Cada fun\u00e7\u00e3o \u00e9 independente e acionada sob demanda, por automa\u00e7\u00e3o ou em resposta a eventos de entidade.', y);

    FUNCTIONS.forEach(fn => {
      y = checkPage(doc, y, 25);
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(18, y - 1, 174, 20, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...rgb(C.primary));
      doc.text(fn.name, 22, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 55, 65);
      const dLines = doc.splitTextToSize(fn.desc, 148);
      doc.text(dLines, 22, y + 13);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...rgb(C.lightGray));
      doc.text('Trigger: ' + fn.trigger + '  |  Consumo: ' + fn.credits, 22, y + 13 + (dLines.length * 4));
      y += 23 + (dLines.length * 4);
    });

    // ═══ 7. CORE FLOWS ═══
    doc.addPage();
    y = 25;
    y = sectionTitle(doc, '7. FLUXOS PRINCIPAIS', y);

    const flows = [
      {
        title: '7.1 Fluxo de Emerg\u00eancia (Cidad\u00e3o em Risco)',
        steps: [
          'Cidad\u00e3o em risco disca PIN de coa\u00e7\u00e3o na calculadora disfar\u00e7ada (Modo Disfarce).',
          'Sistema captura \u00e1udio/v\u00eddeo em segundo plano e geolocaliza\u00e7\u00e3o precisa via GPS.',
          'Alerta_Inteligencia_IA \u00e9 criado com status TRIAGEM_IA e transmitido em tempo real.',
          'IA processa \u00e1udio: transcri\u00e7\u00e3o (Whisper) + an\u00e1lise ac\u00fastica com tags (Gritos, Men\u00e7\u00e3o_Arma, Estresse_Alto).',
          'IA classifica prioridade automaticamente: CR\u00cdTICO_RISCO_MORTE / ALTO / M\u00c9DIO / BAIXO.',
          'Alerta aparece na Central de Despacho em tempo real via subscription.',
          'Agente de despacho ouve \u00e1udio criptografado, l\u00ea transcri\u00e7\u00e3o com highlights.',
          'Agente despacha viatura mais pr\u00f3xima ou solicita apoio conforme prioridade.',
          'Ao finalizar, fun\u00e7\u00e3o gerarBoletimOcorrencia cria BO jur\u00eddico automaticamente com IA.',
          'Agente revisa, edita se necess\u00e1rio e assina digitalmente o BO no painel administrativo.',
        ]
      },
      {
        title: '7.2 Fluxo de Ocorr\u00eancia Comum (Cidad\u00e3o \u2192 Agente)',
        steps: [
          'Cidad\u00e3o registra ocorr\u00eancia no app com tipo, descri\u00e7\u00e3o, m\u00eddia e localiza\u00e7\u00e3o.',
          'Fun\u00e7\u00e3o triagemOcorrencia classifica prioridade e detecta poss\u00edveis trotes automaticamente.',
          'Se detectada suspeita de trote, Alertas_Quarentena \u00e9 criado para revis\u00e3o humana.',
          'Agente visualiza ocorr\u00eancias ordenadas por score de urg\u00eancia (sortByUrgency).',
          'Agente assume ocorr\u00eancia (status: in_progress, assigned_agent_id).',
          'Chat unificado (UnifiedChat) \u00e9 estabelecido entre agente e cidad\u00e3o.',
          'Agente resolve ocorr\u00eancia com notas de resolu\u00e7\u00e3o (status: resolved).',
          'Sistema concede pontos: 25 pts ao cidad\u00e3o reportante e 15 pts ao agente resolvedor.',
        ]
      },
      {
        title: '7.3 Fluxo de Geofencing (Defesa Civil)',
        steps: [
          'Admin cria Cerca_Geografica_Defesa_Civil com pol\u00edgono, tipo de risco e mensagem de alerta.',
          'Admin ativa a cerca (status: ativo); a cerca fica vis\u00edvel para agentes.',
          'Fun\u00e7\u00e3o verificarCercasGeograficas (agendada) varre usu\u00e1rios dentro dos pol\u00edgonos ativos.',
          'Usu\u00e1rios localizados dentro da cerca recebem Notificacao_Geofence via push/SMS/email.',
          'Cidad\u00e3o afetado v\u00ea alerta no dashboard (GeofenceAlertCard) com n\u00edvel de urg\u00eancia.',
          'Fun\u00e7\u00e3o dispararGeofenceUsuarios gerencia o envio em lote para m\u00faltiplos canais.',
        ]
      },
      {
        title: '7.4 Fluxo de Treinamento (Agente)',
        steps: [
          'Admin cria m\u00f3dulos de treinamento com v\u00eddeos, quizzes e tarefas pr\u00e1ticas (TrainingModule).',
          'Agente acessa Central de Treinamento, assiste aos v\u00eddeos e responde quizzes.',
          'Progresso \u00e9 registrado em TrainingProgress com status, score e tentativas.',
          'Admin revisa tarefas submetidas (review_status: approved/revision) e d\u00e1 feedback.',
          'Certificados s\u00e3o emitidos automaticamente ao concluir todos os m\u00f3dulos (CertificateRecord).',
        ]
      },
      {
        title: '7.5 Fluxo de Health Check (Qualidade do Sistema)',
        steps: [
          'Fun\u00e7\u00e3o cronSystemHealthCheck \u00e9 executada periodicamente via automa\u00e7\u00e3o agendada.',
          'runSystemHealthCheck testa todos os fluxos por perfil (citizen, agent, admin, system).',
          'Cada teste \u00e9 registrado em SystemHealthLog com status, lat\u00eancia e mensagens de erro.',
          'Admin monitora sa\u00fade do sistema no painel SystemHealthDashboard com gr\u00e1ficos.',
          'Alertas de erro cr\u00edtico s\u00e3o notificados automaticamente aos administradores.',
        ]
      },
      {
        title: '7.6 Fluxo Caminhe Comigo (Compartilhamento de Localiza\u00e7\u00e3o)',
        steps: [
          'Cidad\u00e3o inicia sess\u00e3o CaminheComigo definindo destino e contato de emerg\u00eancia.',
          'Sistema gera token \u00fanico e link compartilh\u00e1vel (WhatsApp) para contatos de confian\u00e7a.',
          'GPS rastreado em tempo real e exibido no mapa Leaflet para visualizadores autorizados.',
          'Algoritmo detecta anomalias de movimento: corrida s\u00fabita, mudan\u00e7a brusca de dire\u00e7\u00e3o.',
          'Anomalia detectada dispara alerta de p\u00e2nico autom\u00e1tico com geolocaliza\u00e7\u00e3o.',
          'Contato de emerg\u00eancia \u00e9 notificado automaticamente via WhatsApp com link de rastreamento.',
          'Visualizador p\u00fablico (CaminheComigoViewer) permite acompanhar sem necessidade de login.',
        ]
      },
    ];

    flows.forEach(flow => {
      y = checkPage(doc, y, 40);
      y = subTitle(doc, flow.title, y);
      flow.steps.forEach((step, si) => {
        y = checkPage(doc, y, 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...rgb(C.primary));
        doc.text(String(si + 1) + '.', 25, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 55, 65);
        const sLines = doc.splitTextToSize(step, 158);
        doc.text(sLines, 33, y);
        y += (sLines.length * 4) + 0.5;
      });
      y += 4;
    });

    // ═══ 8. MODULES ═══
    doc.addPage();
    y = 25;
    y = sectionTitle(doc, '8. M\u00d3DULOS DO SISTEMA', y);

    const modules = [
      {
        name: 'Dashboard do Cidad\u00e3o (CitizenDashboard)',
        desc: 'Hub principal do cidad\u00e3o. Acesso r\u00e1pido a: registro de ocorr\u00eancias, bot\u00e3o de p\u00e2nico, status de medidas protetivas, alertas de geofence, perfil m\u00e9dico de emerg\u00eancia, per\u00edmetros infantis, ranking de seguran\u00e7a, rotas seguras e Caminhe Comigo.',
        components: 'PanicButton, RegisterOccurrenceDialog, GeofenceAlertCard, PerfilMedicoForm, PerimetroInfantilManager, GuardianNetwork, CitizenRankingPanel, SecurityNewsFeed, FirstAidGuide, CoercionBiometricConfig, CitizenProgressBar, ProtectiveMeasureCard, EmergencyContactsManager'
      },
      {
        name: 'Dashboard do Agente (AgentDashboard)',
        desc: 'Central operacional do agente de seguran\u00e7a. Lista de ocorr\u00eancias ordenadas por score de urg\u00eancia com filtros avan\u00e7ados, mapa t\u00e1tico interativo com c\u00e2meras pr\u00f3ximas e agentes ativos, gerenciamento completo de turno, checklist de viatura e equipamentos, chat unificado com cidad\u00e3os, monitor de fadiga operacional, miss\u00f5es do turno e patrulha virtual com drones.',
        components: 'LiveMap, ShiftManager, OccurrenceRow, OccurrenceChat, VehicleChecklistDialog, EquipmentChecklistDialog, FatigueMonitor, ShiftMissions, UnifiedChat, OfflineRadio, VirtualPatrolMode, BiometricCheckIn, CriticalAlert, ResolveOccurrenceDialog, AgentMedalCard, PredictivePatrol, MaintenanceTicketDialog'
      },
      {
        name: 'Central de Despacho (CentralDespacho)',
        desc: 'Tela full-screen otimizada para despacho de alertas de IA em tempo real. Layout de 3 colunas responsivas: fila de alertas priorizada com indicadores de tempo decorrido, painel detalhado com player de \u00e1udio criptografado e transcri\u00e7\u00e3o com highlights, mapa t\u00e1tico com rotas integradas (Google Maps e Waze) e bot\u00f5es de a\u00e7\u00f5es r\u00e1pidas.',
        components: 'AlertCard com ElapsedTimer, MapMarker/MapUpdater, Audio player com descriptografia, AlertActions com bot\u00f5es de despacho e emerg\u00eancia'
      },
      {
        name: 'Painel Administrativo (AdminDashboard)',
        desc: 'Dashboard completo com mais de 30 abas organizadas em 9 categorias: Vis\u00e3o Geral, Intelig\u00eancia & Mapas, Agentes & Escalas, Comunidade, Documentos, Frota & Equipamentos, Vigil\u00e2ncia, Relat\u00f3rios e Sa\u00fade do Sistema. Interface de gest\u00e3o total da plataforma.',
        components: 'AdminTabNav, StrategicKPIs, OperationalHeatmap, CameraManager, VehicleManager, PatrolScheduler, InventoryManager, TrainingManager, AgentLeaderboard, ShiftCalendar, PsychPanel, HeatmapPatrolDashboard, ForensicIntelligence, SmartShiftAllocator, TacticalStockManager, FleetMaintenanceManager, FatigueRiskPanel, ProductivityReport, SystemHealthDashboard, QaEstressePanel, TacticalCommandCenter, GuardianManager, BoletimOcorrenciaPanel, PdfReportGenerator'
      },
      {
        name: 'Modo Disfarce (DisguisedMode)',
        desc: 'Calculadora funcional que esconde o sistema de emerg\u00eancia. PINs de coa\u00e7\u00e3o e desarme s\u00e3o integrados a opera\u00e7\u00f5es matem\u00e1ticas normais. Ao detectar o PIN de coa\u00e7\u00e3o ap\u00f3s uma opera\u00e7\u00e3o de igualdade, dispara alerta silencioso com captura de \u00e1udio/v\u00eddeo sem revelar a natureza do aplicativo.',
        components: 'Calculadora completa com teclado num\u00e9rico, display e detec\u00e7\u00e3o de sequ\u00eancias secretas, integra\u00e7\u00e3o com geolocaliza\u00e7\u00e3o'
      },
      {
        name: 'Central de Treinamento (TrainingCenter)',
        desc: 'Plataforma de capacita\u00e7\u00e3o continuada para agentes. M\u00f3dulos com v\u00eddeos, quizzes interativos, tarefas pr\u00e1ticas avaliadas e certifica\u00e7\u00e3o digital. Sistema de revis\u00e3o por administradores com feedback personalizado.',
        components: 'TrainingQuiz, CertificatePanel, AgentTaskReview, TrainingModule viewer'
      },
      {
        name: 'Central de Mensagens (MessagingCenter)',
        desc: 'Sistema completo de mensageria entre agentes, administradores e cidad\u00e3os. Suporte a threads de conversa vinculadas a ocorr\u00eancias, mensagens diretas, notifica\u00e7\u00f5es em tempo real e r\u00e1dio offline para comunica\u00e7\u00e3o sem internet.',
        components: 'UnifiedChat, DirectMessage, MessageThread, NewThreadDialog, OfflineRadio, MessagingBadge'
      },
    ];

    modules.forEach(mod => {
      y = checkPage(doc, y, 40);
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(18, y - 2, 174, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...rgb(C.primary));
      doc.text(mod.name, 22, y + 4);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 55, 65);
      const mLines = doc.splitTextToSize(mod.desc, 170);
      doc.text(mLines, 22, y);
      y += (mLines.length * 4) + 2;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...rgb(C.lightGray));
      const cLines = doc.splitTextToSize('Componentes: ' + mod.components, 170);
      doc.text(cLines, 22, y);
      y += (cLines.length * 3.5) + 6;
    });

    // ═══ 9. SECURITY ═══
    y += 3;
    y = sectionTitle(doc, '9. SEGURAN\u00c7A E RLS', y);

    y = subTitle(doc, 'Row-Level Security (RLS)', y);
    y = bodyText(doc, 'Cada entidade do sistema possui regras de acesso baseadas no papel do usu\u00e1rio autenticado. O RLS \u00e9 aplicado em n\u00edvel de banco de dados, garantindo que cidad\u00e3os acessem apenas seus pr\u00f3prios dados, agentes tenham acesso de leitura amplo a ocorr\u00eancias e alertas, e administradores tenham acesso total para gest\u00e3o da plataforma.', y);

    y = subTitle(doc, 'Biometria Invertida (Coer\u00e7\u00e3o)', y);
    y = bodyText(doc, 'O sistema de Biometria Invertida permite que o cidad\u00e3o configure um PIN de coa\u00e7\u00e3o diferente do PIN de desarme. Ao digitar o PIN de coa\u00e7\u00e3o na calculadora disfar\u00e7ada, o sistema simula o desarme mas, na verdade, dispara um alerta silencioso com captura de \u00e1udio e v\u00eddeo em segundo plano. O agressor n\u00e3o percebe que a v\u00edtima acionou ajuda, aumentando significativamente as chances de uma resposta bem-sucedida.', y);

    y = subTitle(doc, 'M\u00eddia Criptografada', y);
    y = bodyText(doc, '\u00c1udios e v\u00eddeos capturados durante emerg\u00eancias s\u00e3o armazenados com criptografia no lado do servidor. O acesso a esses arquivos \u00e9 feito exclusivamente via token tempor\u00e1rio gerado pela fun\u00e7\u00e3o obterMidiaCriptografada, com tempo de expira\u00e7\u00e3o limitado e auditoria de cada acesso. Nenhum arquivo de m\u00eddia de emerg\u00eancia \u00e9 acess\u00edvel publicamente.', y);

    y = subTitle(doc, 'Autentica\u00e7\u00e3o e Autoriza\u00e7\u00e3o', y);
    y = bodyText(doc, 'A plataforma utiliza autentica\u00e7\u00e3o JWT gerenciada pelo Base44. Todas as chamadas de API s\u00e3o autenticadas automaticamente pelo SDK. A autoriza\u00e7\u00e3o \u00e9 aplicada em tr\u00eas camadas: Role Guards no frontend (React Router), RLS no banco de dados e valida\u00e7\u00e3o de usu\u00e1rio nas fun\u00e7\u00f5es backend. Tokens t\u00eam expira\u00e7\u00e3o e s\u00e3o renovados automaticamente.', y);

    // ═══ FOOTERS ═══
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // Header line
      if (i > 1) {
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.3);
        doc.line(15, 18, 195, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...rgb(C.lightGray));
        doc.text('SENTINELA \u2014 Documenta\u00e7\u00e3o T\u00e9cnica', 15, 15);
        doc.text('v3.0', 195, 15, { align: 'right' });
      }
      // Footer
      doc.setDrawColor(220, 225, 235);
      doc.setLineWidth(0.3);
      doc.line(15, PH - 13, 195, PH - 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...rgb(C.lightGray));
      doc.text('CONFIDENCIAL', 15, PH - 8);
      doc.text('P\u00e1gina ' + i + ' de ' + totalPages, 105, PH - 8, { align: 'center' });
      doc.text('Junho 2026', 195, PH - 8, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=Sentinela_Documentacao_Tecnica_v3.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});