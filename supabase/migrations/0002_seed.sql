-- =====================================================================
--  SENTINELA — Carga Inicial (Seed)
--  Arquivo 2/2: dados de referência + exemplos
--  Executar APÓS 0001_schemas.sql
-- =====================================================================

-- ---------------------------------------------------------------------
--  PLANOS DE ASSINATURA
-- ---------------------------------------------------------------------
insert into public.planos_assinatura (plano_id, nome, descricao, faixa_populacional, populacao_min, populacao_max, preco_base, limite_cidadaos, limite_agentes, modulos_incluidos, ativo)
values
  ('basico',     'Plano Básico',     'Cidadão e alertas básicos para municípios pequenos',          'Até 20.000 hab.',   0,     20000,  1499.00,  1000, 5,  array['cidadao_basico'], true),
  ('essencial',  'Plano Essencial',  'Inclui módulos de agente e gestão para cidades médias',      '20.001 a 80.000',    20001, 80000,  3499.00,  5000, 15, array['cidadao_basico','agente_gestao_turno','gestao_cameras'], true),
  ('avancado',   'Plano Avançado',   'Inteligência preditiva + biometria + defesa civil',          '80.001 a 250.000',   80001, 250000, 7999.00, 20000, 40, array['cidadao_basico','agente_gestao_turno','gestao_cameras','gestao_heatmap','gestao_analise_preditiva','cidadao_perimetro_infantil'], true),
  ('premium',    'Plano Premium',    'Todos os módulos, sem limites operacionais',                 'Acima de 250.000',  250001, 9999999, 18999.00, 100000, 100, array['cidadao_basico','agente_gestao_turno','gestao_cameras','gestao_heatmap','gestao_analise_preditiva','cidadao_perimetro_infantil','gestao_procurados','agente_bo_juridico','gestao_frota','gestao_estoque_tatico','agente_fadiga','agente_psicologico','agente_treinamento','gestao_kpis'], true)
on conflict (plano_id) do nothing;

-- ---------------------------------------------------------------------
--  MÓDULOS SENTINELA (catálogo)
-- ---------------------------------------------------------------------
insert into public.modulos_sentinela (modulo_id, nome, descricao, categoria, planos_incluidos, preco_adicional, ativo)
values
  ('cidadao_basico',             'Cidadão Básico',              'Pânico, ocorrências, ranking e mapa seguro',                 'cidadao',      array['basico','essencial','avancado','premium'], 0,      true),
  ('cidadao_dicas_anonimas',     'Denúncias Anônimas',          'Envio de denúncias anônimas com mídia',                      'cidadao',      array['avancado','premium'],                     300,    true),
  ('cidadao_perimetro_infantil', 'Perímetro Infantil',          'Cercas virtuais escolares + biometria de alunos',           'cidadao',      array['avancado','premium'],                     600,    true),
  ('cidadao_rede_anjos',         'Rede de Anjos da Guarda',     'Voluntários certificados para atendimento comunitário',      'cidadao',      array['essencial','avancado','premium'],         200,    true),
  ('agente_gestao_turno',        'Gestão de Turnos',            'Escalas, checklists e missões de turno',                     'agente',       array['essencial','avancado','premium'],         0,      true),
  ('agente_treinamento',         'Capacitação',                 'Trilhas de treinamento, quiz e certificados',                'agente',       array['avancado','premium'],                     400,    true),
  ('agente_bo_juridico',         'BO Jurídico IA',              'Boletim de ocorrência pré-preenchido por IA',                'agente',       array['premium'],                                800,    true),
  ('agente_fadiga',              'Risco de Fadiga',             'Monitoramento de fadiga e estresse do agente',               'agente',       array['avancado','premium'],                     350,    true),
  ('agente_psicologico',         'Avaliações Psicológicas',     'Avaliações, consultas e alertas ao gestor',                  'agente',       array['avancado','premium'],                     450,    true),
  ('gestao_cameras',             'Gestão de Câmeras',           'Cadastro e análise de câmeras + checkpoint',                'gestao',       array['essencial','avancado','premium'],        500,    true),
  ('gestao_heatmap',             'Mapas de Calor',              'Heatmap operacional e preditivo',                           'gestao',       array['avancado','premium'],                    500,    true),
  ('gestao_analise_preditiva',   'Inteligência Forense',        'Análises preditivas e inteligência',                        'gestao',       array['avancado','premium'],                    700,    true),
  ('gestao_procurados',          'Procurados',                  'Cadastro de procurados com reconhecimento facial',          'gestao',       array['premium'],                                900,    true),
  ('gestao_kpis',                'KPIs Estratégicos',           'Indicadores estratégicos e executivos',                      'gestao',       array['premium'],                                600,    true),
  ('gestao_frota',               'Gestão de Frota',             'Viaturas, manutenção e checklists',                         'gestao',       array['avancado','premium'],                    500,    true),
  ('gestao_estoque_tatico',      'Estoque Tático QR',           'Controle de equipamentos por QR code',                      'gestao',       array['avancado','premium'],                    400,    true),
  ('ia_triagem',                 'IA de Triagem',               'Triagem automática de ocorrências por IA',                   'ia',           array['avancado','premium'],                    600,    true),
  ('saude_perfis',               'Perfis Médicos',              'Perfis médicos de emergência e wearables',                   'saude',        array['avancado','premium'],                    300,    true),
  ('defesa_civil_geofence',      'Defesa Civil Geofence',       'Cercas geográficas de risco e notificação em massa',         'defesa_civil', array['avancado','premium'],                    500,    true)
