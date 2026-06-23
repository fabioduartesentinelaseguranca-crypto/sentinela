import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Helper: add a section title
function addSection(doc, title, y) {
  doc.setFontSize(16);
  doc.setTextColor(30, 144, 255);
  doc.text(title, 20, y);
  doc.setDrawColor(30, 144, 255);
  doc.setLineWidth(0.5);
  doc.line(20, y + 3, 190, y + 3);
  return y + 12;
}

// Helper: add subsection title
function addSubSection(doc, title, y) {
  doc.setFontSize(13);
  doc.setTextColor(50, 50, 50);
  doc.text(title, 20, y);
  return y + 8;
}

// Helper: add body text
function addText(doc, text, y, indent = 20) {
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const lines = doc.splitTextToSize(text, 190 - indent);
  doc.text(lines, indent, y);
  return y + (lines.length * 5) + 4;
}

// Helper: add entity table
function addEntityTable(doc, entityName, schema, y) {
  const pageHeight = doc.internal.pageSize.height;
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 25;
  }

  doc.setFontSize(11);
  doc.setTextColor(30, 144, 255);
  doc.text(entityName, 20, y);
  y += 7;

  // Description
  if (schema.description) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const descLines = doc.splitTextToSize(schema.description, 170);
    doc.text(descLines, 20, y);
    y += (descLines.length * 4) + 3;
  }

  // Table header
  const headers = ["Campo", "Tipo", "Obrigatório", "Descrição"];
  const colWidths = [50, 40, 22, 58];
  let xPos = 20;

  doc.setFillColor(30, 144, 255);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  headers.forEach((h, i) => {
    doc.rect(xPos, y, colWidths[i], 7, 'F');
    doc.text(h, xPos + 2, y + 5);
    xPos += colWidths[i];
  });
  y += 9;

  // Table rows
  const props = schema.properties || {};
  const required = schema.required || [];
  const entries = Object.entries(props);

  entries.forEach(([key, prop], idx) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 25;
    }

    const bg = idx % 2 === 0 ? '#F8F9FA' : '#FFFFFF';
    xPos = 20;
    const row = [
      key,
      formatType(prop),
      required.includes(key) ? 'Sim' : 'Não',
      (prop.description || '').substring(0, 80)
    ];

    doc.setFillColor(...hexToRgb(bg));
    doc.rect(xPos, y - 1, colWidths.reduce((a, b) => a + b, 0), 9, 'F');

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7);
    row.forEach((cell, i) => {
      doc.text(String(cell).substring(0, 35), xPos + 2, y + 5);
      xPos += colWidths[i];
    });
    y += 10;
  });

  return y + 5;
}

function formatType(prop) {
  if (prop.enum) return 'enum';
  if (prop.type === 'array') {
    if (prop.items?.type) return `array<${prop.items.type}>`;
    return 'array<object>';
  }
  if (prop.type === 'object') return 'object';
  return prop.type || 'string';
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
}

// ─── ENTITY DEFINITIONS ─────────────────────────────────────
const ENTITIES = {
  "Occurrence": {
    description: "Registro central de ocorrências reportadas por cidadãos ou agentes. É a entidade principal do sistema.",
    properties: {
      type: { type: "string", enum: ["crime", "traffic", "civil_defense", "health", "panic"], description: "Tipo principal da ocorrência" },
      subtype: { type: "string", description: "Subtipo específico (ex: roubo, acidente, enchente, SAMU)" },
      status: { type: "string", enum: ["open", "in_progress", "resolved", "canceled"], description: "Status atual", default: "open" },
      description: { type: "string", description: "Descrição detalhada da ocorrência" },
      lat: { type: "number", description: "Latitude da localização" },
      lng: { type: "number", description: "Longitude da localização" },
      address: { type: "string", description: "Endereço descritivo" },
      media_urls: { type: "array", items: { type: "string" }, description: "URLs de fotos, vídeos, áudios anexados" },
      reporter_id: { type: "string", description: "ID do cidadão que reportou" },
      assigned_agent_id: { type: "string", description: "ID do agente atendendo" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Nível de prioridade", default: "medium" },
      resolution_notes: { type: "string", description: "Notas de resolução preenchidas pelo agente" },
      awarded_points: { type: "number", description: "Pontos concedidos ao cidadão quando resolvida", default: 0 },
    },
    required: ["type"],
    relationships: [
      { field: "reporter_id", target: "User", description: "Cidadão que registrou a ocorrência" },
      { field: "assigned_agent_id", target: "User", description: "Agente designado para atender" },
    ],
    rls: "Cidadãos criam e leem as próprias; Agentes leem/atualizam todas; Admins têm acesso total."
  },
  "Alertas_Inteligencia_IA": {
    description: "Registro de alertas disparados por IA a partir de gatilhos como Calculadora de Pânico ou Senha de Coerção. Alimenta a Central de Despacho.",
    properties: {
      id_usuario: { type: "string", description: "UUID do cidadão que acionou" },
      tipo_gatilho: { type: "string", enum: ["CALCULADORA_PANICO", "SENHA_COERCAO", "DESVIO_ROTA"], description: "Tipo de gatilho" },
      data_hora_brasilia: { type: "string", format: "date-time", description: "Horário do acionamento (GMT-3)" },
      geolocalizacao_latitude: { type: "number", description: "Latitude capturada" },
      geolocalizacao_longitude: { type: "number", description: "Longitude capturada" },
      status_alerta: { type: "string", enum: ["TRIAGEM_IA", "DESPACHADO_POLICIA", "EM_ANDAMENTO", "FINALIZADO", "SUSPEITA_TROTE"], description: "Status no fluxo de despacho" },
      url_audio_video_criptografado: { type: "string", description: "Link da mídia capturada em segundo plano" },
      transcricao_audio_ia: { type: "string", description: "Texto extraído por IA do áudio" },
      analise_acustica_tags: { type: "array", items: { type: "string" }, description: "Tags geradas pela IA (ex: Gritos, Menção_Arma)" },
      resumo_despacho_ia: { type: "string", description: "Resumo executivo de até 3 linhas" },
      grau_prioridade_ia: { type: "string", enum: ["CRÍTICO_RISCO_MORTE", "ALTO", "MÉDIO", "BAIXO"], description: "Prioridade classificada pela IA" },
    },
    required: ["tipo_gatilho", "data_hora_brasilia"],
    relationships: [
      { field: "id_usuario", target: "User", description: "Cidadão que disparou o alerta" },
    ],
    rls: "Cidadãos criam e leem os próprios; Agentes e Admins leem/atualizam todos."
  },
  "Boletins_Ocorrencia_Gerados": {
    description: "Boletins de Ocorrência gerados automaticamente por IA ao finalizar um alerta. Contém texto jurídico, tags visuais e telemetria IoT.",
    properties: {
      id_alerta: { type: "string", description: "ID do alerta de inteligência de origem" },
      id_ocorrencia: { type: "string", description: "ID da ocorrência associada" },
      texto_juridico_bo: { type: "string", description: "Texto completo do BO redigido pela IA" },
      tags_reconhecimento_visual: { type: "array", items: { type: "string" }, description: "Tags extraídas por visão computacional" },
      telemetria_iot: { type: "object", description: "Dados de telemetria IoT da viatura (velocidade, sirene, rota GPS)" },
      data_emissao: { type: "string", format: "date-time", description: "Data/hora de emissão" },
      status_assinatura: { type: "string", enum: ["rascunho", "assinado", "rejeitado"], description: "Status de assinatura digital" },
      assinatura_agente_responsavel: { type: "string", description: "Nome do agente que assinou" },
      assinatura_agente_id: { type: "string", description: "ID do agente que assinou" },
      texto_revisado_bo: { type: "string", description: "Versão final revisada pelo agente" },
      observacoes_revisao: { type: "string", description: "Observações da revisão" },
    },
    required: ["id_alerta"],
    relationships: [
      { field: "id_alerta", target: "Alertas_Inteligencia_IA", description: "Alerta que gerou o BO" },
      { field: "id_ocorrencia", target: "Occurrence", description: "Ocorrência associada" },
    ],
    rls: "Agentes criam/leem; Admins acesso total; Cidadãos leem os próprios via id_alerta."
  },
  "Perimetros_Seguranca_Infantil": {
    description: "Configuração de geofencing para proteção de crianças. Pais definem perímetros seguros (escolas, creches) e monitoram entrada/saída.",
    properties: {
      user_id: { type: "string", description: "ID do responsável (pai/mãe)" },
      user_name: { type: "string", description: "Nome do responsável" },
      nome_crianca: { type: "string", description: "Nome da criança protegida" },
      nome_local: { type: "string", description: "Nome descritivo do local" },
      tipo: { type: "string", enum: ["escola", "creche", "parque", "rota_escolar", "casa_parente", "outro"], description: "Tipo de local" },
      lat: { type: "number", description: "Latitude do perímetro" },
      lng: { type: "number", description: "Longitude do perímetro" },
      raio_metros: { type: "number", description: "Raio do perímetro em metros", default: 300 },
      horario_inicio: { type: "string", description: "Horário de início do monitoramento (HH:MM)" },
      horario_fim: { type: "string", description: "Horário de fim do monitoramento (HH:MM)" },
      dias_semana: { type: "array", items: { type: "integer" }, description: "Dias da semana (0=Domingo, 6=Sábado)" },
      dispositivo_crianca_id: { type: "string", description: "ID do dispositivo da criança" },
      ativo: { type: "boolean", description: "Perímetro ativo?", default: true },
    },
    required: ["user_id", "nome_crianca", "nome_local", "lat", "lng"],
    relationships: [{ field: "user_id", target: "User", description: "Responsável pela criança" }],
    rls: "Acesso restrito ao próprio user_id."
  },
  "Perfis_Medicos_Usuarios": {
    description: "Perfil médico do cidadão para uso em emergências. Contém tipo sanguíneo, alergias, condições e contatos de emergência.",
    properties: {
      user_id: { type: "string", description: "ID do cidadão" },
      user_name: { type: "string", description: "Nome do cidadão" },
      tipo_sanguineo: { type: "string", enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "nao_informado"], description: "Tipo sanguíneo" },
      alergias: { type: "array", items: { type: "string" }, description: "Lista de alergias" },
      restricoes_medicamentos: { type: "array", items: { type: "string" }, description: "Medicamentos contraindicados" },
      condicoes_preexistentes: { type: "array", items: { type: "string" }, description: "Condições médicas pré-existentes" },
      medicamentos_uso_continuo: { type: "array", items: { type: "string" }, description: "Medicamentos de uso contínuo" },
      contato_emergencia_nome: { type: "string", description: "Nome do contato de emergência" },
      contato_emergencia_telefone: { type: "string", description: "Telefone do contato de emergência" },
      contato_emergencia_parentesco: { type: "string", description: "Parentesco do contato" },
      plano_saude: { type: "string", description: "Plano de saúde" },
      observacoes: { type: "string", description: "Informações adicionais relevantes" },
    },
    required: ["user_id"],
    relationships: [{ field: "user_id", target: "User", description: "Cidadão dono do perfil" }],
    rls: "Cidadão gerencia o próprio; Agentes leem em emergência; Admins acesso total."
  },
  "Configuracoes_Biometria_Coacao": {
    description: "Configuração da Biometria Invertida — PIN de coação via calculadora disfarçada que dispara alerta silencioso.",
    properties: {
      user_id: { type: "string", description: "ID do cidadão" },
      user_name: { type: "string", description: "Nome do cidadão" },
      coacao_pin: { type: "string", description: "PIN de coação (dispara alerta ao ser digitado)" },
      coacao_ativada: { type: "boolean", description: "Recurso ativo?", default: true },
      disarm_pin: { type: "string", description: "PIN normal de desarme" },
      metodo_coacao: { type: "string", enum: ["pin", "digital_coacao", "face_coacao"], description: "Método biométrico", default: "pin" },
    },
    required: ["user_id"],
    relationships: [{ field: "user_id", target: "User", description: "Cidadão" }],
    rls: "Acesso restrito ao próprio user_id."
  },
  "Logs_Frequencia_Cardiaca_Wearables": {
    description: "Registro de batimentos cardíacos via wearables (smartwatch, Health Connect, Health Kit) para detecção de pânico autônomo.",
    properties: {
      user_id: { type: "string", description: "ID do cidadão" },
      user_name: { type: "string", description: "Nome do cidadão" },
      bpm: { type: "number", description: "Batimentos por minuto" },
      data_registro: { type: "string", format: "date-time", description: "Data/hora do registro" },
      origem: { type: "string", enum: ["smartwatch", "manual", "health_connect", "health_kit"], description: "Origem dos dados" },
      acao_tomada: { type: "string", enum: ["nenhuma", "alerta_enviado", "panico_autonomo", "confirmado_seguro", "queda_detectada"], description: "Ação automática" },
      status_resposta: { type: "string", enum: ["pendente", "seguro", "nao_respondeu"], description: "Status da verificação" },
      coordenada_lat: { type: "number", description: "Latitude no momento" },
      coordenada_lng: { type: "number", description: "Longitude no momento" },
    },
    required: ["user_id", "bpm"],
    relationships: [{ field: "user_id", target: "User", description: "Cidadão monitorado" }],
    rls: "Acesso restrito ao próprio user_id."
  },
  "Sessoes_CaminheComigo": {
    description: "Sessões de compartilhamento de localização em tempo real durante deslocamentos. Gera link compartilhável e detecta anomalias de movimento.",
    properties: {
      user_id: { type: "string", description: "ID do cidadão" },
      user_name: { type: "string", description: "Nome do cidadão" },
      status: { type: "string", enum: ["active", "ended"], description: "Status da sessão" },
      share_token: { type: "string", description: "Token único para link de compartilhamento" },
      origem_lat: { type: "number", description: "Latitude de origem" },
      origem_lng: { type: "number", description: "Longitude de origem" },
      destino_lat: { type: "number", description: "Latitude do destino" },
      destino_lng: { type: "number", description: "Longitude do destino" },
      destino_nome: { type: "string", description: "Nome do destino" },
      contato_notificado: { type: "string", description: "Contato de emergência notificado" },
      contato_telefone: { type: "string", description: "Telefone do contato" },
      started_at: { type: "string", format: "date-time", description: "Início da sessão" },
      ended_at: { type: "string", format: "date-time", description: "Fim da sessão" },
    },
    required: ["user_id", "share_token"],
    relationships: [{ field: "user_id", target: "User", description: "Cidadão em deslocamento" }],
    rls: "Cidadão gerencia as próprias sessões; Admins acesso total."
  },
  "Anjos_Guarda": {
    description: "Cadastro de voluntários comunitários (Anjos da Guarda) que auxiliam cidadãos em situações de risco no bairro.",
    properties: {
      user_id: { type: "string", description: "ID do voluntário" },
      user_name: { type: "string", description: "Nome completo" },
      telefone: { type: "string", description: "Telefone de contato" },
      bairro: { type: "string", description: "Bairro(s) de atuação" },
      cidade: { type: "string", description: "Cidade" },
      lat: { type: "number", description: "Latitude da base" },
      lng: { type: "number", description: "Longitude da base" },
      status: { type: "string", enum: ["pendente", "aprovado", "suspenso", "inativo"], description: "Status de aprovação" },
      certificacoes: { type: "array", items: { type: "string" }, description: "Certificações (primeiros socorros, brigadista, etc.)" },
      disponibilidade: { type: "string", enum: ["disponivel", "indisponivel", "dormindo"], description: "Disponibilidade atual" },
      total_atendimentos: { type: "number", description: "Total de atendimentos realizados" },
      avaliacao_media: { type: "number", description: "Avaliação média (1-5)" },
      observacoes: { type: "string", description: "Observações" },
    },
    required: ["user_id", "user_name", "bairro"],
    relationships: [{ field: "user_id", target: "User", description: "Voluntário" }],
    rls: "Aprovados são visíveis a todos; Cidadão gerencia o próprio cadastro."
  },
  "Agentes_Seguranca": {
    description: "Cadastro de agentes de segurança (policiais, socorristas, bombeiros) com localização e status operacional.",
    properties: {
      nome: { type: "string", description: "Nome completo" },
      tipo: { type: "string", enum: ["policial", "socorrista", "bombeiro"], description: "Tipo de agente" },
      lat: { type: "number", description: "Latitude da base" },
      lng: { type: "number", description: "Longitude da base" },
      status: { type: "string", enum: ["disponivel", "em_atendimento", "fora_servico"], description: "Status operacional" },
      veiculo: { type: "string", description: "Viatura ou unidade (ex: PM-4521, SAMU-089)" },
    },
    required: ["nome", "tipo"],
    relationships: [],
    rls: "Apenas Admins criam/gerenciam; Agentes e Admins leem."
  },
  "Shift": {
    description: "Registro de turnos de trabalho dos agentes. Controla início, fim, viatura e status do plantão.",
    properties: {
      agent_id: { type: "string", description: "ID do agente" },
      vehicle_plate: { type: "string", description: "Placa da viatura" },
      vehicle_prefix: { type: "string", description: "Prefixo da viatura" },
      start_time: { type: "string", format: "date-time", description: "Início do turno" },
      end_time: { type: "string", format: "date-time", description: "Fim do turno" },
      status: { type: "string", enum: ["active", "ended"], description: "Status do turno" },
      notes: { type: "string", description: "Observações do turno" },
    },
    required: ["vehicle_prefix"],
    relationships: [{ field: "agent_id", target: "User", description: "Agente em turno" }],
    rls: "Acesso via regras de negócio do sistema."
  },
  "Alertas_Quarentena": {
    description: "Sistema de detecção de trotes. Alertas suspeitos são colocados em quarentena para revisão por IA e validação humana.",
    properties: {
      ocorrencia_id: { type: "string", description: "ID da ocorrência suspeita" },
      user_id: { type: "string", description: "ID do usuário que reportou" },
      user_name: { type: "string", description: "Nome do reportante" },
      motivo_suspeita: { type: "string", description: "Razão da detecção de trote" },
      evidencias: { type: "array", items: { type: "string" }, description: "Evidências detectadas pela IA" },
      score_suspeita: { type: "number", description: "Score 0-100 de probabilidade de trote" },
      fatores_analisados: { type: "object", description: "Checklist: discrepância GPS, múltiplos relatos, histórico, IP, descrição vaga" },
      status_validacao: { type: "string", enum: ["pendente", "em_analise", "confirmado_trote", "falso_positivo"], description: "Status da validação" },
      revisado_por_id: { type: "string", description: "Admin/agente que revisou" },
      data_revisao: { type: "string", format: "date-time", description: "Data da revisão" },
    },
    required: ["ocorrencia_id", "user_id", "motivo_suspeita"],
    relationships: [
      { field: "ocorrencia_id", target: "Occurrence", description: "Ocorrência em quarentena" },
      { field: "user_id", target: "User", description: "Reportante" },
    ],
    rls: "Agentes e Admins leem/atualizam."
  },
  "Cercas_Geograficas_Defesa_Civil": {
    description: "Cercas geográficas para alertas de Defesa Civil. Define polígonos de áreas de risco e dispara notificações push.",
    properties: {
      nome: { type: "string", description: "Nome descritivo da cerca" },
      tipo_risco: { type: "string", enum: ["alagamento", "deslizamento", "incendio", "estrutural", "quimico", "tsunami", "tornado", "outro"], description: "Tipo de risco" },
      poligono_coordenadas: { type: "array", items: { type: "object" }, description: "Vértices do polígono [{lat, lng}, ...]" },
      bairro: { type: "string", description: "Bairro(s) abrangido(s)" },
      cidade: { type: "string", description: "Cidade" },
      estado: { type: "string", description: "Estado" },
      nivel_urgencia: { type: "string", enum: ["extremo", "alto", "medio", "baixo"], description: "Nível de urgência" },
      mensagem_alerta: { type: "string", description: "Mensagem push enviada" },
      status: { type: "string", enum: ["ativo", "inativo", "programado"], description: "Status da cerca" },
      data_ativacao: { type: "string", format: "date-time", description: "Data de ativação" },
      data_desativacao: { type: "string", format: "date-time", description: "Data de desativação" },
    },
    required: ["nome", "tipo_risco", "poligono_coordenadas"],
    relationships: [],
    rls: "Apenas Admins criam/gerenciam; Cercas ativas visíveis a agentes."
  },
  "Notificacoes_Geofence": {
    description: "Registro de notificações enviadas a usuários que entraram em áreas de risco de Defesa Civil.",
    properties: {
      cerca_id: { type: "string", description: "ID da cerca que disparou" },
      cerca_nome: { type: "string", description: "Nome da cerca" },
      tipo_risco: { type: "string", description: "Tipo de risco" },
      nivel_urgencia: { type: "string", description: "Nível de urgência" },
      user_id: { type: "string", description: "Usuário notificado" },
      coordenada_lat: { type: "number", description: "Latitude do dispositivo" },
      coordenada_lng: { type: "number", description: "Longitude do dispositivo" },
      data_disparo: { type: "string", format: "date-time", description: "Data/hora do disparo" },
      mensagem: { type: "string", description: "Conteúdo da notificação" },
      status_envio: { type: "string", enum: ["enviado", "pendente", "falhou", "lido"], description: "Status do envio" },
      canal: { type: "string", enum: ["push", "sms", "email", "todos"], description: "Canal de envio" },
    },
    required: ["cerca_id", "user_id"],
    relationships: [
      { field: "cerca_id", target: "Cercas_Geograficas_Defesa_Civil", description: "Cerca que disparou" },
      { field: "user_id", target: "User", description: "Usuário notificado" },
    ],
    rls: "Usuário vê as próprias; Agentes e Admins veem todas."
  },
  "Analises_Preditivas": {
    description: "Relatórios de análise preditiva criminal gerados por IA. Incluem tendências, heatmaps e recomendações táticas.",
    properties: {
      titulo: { type: "string", description: "Título do relatório" },
      resumo: { type: "string", description: "Resumo executivo" },
      tipo_crime: { type: "string", description: "Categoria criminal analisada" },
      subtipos: { type: "array", items: { type: "string" }, description: "Subtipos criminais" },
      regiao: { type: "string", description: "Região analisada" },
      bairro: { type: "string", description: "Bairro analisado" },
      cidade: { type: "string", description: "Cidade analisada" },
      percentual_variacao: { type: "number", description: "Variação percentual detectada" },
      tendencia: { type: "string", enum: ["alta", "estavel", "queda", "pico"], description: "Tendência identificada" },
      faixa_horaria_inicio: { type: "string", description: "Início da faixa crítica (HH:MM)" },
      faixa_horaria_fim: { type: "string", description: "Fim da faixa crítica (HH:MM)" },
      dias_criticos: { type: "array", items: { type: "string" }, description: "Dias mais afetados" },
      data_geracao: { type: "string", format: "date-time", description: "Data de geração" },
      periodo_analise_inicio: { type: "string", format: "date", description: "Início do período" },
      periodo_analise_fim: { type: "string", format: "date", description: "Fim do período" },
      total_ocorrencias_periodo: { type: "number", description: "Total de ocorrências no período" },
      heatmap_coordenadas: { type: "array", items: { type: "object" }, description: "Pontos de calor [{lat, lng, intensidade}]" },
      recomendacoes: { type: "string", description: "Recomendações táticas" },
      fatores_contribuintes: { type: "array", items: { type: "string" }, description: "Fatores contribuintes" },
      status: { type: "string", enum: ["rascunho", "publicado", "arquivado"], description: "Status do relatório" },
      nivel_confianca: { type: "string", enum: ["alta", "media", "baixa"], description: "Nível de confiança da análise" },
    },
    required: ["titulo", "tipo_crime", "regiao"],
    relationships: [],
    rls: "Agentes e Admins criam/leem; Apenas Admins atualizam."
  },
  "Postes_Iluminacao": {
    description: "Cadastro de postes de iluminação pública para correlação com segurança urbana e manutenção.",
    properties: {
      coordenada_lat: { type: "number", description: "Latitude" },
      coordenada_lng: { type: "number", description: "Longitude" },
      endereco: { type: "string", description: "Endereço" },
      bairro: { type: "string", description: "Bairro" },
      cidade: { type: "string", description: "Cidade" },
      status: { type: "string", enum: ["funcionando", "com_defeito", "desligado", "manutencao"], description: "Status" },
      tipo: { type: "string", enum: ["led", "sodio", "mercurio", "solar", "outro"], description: "Tipo de lâmpada" },
      potencia_watts: { type: "number", description: "Potência em watts" },
      altura_metros: { type: "number", description: "Altura em metros" },
      ultima_manutencao: { type: "string", format: "date", description: "Data da última manutenção" },
      id_prefeitura: { type: "string", description: "Identificador oficial da prefeitura" },
    },
    required: ["coordenada_lat", "coordenada_lng"],
    relationships: [],
    rls: "Leitura pública para todos os perfis; Apenas Admins gerenciam."
  },
  "Logs_Auditoria_QA": {
    description: "Logs de auditoria de qualidade (QA) — registra cada etapa dos testes de estresse do sistema.",
    properties: {
      execucao_id: { type: "string", description: "ID único da execução de QA" },
      etapa: { type: "string", enum: ["geracao_dados", "criacao_ocorrencias", "triagem_ia", "atribuicao_agente", "progressao_status", "finalizacao", "health_check"], description: "Etapa auditada" },
      status: { type: "string", enum: ["success", "error", "timeout", "skipped"], description: "Status da etapa" },
      tempo_ms: { type: "number", description: "Tempo de resposta em ms" },
      ocorrencia_id: { type: "string", description: "ID da ocorrência testada" },
      agente_id: { type: "string", description: "ID do agente envolvido" },
      error_message: { type: "string", description: "Mensagem de erro" },
      error_details: { type: "string", description: "Detalhes técnicos do erro" },
      detalhe: { type: "string", description: "Descrição do que foi testado" },
      data_execucao: { type: "string", format: "date-time", description: "Data da execução" },
    },
    required: ["execucao_id", "etapa", "status"],
    relationships: [],
    rls: "Apenas Admins."
  },
  "PointsLog": {
    description: "Registro de pontos concedidos a cidadãos e agentes por contribuições e resoluções.",
    properties: {
      user_id: { type: "string", description: "ID do usuário" },
      user_name: { type: "string", description: "Nome do usuário" },
      points: { type: "number", description: "Pontos concedidos" },
      reason: { type: "string", description: "Motivo da concessão" },
      occurrence_id: { type: "string", description: "ID da ocorrência relacionada" },
    },
    required: ["points"],
    relationships: [
      { field: "user_id", target: "User", description: "Usuário que recebeu pontos" },
      { field: "occurrence_id", target: "Occurrence", description: "Ocorrência relacionada" },
    ],
    rls: "Leitura pública."
  },
  "SystemHealthLog": {
    description: "Logs de health check automatizado do sistema — executa verificações periódicas de todos os fluxos.",
    properties: {
      run_id: { type: "string", description: "ID único da execução" },
      trigger: { type: "string", enum: ["cron", "manual"], description: "Origem do gatilho" },
      profile: { type: "string", enum: ["citizen", "agent", "admin", "system"], description: "Perfil simulado" },
      flow_key: { type: "string", description: "Identificador do fluxo testado" },
      flow_label: { type: "string", description: "Nome legível do fluxo" },
      status: { type: "string", enum: ["success", "error", "warning"], description: "Status do teste" },
      latency_ms: { type: "number", description: "Tempo de resposta em ms" },
      error_message: { type: "string", description: "Mensagem de erro" },
      error_payload: { type: "string", description: "Payload do erro em JSON" },
      is_critical: { type: "boolean", description: "Erro crítico?" },
      run_date: { type: "string", format: "date", description: "Data da execução" },
      run_started_at: { type: "string", format: "date-time", description: "Início da execução" },
    },
    required: ["run_id", "profile", "flow_key", "status"],
    relationships: [],
    rls: "Acesso público para leitura."
  },
  "TrainingProgress": {
    description: "Progresso de treinamento dos agentes — módulos, quizzes e revisão por admin.",
    properties: {
      agent_id: { type: "string", description: "ID do agente" },
      agent_name: { type: "string", description: "Nome do agente" },
      module_id: { type: "string", description: "ID do módulo" },
      module_title: { type: "string", description: "Título do módulo" },
      status: { type: "string", enum: ["not_started", "watching", "quiz", "passed", "failed"], description: "Status do progresso" },
      score: { type: "number", description: "% obtida no quiz" },
      attempts: { type: "number", description: "Tentativas" },
      completed_at: { type: "string", format: "date-time", description: "Data de conclusão" },
      submitted_task: { type: "string", description: "Resposta submetida" },
      review_status: { type: "string", enum: ["pending", "approved", "revision"], description: "Status da revisão" },
      review_feedback: { type: "string", description: "Feedback do admin" },
      reviewed_at: { type: "string", format: "date-time", description: "Data da revisão" },
    },
    required: ["agent_id", "module_id"],
    relationships: [{ field: "agent_id", target: "User", description: "Agente em treinamento" }],
    rls: "Agente vê o próprio; Admins veem todos."
  },
};