on conflict (modulo_id) do nothing;

-- ---------------------------------------------------------------------
--  CONQUISTAS DA EQUIPE (defaults)
-- ---------------------------------------------------------------------
insert into public.team_achievements (title, description, icon, category, target, current, completed, difficulty, reward_description)
values
  ('Primeiros Socorros',  'Equipe atendeu 100 ocorrências de saúde',           'HeartPulse', 'resolutions',   100, 0, false, 'bronze',   'Reconhecimento público + jantar da equipe'),
  ('Resposta Rápida',      'Tempo médio de resposta abaixo de 8 minutos',       'Timer',      'response_time', 8,   0, false, 'silver',   'Placa de eficiência operacional'),
  ('Checklist Impecável',  '95% dos checklists de equipamento aprovados',       'CheckSquare','checklists',   95,  0, false, 'gold',     'Reconhecimento no painel + brinde'),
  ('Capacitação Total',    '100% dos agentes concluíram a trilha de treinamento','GraduationCap','training',  100,  0, false, 'platinum','Certificação institucional + bônus'),
  ('Comunidade Engajada',   '50 feedbacks positivos de cidadãos no mês',         'ThumbsUp',   'community',    50,  0, false, 'silver',   'Destaque no mural da equipe'),
  ('Patrulha Completa',     'Todas as zonas de patrulha cobertas por 30 dias',   'MapPin',     'checklists',   30,  0, false, 'gold',     'Placa de cobertura territorial')
on conflict do nothing;

-- ---------------------------------------------------------------------
--  CÂMERAS DE EXEMPLO
-- ---------------------------------------------------------------------
insert into public.cameras (name, type, lat, lng, zone, address, active, notes)
values
  ('CHECKPOINT-01', 'fixed', -15.7942, -47.8825, 'Portão Principal',      'Praça Central, Asa Sul',   true, 'Câmera de checkpoint fixa'),
  ('CAM-PRAÇA-02',  'ptz',   -15.7955, -47.8810, 'Praça Central',          'Praça Central',             true, 'PTZ com rotação 360º'),
  ('CAM-BECO-03',   'dome',  -15.7930, -47.8845, 'Beco dos Fundos',        'Rua das Acácias, fundos',  true, 'Dome coberto')
on conflict do nothing;

-- ---------------------------------------------------------------------
--  AGENTES DE SEGURANÇA DE EXEMPLO (para despacho Haversine)
-- ---------------------------------------------------------------------
insert into public.agentes_seguranca (nome, tipo, lat, lng, status, veiculo, telefone)
values
  ('Carlos Mendes',    'policial',   -15.7950, -47.8820, 'disponivel',     'PM-4521', '+55 61 99999-0001'),
  ('Ana Ribeiro',      'socorrista', -15.7935, -47.8830, 'disponivel',     'SAMU-089', '+55 61 99999-0002'),
  ('Roberto Souza',    'bombeiro',   -15.7948, -47.8850, 'em_atendimento', 'CB-023',  '+55 61 99999-0003')
on conflict do nothing;

-- ---------------------------------------------------------------------
--  ZONAS DE PATRULHA DE EXEMPLO
-- ---------------------------------------------------------------------
insert into public.patrol_zones (name, lat, lng, shift_type, notes)
values
  ('Centro - Asa Sul',  -15.7942, -47.8825, 'morning', 'Zona comercial de alto fluxo'),
  ('Setor Comercial',   -15.7960, -47.8840, 'afternoon','Concentração de comércio e bancos'),
  ('Zona Residencial Norte', -15.7800, -47.8900, 'night', 'Zona residencial, incidência noturna'),
  ('Parque Central',    -15.7920, -47.8810, '24h',    'Área de lazer, monitoramento 24h')
on conflict do nothing;

-- ---------------------------------------------------------------------
--  VIATURAS DE EXEMPLO
-- ---------------------------------------------------------------------
insert into public.vehicles (prefix, plate, model, status, odometer_km, daily_km, next_maintenance_km)
values
  ('RP-01', 'ABC1D23', 'Toyota Hilux 2023', 'available',  45200, 0, 50000),
  ('SAMU-089', 'MED2E45', 'Ambulância Sprinter', 'on_patrol', 78300, 0, 80000),
  ('CB-023', 'BOM3F67', 'Caminhão de Bombeiros', 'maintenance', 120500, 0, 125000)