// ─── BACKEND FUNCTIONS ─────────────────────────────────────
const FUNCTIONS = [
  { name: "calcularRotaSegura", description: "Calcula a rota mais segura entre dois pontos usando IA, considerando iluminação pública, índices criminais e presença de agentes.", trigger: "Sob demanda (cidadão solicita rota segura)" },
  { name: "cronSystemHealthCheck", description: "Automação agendada que executa o health check completo do sistema periodicamente (cron).", trigger: "Agendado (cron)" },
  { name: "dispararGeofenceUsuarios", description: "Varre usuários dentro de cercas geográficas de Defesa Civil e dispara notificações push.", trigger: "Agendado / Sob demanda" },
  { name: "gerarAnalisePreditiva", description: "Gera relatórios de análise preditiva criminal com IA (Claude), analisando padrões históricos de ocorrências.", trigger: "Sob demanda (painel admin)" },
  { name: "gerarBoletimOcorrencia", description: "Gera Boletim de Ocorrência jurídico automaticamente ao finalizar um alerta, usando Claude Sonnet 4.6 com telemetria e transcrições.", trigger: "Automático ao finalizar alerta" },
  { name: "obterMidiaCriptografada", description: "Descriptografa e retorna URL temporária para acesso a mídia capturada em segundo plano durante alertas.", trigger: "Sob demanda (Central de Despacho)" },
  { name: "runSystemHealthCheck", description: "Executa verificação completa de saúde do sistema — testa todos os fluxos (cidadão, agente, admin).", trigger: "Sob demanda (painel admin)" },
  { name: "simulacaoEstresseQA", description: "Simulação de estresse para QA — gera dados sintéticos, cria ocorrências, testa triagem IA e fluxo completo.", trigger: "Sob demanda (painel QA)" },
  { name: "triagemOcorrencia", description: "Faz a triagem inicial de uma ocorrência via IA, classificando prioridade e detectando possíveis trotes.", trigger: "Automático ao criar ocorrência" },
  { name: "verificarCercasGeograficas", description: "Verifica se há usuários dentro de cercas geográficas ativas de Defesa Civil e dispara alertas.", trigger: "Agendado / Sob demanda" },
];