on conflict do nothing;

-- ---------------------------------------------------------------------
--  POSTES DE ILUMINAÇÃO DE EXEMPLO
-- ---------------------------------------------------------------------
insert into public.postes_iluminacao (coordenada_lat, coordenada_lng, endereco, bairro, cidade, status, tipo, potencia_watts, altura_metros, id_prefeitura)
values
  (-15.7940, -47.8820, 'Rua das Palmeiras, 100', 'Asa Sul',   'Brasília', 'funcionando', 'led',   90, 8, 'PST-0001'),
  (-15.7935, -47.8835, 'Rua das Acácias, 45',    'Asa Sul',   'Brasília', 'com_defeito', 'sodio', 150, 7, 'PST-0002'),
  (-15.7950, -47.8810, 'Av. Central, 1200',      'Centro',    'Brasília', 'funcionando', 'led',   90, 8, 'PST-0003')
on conflict do nothing;

-- ---------------------------------------------------------------------
--  MÓDULOS DE TREINAMENTO DE EXEMPLO
-- ---------------------------------------------------------------------
insert into public.training_modules (title, description, video_url, category, quiz, passing_score, active)
values
  ('Protocolo de Atendimento ao Cidadão',
   'Como abordar, acolher e registrar ocorrências com empatia.',
   'https://www.youtube.com/embed/dQw4w9WgXcQ',
   'protocols',
   '[{"question":"Qual a primeira ação ao receber um chamado?","options":["Ignorar o cidadão","Acolher e registrar","Transferir direto","Pedir documento"],"correct":1}]'::jsonb,
   70, true),
  ('Legislação e Direitos',
   'LGPD, lei de acesso à informação e direitos do cidadão.',
   'https://www.youtube.com/embed/dQw4w9WgXcQ',
   'legislation',
   '[{"question":"O que a LGPD protege?","options":["Dados pessoais","Carros","Animais","Comércio"],"correct":0}]'::jsonb,
   70, true),
  ('Primeiros Socorros Básico',
   'RCP, controle de hemorragia e estabilização até a chegada do SAMU.',
   'https://www.youtube.com/embed/dQw4w9WgXcQ',
   'first_aid',
   '[{"question":"Qual a frequência de compressões em adulto?","options":["60-80/min","100-120/min","140/min","20/min"],"correct":1}]'::jsonb,
   80, true)
on conflict do nothing;

-- ---------------------------------------------------------------------
--  CLIENTE MUNICIPAL DE EXEMPLO (trial)
-- ---------------------------------------------------------------------
insert into public.clientes_municipais (nome_municipio, estado, populacao, nome_responsavel, email_responsavel, telefone, plano, status, modulos_ativos, limite_usuarios_cidadaos, limite_usuarios_agentes, valor_mensal, data_inicio_contrato, invite_token)
values
  ('Brasília (Demonstração)', 'DF', 3055149, 'Secretaria de Segurança', 'seguranca@exemplo.gov.br', '+55 61 3333-0000',
   'avancado', 'trial', array['cidadao_basico','agente_gestao_turno','gestao_cameras','gestao_heatmap','gestao_analise_preditiva','cidadao_perimetro_infantil'],
   20000, 40, 7999.00, current_date, 'demo-invite-token-brasilia-2026')
on conflict (invite_token) do nothing;

-- =====================================================================
--  NOTAS DE MIGRAÇÃO
-- ---------------------------------------------------------------------
--  1) USUÁRIOS: o Supabase Auth cria os usuários em auth.users.
--     Para espelhar o perfil (role, points, etc.) crie o registro em
--     public.users APÓS o cadastro do usuário no Auth, com o mesmo id.
--     Exemplo (após criar o usuário no Auth):
--       insert into public.users (id, email, full_name, role)
--       values ('<uuid-do-auth>', 'admin@sentinela.gov.br', 'Admin Master', 'admin');
--
--  2) Para converter os face_embedding (double precision[]) em vetores
--     pgvector (para busca por similaridade facial):
--       create extension if not exists vector;
--       alter table public.alunos_biometria add column face_embedding_vec vector(128);
--       update public.alunos_biometria
--         set face_embedding_vec = (array_to_string(face_embedding,',')::vector);
--       (idem para biometria_responsaveis, blacklist_biometrica, wanted_criminals)
--
--  3) RLS já está habilitada nas tabelas sensíveis. Para tabelas de
--     operação interna (vehicles, patrol_zones, training, etc.) a RLS
--     está DESABILITADA por padrão — ative conforme a política de
--     acesso desejada antes de ir para produção.
--
--  4) Gatilhos de updated_date foram criados automaticamente em todas
--     as tabelas.
-- =====================================================================