// ─── MAIN ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = 20;
    const pageHeight = doc.internal.pageSize.height;

    // ═══════════════ COVER PAGE ═══════════════
    doc.setFontSize(28);
    doc.setTextColor(30, 144, 255);
    doc.text('SENTINELA', 105, 80, { align: 'center' });

    doc.setFontSize(18);
    doc.setTextColor(50, 50, 50);
    doc.text('Seguranca Cidada', 105, 92, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text('Documentacao Tecnica Completa', 105, 105, { align: 'center' });
    doc.text('Versao 3.0 — Junho 2026', 105, 112, { align: 'center' });

    doc.setDrawColor(30, 144, 255);
    doc.setLineWidth(1);
    doc.line(40, 125, 170, 125);

    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    const coverDesc = [
      'Plataforma integrada de seguranca publica com inteligencia artificial,',
      'biometria invertida, geofencing, analise preditiva criminal,',
      'central de despacho em tempo real e rede comunitaria de protecao.'
    ];
    coverDesc.forEach((line, i) => {
      doc.text(line, 105, 135 + (i * 6), { align: 'center' });
    });

    // ═══════════════ TABLE OF CONTENTS ═══════════════
    doc.addPage();
    y = 25;
    doc.setFontSize(18);
    doc.setTextColor(30, 144, 255);
    doc.text('Indice', 20, y);
    y += 12;

    const tocItems = [
      '1. Visao Geral do Sistema',
      '2. Arquitetura e Tecnologias',
      '3. Sistema de Papeis (Roles)',
      '4. Catalogo de Entidades',
      '5. Relacionamentos entre Entidades',
      '6. Backend Functions (Funcoes de Servidor)',
      '7. Fluxos Principais',
      '8. Modulos do Sistema',
      '9. Seguranca e RLS',
    ];

    doc.setFontSize(11);
    tocItems.forEach(item => {
      doc.setTextColor(50, 50, 50);
      doc.text(item, 20, y);
      y += 8;
    });

    // ═══════════════ 1. OVERVIEW ═══════════════
    doc.addPage();
    y = 25;
    y = addSection(doc, '1. Visao Geral do Sistema', y);

    y = addText(doc, 'O Sentinela e uma plataforma de seguranca cidada que integra cidadaos, agentes de seguranca publica (policiais, bombeiros, socorristas) e administradores em um ecossistema unificado de prevencao e resposta a incidentes.', y);
    y = addText(doc, 'A plataforma utiliza inteligencia artificial para triagem de ocorrencias, deteccao de trotes, analise preditiva criminal, geracao automatica de boletins de ocorrencia e reconhecimento de padroes acusticos em audio capturado durante emergencias.', y);

    y += 4;
    y = addSubSection(doc, 'Modulos Principais:', y);
    const modules = [
      'Modulo de Protecao (Cidadao): Biometria Invertida (PIN de coacao via calculadora), monitoramento cardiaco por wearables, geofencing infantil, rotas seguras, Caminhe Comigo, perfil medico de emergencia.',
      'Modulo de Autonomia (Agente): Central do Agente com mapa tatico, checklist de viatura e equipamentos, gerenciamento de turno, chat unificado, radio offline, patrulha virtual, monitoramento de fadiga.',
      'Modulo de Gestao (Admin): Dashboard analitico, KPIs estrategicos, gestao de usuarios e agentes, heatmaps operacionais, alocacao inteligente de turnos, inventario tatico, manutencao de frota.',
      'Central de Despacho: Tela full-screen para despacho de alertas de IA em tempo real com fila priorizada, mapa tatico, reprodutor de audio criptografado e transcricao com highlights.',
      'Inteligencia Artificial: Triagem automatica, geracao de BO juridico, analise preditiva criminal, deteccao de trotes, reconhecimento acustico de ameacas.',
      'Rede Comunitaria: Anjos da Guarda (voluntarios), denuncias anonimas, ranking gamificado de cidadaos, feed de noticias de seguranca.'
    ];
    modules.forEach(m => { y = addText(doc, '• ' + m, y, 25); });

    // ═══════════════ 2. ARCHITECTURE ═══════════════
    y += 4;
    y = addSection(doc, '2. Arquitetura e Tecnologias', y);
    y = addText(doc, 'Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui. Single Page Application com roteamento via React Router. Mapas interativos com Leaflet. Graficos com Recharts. Editor de texto rico com React Quill.', y);
    y = addText(doc, 'Backend (BaaS): Plataforma Base44 — autenticacao, banco de dados NoSQL, funcoes serverless (Deno), armazenamento de arquivos, integracoes de IA (InvokeLLM com Claude, Gemini), filas de automacao.', y);
    y = addText(doc, 'IA: Claude Sonnet 4.6 para geracao de BOs e analises complexas. Gemini Flash para triagem com contexto de internet. Whisper para transcricao de audio.', y);
    y = addText(doc, 'Seguranca: Autenticacao JWT via Base44. Row-Level Security (RLS) em todas as entidades. Midia criptografada com acesso via token temporario. PIN de coacao com camada de disfarce (calculadora).', y);

    // ═══════════════ 3. ROLES ═══════════════
    y += 4;
    y = addSection(doc, '3. Sistema de Papeis (Roles)', y);
    y = addText(doc, 'O Sentinela opera com 4 papeis distintos, cada um com acesso a funcionalidades e dados especificos:', y);

    const roles = [
      { role: 'citizen (Cidadao)', desc: 'Reporta ocorrencias, configura biometria de coacao, gerencia perimetros infantis, perfil medico, rotas seguras e sessoes Caminhe Comigo. Acesso apenas aos proprios dados.' },
      { role: 'agent (Agente)', desc: 'Atende ocorrencias, gerencia turnos e viaturas, acessa mapa tatico, central de despacho, chat unificado, checklist de equipamentos. Ve todas as ocorrencias e alertas.' },
      { role: 'psychologist (Psicologo)', desc: 'Acesso ao painel de saude mental dos agentes, avaliacoes psicologicas e agendamentos. Perfil especializado para bem-estar da tropa.' },
      { role: 'admin (Administrador)', desc: 'Acesso total ao sistema. Gerencia usuarios, agentes, viaturas, inventario, treinamentos, analises preditivas, cercas geograficas, QA e health checks.' },
    ];
    roles.forEach(r => {
      y = addText(doc, r.role + ': ' + r.desc, y, 25);
      y += 1;
    });

    // ═══════════════ 4. ENTITIES ═══════════════
    doc.addPage();
    y = 25;
    y = addSection(doc, '4. Catalogo de Entidades', y);
    y = addText(doc, 'O sistema possui 20+ entidades organizadas por dominio funcional. Abaixo o schema completo de cada uma.', y);

    const entityNames = Object.keys(ENTITIES);
    for (const name of entityNames) {
      y = addEntityTable(doc, name, ENTITIES[name], y);
      // Relationships
      if (ENTITIES[name].relationships?.length > 0) {
        if (y > pageHeight - 20) { doc.addPage(); y = 25; }
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Relacionamentos:', 20, y);
        y += 4;
        ENTITIES[name].relationships.forEach(rel => {
          doc.text(`  -> ${rel.field} referencia ${rel.target}: ${rel.description}`, 20, y);
          y += 4;
        });
        y += 3;
      }
    }

    // ═══════════════ 5. RELATIONSHIPS ═══════════════
    doc.addPage();
    y = 25;
    y = addSection(doc, '5. Mapa de Relacionamentos', y);
    y = addText(doc, 'Diagrama conceitual dos principais relacionamentos entre entidades:', y);
    y += 3;

    const relMap = [
      'User (cidadao) 1---* Occurrence : reporta',
      'User (agente) 1---* Occurrence : atende',
      'User (cidadao) 1---* Alertas_Inteligencia_IA : dispara',
      'Alertas_Inteligencia_IA 1---1 Boletins_Ocorrencia_Gerados : gera',
      'Alertas_Inteligencia_IA 1---1 Occurrence : associado',
      'User (pai/mae) 1---* Perimetros_Seguranca_Infantil : configura',
      'User (cidadao) 1---1 Perfis_Medicos_Usuarios : possui',
      'User (cidadao) 1---1 Configuracoes_Biometria_Coacao : configura',
      'User (cidadao) 1---* Logs_Frequencia_Cardiaca_Wearables : registra',
      'User (cidadao) 1---* Sessoes_CaminheComigo : inicia',
      'User (voluntario) 1---1 Anjos_Guarda : cadastra',
      'User (agente) 1---* Shift : trabalha',
      'User (reportante) 1---* Alertas_Quarentena : gera',
      'Occurrence 1---1 Alertas_Quarentena : suspeita',
      'Cercas_Geograficas_Defesa_Civil 1---* Notificacoes_Geofence : dispara',
      'User (cidadao) 1---* Notificacoes_Geofence : recebe',
      'User 1---* PointsLog : acumula',
      'Occurrence 1---* PointsLog : relaciona',
      'User (agente) *---* TrainingModule : progride',
      'User (agente) 1---* ShiftBreadcrumb : registra rota',
    ];

    doc.setFontSize(9);
    relMap.forEach(rel => {
      if (y > pageHeight - 15) { doc.addPage(); y = 25; }
      doc.setTextColor(50, 50, 50);
      doc.text(rel, 20, y);
      y += 5;
    });

    // ═══════════════ 6. BACKEND FUNCTIONS ═══════════════
    y += 5;
    y = addSection(doc, '6. Backend Functions', y);
    y = addText(doc, 'Funcoes serverless (Deno) que implementam a logica de negocio do sistema:', y);

    FUNCTIONS.forEach(fn => {
      if (y > pageHeight - 30) { doc.addPage(); y = 25; }
      doc.setFontSize(10);
      doc.setTextColor(30, 144, 255);
      doc.text(fn.name, 20, y);
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(fn.description, 170);
      doc.text(descLines, 25, y);
      y += (descLines.length * 4) + 2;
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7);
      doc.text('Trigger: ' + fn.trigger, 25, y);
      y += 6;
    });

    // ═══════════════ 7. CORE FLOWS ═══════════════
    doc.addPage();
    y = 25;
    y = addSection(doc, '7. Fluxos Principais', y);

    const flows = [
      {
        title: '7.1 Fluxo de Emergencia (Cidadao)',
        steps: [
          '1. Cidadao em risco disca PIN de coacao na calculadora disfarçada (Modo Disfarce)',
          '2. Sistema captura audio/video em segundo plano e geolocalizacao',
          '3. Alerta_Inteligencia_IA e criado com status TRIAGEM_IA',
          '4. IA processa audio: transcricao (Whisper) + analise acustica (tags: Gritos, Mençao_Arma, etc.)',
          '5. IA classifica prioridade: CRITICO_RISCO_MORTE / ALTO / MEDIO / BAIXO',
          '6. Alerta aparece na Central de Despacho em tempo real (subscription)',
          '7. Agente de despacho ouve audio criptografado, le transcricao com highlights',
          '8. Agente despacha viatura (DESPACHADO_POLICIA) ou solicita apoio (EM_ANDAMENTO)',
          '9. Ao finalizar (FINALIZADO), funcao gerarBoletimOcorrencia cria BO juridico com IA',
          '10. Agente revisa, edita e assina digitalmente o BO no painel admin'
        ]
      },
      {
        title: '7.2 Fluxo de Ocorrencia Comun (Cidadao -> Agente)',
        steps: [
          '1. Cidadao abre o app e registra ocorrencia (tipo, descricao, midia, localizacao)',
          '2. Funcao triagemOcorrencia classifica prioridade e detecta possiveis trotes',
          '3. Se suspeita de trote: Alertas_Quarentena criado para revisao',
          '4. Agente no Dashboard ve ocorrencias ordenadas por urgencia (sortByUrgency)',
          '5. Agente assume ocorrencia (status: in_progress, assigned_agent_id)',
          '6. Chat unificado entre agente e cidadao (UnifiedChat)',
          '7. Agente resolve ocorrencia (status: resolved) com notas de resolucao',
          '8. Sistema concede pontos ao cidadao (25 pts) e ao agente (15 pts)'
        ]
      },
      {
        title: '7.3 Fluxo de Geofencing (Defesa Civil)',
        steps: [
          '1. Admin cria Cerca_Geografica_Defesa_Civil com poligono, tipo de risco e mensagem',
          '2. Admin ativa a cerca (status: ativo)',
          '3. Funcao verificarCercasGeograficas (agendada) varre usuarios dentro dos poligonos',
          '4. Usuarios dentro da cerca recebem Notificacao_Geofence via push/SMS/email',
          '5. Cidadao ve alerta no dashboard (GeofenceAlertCard) com nivel de urgencia',
          '6. Funcao dispararGeofenceUsuarios gerencia o envio em lote'
        ]
      },
      {
        title: '7.4 Fluxo de Treinamento (Agente)',
        steps: [
          '1. Admin cria modulos de treinamento (TrainingModule)',
          '2. Agente acessa Central de Treinamento, assiste videos e faz quizzes',
          '3. Progresso registrado em TrainingProgress (status, score, attempts)',
          '4. Admin revisa tarefas submetidas (review_status: approved/revision)',
          '5. Certificados emitidos ao concluir (CertificateRecord)'
        ]
      },
      {
        title: '7.5 Fluxo de Health Check (Sistema)',
        steps: [
          '1. Funcao cronSystemHealthCheck executa periodicamente (agendada)',
          '2. Funcao runSystemHealthCheck testa todos os fluxos por perfil (citizen, agent, admin)',
          '3. Cada teste registrado em SystemHealthLog (status, latencia, erros)',
          '4. Admin monitora no painel SystemHealthDashboard',
          '5. Alertas de erro critico notificam admins'
        ]
      },
      {
        title: '7.6 Fluxo Caminhe Comigo',
        steps: [
          '1. Cidadao inicia sessao CaminheComigo com destino',
          '2. Sistema gera token unico e link compartilhavel (WhatsApp)',
          '3. GPS tracked em tempo real, atualizado no mapa (Leaflet)',
          '4. Algoritmo de anomalia detecta corridas, mudancas bruscas de direcao',
          '5. Anomalia detectada -> dispara alerta de panico automatico',
          '6. Contato de emergencia notificado via WhatsApp',
          '7. Visualizador publico (CaminheComigoViewer) permite acompanhar sem login'
        ]
      },
    ];

    flows.forEach(flow => {
      if (y > pageHeight - 40) { doc.addPage(); y = 25; }
      y = addSubSection(doc, flow.title, y);
      flow.steps.forEach(step => {
        if (y > pageHeight - 15) { doc.addPage(); y = 25; }
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(step, 170);
        doc.text(lines, 25, y);
        y += (lines.length * 4) + 1;
      });
      y += 3;
    });

    // ═══════════════ 8. MODULES ═══════════════
    doc.addPage();
    y = 25;
    y = addSection(doc, '8. Modulos do Sistema', y);

    const systemModules = [
      {
        name: 'Dashboard do Cidadao (CitizenDashboard)',
        desc: 'Hub principal do cidadao. Acesso a: registro de ocorrencias, botao de panico, status de medidas protetivas, geofence alerts, perfil medico, perimetros infantis, ranking, rotas seguras e Caminhe Comigo.',
        components: 'PanicButton, RegisterOccurrenceDialog, GeofenceAlertCard, PerfilMedicoForm, PerimetroInfantilManager, GuardianNetwork, CitizenRankingPanel, SecurityNewsFeed, FirstAidGuide, CoercionBiometricConfig, CitizenProgressBar'
      },
      {
        name: 'Dashboard do Agente (AgentDashboard)',
        desc: 'Central operacional do agente. Lista de ocorrencias ordenadas por urgencia, mapa tatico com cameras e agentes proximos, gerenciamento de turno, checklist de viatura e equipamentos, chat unificado, monitor de fadiga, missoes do turno e patrulha virtual.',
        components: 'LiveMap, ShiftManager, OccurrenceRow, OccurrenceChat, VehicleChecklistDialog, EquipmentChecklistDialog, FatigueMonitor, ShiftMissions, UnifiedChat, OfflineRadio, VirtualPatrolMode, BiometricCheckIn, CriticalAlert'
      },
      {
        name: 'Central de Despacho (CentralDespacho)',
        desc: 'Tela full-screen para despacho de alertas de IA em tempo real. Layout de 3 colunas: fila de alertas priorizada, painel detalhado com audio/transcricao e acoes rapidas, mapa tatico com rota para Google Maps e Waze.',
        components: 'AlertCard, ElapsedTimer, MapMarker/MapUpdater, Audio player com descriptografia'
      },
      {
        name: 'Painel Administrativo (AdminDashboard)',
        desc: 'Dashboard completo com 30+ abas: visao geral, KPIs, heatmaps, gestao de usuarios, viaturas, cameras, patrulha, inventario, treinamento, ranking, turnos, psicologia, manutencao, analise preditiva, QA, health check do sistema, e mais.',
        components: 'AdminTabNav, StrategicKPIs, OperationalHeatmap, CameraManager, VehicleManager, PatrolScheduler, InventoryManager, TrainingManager, AgentLeaderboard, ShiftCalendar, PsychPanel, HeatmapPatrolDashboard, ForensicIntelligence, SmartShiftAllocator, TacticalStockManager, FleetMaintenanceManager, FatigueRiskPanel, ProductivityReport, SystemHealthDashboard, QaEstressePanel, TacticalCommandCenter, GuardianManager, BoletimOcorrenciaPanel'
      },
      {
        name: 'Modo Disfarce (DisguisedMode)',
        desc: 'Calculadora funcional que esconde o sistema de emergencia. PINs de coacao e desarme integrados a operacoes matematicas. Dispara alertas silenciosos sem revelar a natureza do app.',
        components: 'Calculadora completa com deteccao de sequencias secretas'
      },
      {
        name: 'Central de Treinamento (TrainingCenter)',
        desc: 'Modulos de treinamento para agentes com videos, quizzes, tarefas praticas e certificacao. Revisao por administradores.',
        components: 'TrainingQuiz, CertificatePanel, AgentTaskReview'
      },
      {
        name: 'Central de Mensagens (MessagingCenter)',
        desc: 'Sistema de mensagens entre agentes, admins e cidadaos. Threads de conversa, mensagens diretas e chat de ocorrencia.',
        components: 'UnifiedChat, DirectMessage, MessageThread, NewThreadDialog'
      },
    ];

    systemModules.forEach(mod => {
      if (y > pageHeight - 50) { doc.addPage(); y = 25; }
      doc.setFontSize(11);
      doc.setTextColor(30, 144, 255);
      doc.text(mod.name, 20, y);
      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(mod.desc, 170);
      doc.text(descLines, 25, y);
      y += (descLines.length * 4) + 2;
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text('Componentes: ' + mod.components, 25, y);
      y += 6;
    });

    // ═══════════════ 9. SECURITY ═══════════════
    y += 5;
    y = addSection(doc, '9. Seguranca e RLS', y);
    y = addText(doc, 'Row-Level Security (RLS): Cada entidade possui regras de acesso baseadas no perfil do usuario autenticado. Cidadaos acessam apenas seus proprios dados. Agentes tem acesso de leitura amplo a ocorrencias e alertas. Admins tem acesso total.', y);
    y = addText(doc, 'Biometria Invertida: PIN de coacao digitado na calculadora disfarçada parece desarmar o sistema mas na verdade dispara um alerta silencioso com captura de audio/video em segundo plano. O agressor nao percebe que a vitima acionou ajuda.', y);
    y = addText(doc, 'Midia Criptografada: Audios e videos capturados durante emergencias sao armazenados criptografados. O acesso e feito via token temporario gerado pela funcao obterMidiaCriptografada, auditado e com tempo limitado.', y);

    // ═══════════════ FOOTER ═══════════════
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Sentinela — Documentacao Tecnica v3.0 — Pagina ${i} de ${totalPages}`, 105, pageHeight - 8, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=Sentinela_Documentacao_Completa.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});