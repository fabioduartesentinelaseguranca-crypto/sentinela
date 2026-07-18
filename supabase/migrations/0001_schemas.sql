-- =====================================================================
--  SENTINELA — Migração para Supabase (PostgreSQL)
--  Arquivo 1/2: DDL (schemas, índices, triggers, RLS)
-- ---------------------------------------------------------------------
--  Convenções:
--   • id           uuid default gen_random_uuid() (PK em todas as tabelas)
--   • created_date / updated_date  timestamptz default now()
--   • created_by_id uuid  ->  auth.users(id)  (Base44 builtin)
--   • Enums        -> text + CHECK (portável, fácil de evoluir)
--   • Arrays numéricos (face_embedding) -> double precision[]
--   • Arrays de strings -> text[]
--   • Objetos/arrays de objetos (polígonos, quiz, telemetria) -> jsonb
--   • Coordenadas/scores -> double precision;  dinheiro -> numeric(12,2)
--  RLS espelha as regras do Base44 (dono / agente+admin / só-admin).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Helpers de RLS
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce((auth.jwt() ->> 'role') = 'admin', false)
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;

create or replace function public.is_agent()
returns boolean language sql stable security definer as $$
  select coalesce((auth.jwt() ->> 'role') = 'agent', false)
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'agent');
$$;

create or replace function public.is_psychologist()
returns boolean language sql stable security definer as $$
  select coalesce((auth.jwt() ->> 'role') = 'psychologist', false)
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'psychologist');
$$;

-- ---------------------------------------------------------------------
--  Trigger automático de updated_date
-- ---------------------------------------------------------------------
create or replace function public.set_updated_date()
returns trigger language plpgsql as $$
begin new.updated_date = now(); return new; end; $$;

-- =====================================================================
--  USUÁRIOS (espelha entidade built-in User)
-- =====================================================================
create table if not exists public.users (
  id                          uuid primary key default gen_random_uuid(),
  created_date                timestamptz not null default now(),
  updated_date                timestamptz not null default now(),
  created_by_id               uuid references auth.users(id) on delete set null,
  email                       text,
  full_name                   text,
  role                        text not null default 'citizen'
                              check (role in ('citizen','agent','admin','psychologist')),
  points                      double precision not null default 0,
  agent_badge                 text,
  protective_measure_status   text not null default 'none'
                              check (protective_measure_status in ('none','pending','active','inactive')),
  protective_measure_doc_url  text,
  disarm_pin                  text,
  coercion_pin                text,
  last_location               jsonb,
  cliente_id                  text,
  cliente_nome                text,
  termos_aceitos              boolean not null default false,
  termos_aceitos_em           timestamptz,
  termos_versao               text,
  termo_confidencialidade_aceito        boolean not null default false,
  termo_confidencialidade_aceito_em     timestamptz,
  termo_confidencialidade_versao        text
);
alter table public.users enable row level security;
create policy users_self_read   on public.users for select using (id = auth.uid() or is_admin());
create policy users_self_update  on public.users for update using (id = auth.uid() or is_admin());
create policy users_admin_insert on public.users for insert with check (is_admin());
create policy users_admin_delete on public.users for delete using (is_admin());

-- =====================================================================
--  CIDADÃO — Segurança infantil, saúde, coação, sessões, anjos
-- =====================================================================
create table if not exists public.perimetros_seguranca_infantil (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text not null,
  user_name     text,
  nome_crianca  text not null,
  nome_local    text not null,
  tipo          text not null default 'escola' check (tipo in ('escola','creche','parque','rota_escolar','casa_parente','outro')),
  lat           double precision not null,
  lng           double precision not null,
  raio_metros   double precision not null default 300,
  horario_inicio text,
  horario_fim   text,
  dias_semana   integer[],
  dispositivo_crianca_id text,
  ativo         boolean not null default true,
  data_criacao  timestamptz
);
create index on public.perimetros_seguranca_infantil (user_id);
create index on public.perimetros_seguranca_infantil using gist (lat, lng);
alter table public.perimetros_seguranca_infantil enable row level security;
create policy psi_owner on public.perimetros_seguranca_infantil for all
  using (user_id = auth.uid()::text or is_admin())
  with check (user_id = auth.uid()::text or is_admin());

create table if not exists public.logs_frequencia_cardiaca_wearables (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text not null,
  user_name     text,
  bpm           double precision not null,
  data_registro timestamptz,
  origem        text not null default 'smartwatch' check (origem in ('smartwatch','manual','health_connect','health_kit')),
  acao_tomada   text not null default 'nenhuma' check (acao_tomada in ('nenhuma','alerta_enviado','panico_autonomo','confirmado_seguro','queda_detectada')),
  status_resposta text not null default 'pendente' check (status_resposta in ('pendente','seguro','nao_respondeu')),
  coordenada_lat double precision,
  coordenada_lng double precision
);
create index on public.logs_frequencia_cardiaca_wearables (user_id, data_registro desc);
alter table public.logs_frequencia_cardiaca_wearables enable row level security;
create policy lfcw_owner_r on public.logs_frequencia_cardiaca_wearables for select using (user_id = auth.uid()::text or is_admin());
create policy lfcw_owner_w on public.logs_frequencia_cardiaca_wearables for insert with check (user_id = auth.uid()::text or is_admin());
create policy lfcw_owner_u on public.logs_frequencia_cardiaca_wearables for update using (user_id = auth.uid()::text or is_admin());
create policy lfcw_admin_d on public.logs_frequencia_cardiaca_wearables for delete using (is_admin());

create table if not exists public.configuracoes_biometria_coacao (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text not null,
  user_name     text,
  coacao_pin    text,
  coacao_ativada boolean not null default true,
  disarm_pin    text,
  metodo_coacao text not null default 'pin' check (metodo_coacao in ('pin','digital_coacao','face_coacao'))
);
create index on public.configuracoes_biometria_coacao (user_id);
alter table public.configuracoes_biometria_coacao enable row level security;
create policy cbc_owner on public.configuracoes_biometria_coacao for all
  using (user_id = auth.uid()::text or is_admin())
  with check (user_id = auth.uid()::text or is_admin());

create table if not exists public.perfis_medicos_usuarios (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text not null,
  user_name     text,
  tipo_sanguineo text not null default 'nao_informado' check (tipo_sanguineo in ('A+','A-','B+','B-','AB+','AB-','O+','O-','nao_informado')),
  alergias      text[],
  restricoes_medicamentos text[],
  condicoes_preexistentes text[],
  medicamentos_uso_continuo text[],
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  contato_emergencia_parentesco text,
  contato_emergencia_alternativo text,
  plano_saude   text,
  numero_plano  text,
  observacoes   text,
  ultima_atualizacao timestamptz
);
create index on public.perfis_medicos_usuarios (user_id);
alter table public.perfis_medicos_usuarios enable row level security;
create policy pmu_read on public.perfis_medicos_usuarios for select using (user_id = auth.uid()::text or is_agent() or is_admin());
create policy pmu_write on public.perfis_medicos_usuarios for all
  using (user_id = auth.uid()::text or is_admin())
  with check (user_id = auth.uid()::text or is_admin());

create table if not exists public.emergency_contacts (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  owner_id      text,
  name          text not null,
  phone         text not null,
  relation      text
);
create index on public.emergency_contacts (owner_id);
alter table public.emergency_contacts enable row level security;
create policy ec_owner on public.emergency_contacts for all
  using (owner_id = auth.uid()::text or is_admin())
  with check (owner_id = auth.uid()::text or is_admin());

create table if not exists public.sessoes_caminhe_comigo (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text not null,
  user_name     text,
  status        text not null default 'active' check (status in ('active','ended')),
  share_token   text not null,
  origem_lat    double precision,
  origem_lng    double precision,
  destino_lat   double precision,
  destino_lng   double precision,
  destino_nome  text,
  contato_notificado text,
  contato_telefone text,
  started_at    timestamptz,
  ended_at      timestamptz
);
create index on public.sessoes_caminhe_comigo (user_id);
create unique index on public.sessoes_caminhe_comigo (share_token);
alter table public.sessoes_caminhe_comigo enable row level security;
create policy scc_rw on public.sessoes_caminhe_comigo for all
  using (user_id = auth.uid()::text or is_admin())
  with check (user_id = auth.uid()::text or is_admin());

create table if not exists public.anjos_guarda (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text not null,
  user_name     text not null,
  telefone      text,
  bairro        text not null,
  cidade        text,
  lat           double precision,
  lng           double precision,
  status        text not null default 'pendente' check (status in ('pendente','aprovado','suspenso','inativo')),
  certificacoes text[],
  disponibilidade text not null default 'disponivel' check (disponibilidade in ('disponivel','indisponivel','dormindo')),
  total_atendimentos double precision not null default 0,
  avaliacao_media double precision not null default 5,
  observacoes   text,
  aprovado_por_id text,
  aprovado_por_nome text,
  data_cadastro timestamptz
);
create index on public.anjos_guarda (status);
alter table public.anjos_guarda enable row level security;
create policy ag_read on public.anjos_guarda for select using (status = 'aprovado' or user_id = auth.uid()::text or is_admin());
create policy ag_citizen on public.anjos_guarda for insert with check (user_id = auth.uid()::text or is_admin());
create policy ag_update on public.anjos_guarda for update using ((user_id = auth.uid()::text and status = 'pendente') or is_admin());
create policy ag_del on public.anjos_guarda for delete using (is_admin());

-- =====================================================================
--  OCORRÊNCIAS & ALERTAS
-- =====================================================================
create table if not exists public.occurrences (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  type          text not null check (type in ('crime','traffic','civil_defense','health','panic')),
  subtype       text,
  status        text not null default 'open' check (status in ('open','in_progress','resolved','canceled')),
  description   text,
  lat           double precision,
  lng           double precision,
  address       text,
  media_urls    text[],
  reporter_id   text,
  assigned_agent_id text,
  priority      text not null default 'medium' check (priority in ('low','medium','high','critical')),
  resolution_notes text,
  awarded_points double precision not null default 0
);
create index on public.occurrences (status, created_date desc);
create index on public.occurrences (type);
create index on public.occurrences (reporter_id);
create index on public.occurrences (assigned_agent_id);
create index on public.occurrences using gist (lat, lng);
alter table public.occurrences enable row level security;
create policy occ_read on public.occurrences for select using (reporter_id = auth.uid()::text or is_agent() or is_admin());
create policy occ_citizen on public.occurrences for insert with check (true);
create policy occ_update on public.occurrences for update
  using ((reporter_id = auth.uid()::text and status = 'open') or assigned_agent_id = auth.uid()::text or is_agent() or is_admin());
create policy occ_del on public.occurrences for delete using (is_admin());

create table if not exists public.points_logs (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  user_id       text,
  user_name     text,
  points        double precision not null default 0,
  reason        text,
  occurrence_id text
);
create index on public.points_logs (user_id, created_date desc);

create table if not exists public.citizen_feedbacks (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  occurrence_id text not null,
  agent_id      text,
  agent_name    text,
  rating        double precision not null,
  comment       text,
  reporter_id   text
);
create index on public.citizen_feedbacks (occurrence_id);

create table if not exists public.anonymous_tips (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  description   text not null,
  lat           double precision,
  lng           double precision,
  address       text,
  category      text not null default 'other' check (category in ('drug_traffic','suspicious_activity','vandalism','abandoned_vehicle','risk_area','other')),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  manager_notes text,
  media_urls    text[]
);
create index on public.anonymous_tips (status, created_date desc);

create table if not exists public.alertas_inteligencia_ia (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  id_usuario    text,
  tipo_gatilho   text not null check (tipo_gatilho in ('CALCULADORA_PANICO','SENHA_COERCAO','DESVIO_ROTA')),
  data_hora_brasilia timestamptz not null,
  geolocalizacao_latitude double precision,
  geolocalizacao_longitude double precision,
  status_alerta text not null default 'TRIAGEM_IA' check (status_alerta in ('TRIAGEM_IA','DESPACHADO_POLICIA','EM_ANDAMENTO','FINALIZADO','SUSPEITA_TROTE')),
  url_audio_video_criptografado text,
  transcricao_audio_ia text,
  analise_acustica_tags text[],
  resumo_despacho_ia text,
  grau_prioridade_ia text not null default 'MÉDIO'
);
create index on public.alertas_inteligencia_ia (status_alerta, data_hora_brasilia desc);
alter table public.alertas_inteligencia_ia enable row level security;
create policy aii_read on public.alertas_inteligencia_ia for select using (id_usuario = auth.uid()::text or is_agent() or is_admin());
create policy aii_write on public.alertas_inteligencia_ia for insert with check (true);
create policy aii_update on public.alertas_inteligencia_ia for update
  using ((id_usuario = auth.uid()::text and status_alerta = 'TRIAGEM_IA') or is_agent() or is_admin());

create table if not exists public.alertas_quarentena (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  ocorrencia_id text not null,
  user_id       text not null,
  user_name     text,
  motivo_suspeita text not null,
  evidencias    text[],
  score_suspeita double precision check (score_suspeita between 0 and 100),
  fatores_analisados jsonb,
  status_validacao text not null default 'pendente' check (status_validacao in ('pendente','em_analise','confirmado_trote','falso_positivo')),
  revisado_por_id text,
  revisado_por_nome text,
  data_revisao  timestamptz,
  observacoes_revisao text
);
create index on public.alertas_quarentena (ocorrencia_id);
alter table public.alertas_quarentena enable row level security;
create policy aq_rw on public.alertas_quarentena for all using (is_agent() or is_admin()) with check (is_agent() or is_admin());

-- =====================================================================
--  AGENTES DE SEGURANÇA & DESPACHO
-- =====================================================================
create table if not exists public.agentes_seguranca (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  nome          text not null,
  tipo          text not null check (tipo in ('policial','socorrista','bombeiro')),
  lat           double precision,
  lng           double precision,
  status        text not null default 'disponivel' check (status in ('disponivel','em_atendimento','fora_servico')),
  veiculo       text,
  push_token    text,
  telefone      text
);
create index on public.agentes_seguranca (status);
create index on public.agentes_seguranca using gist (lat, lng);
alter table public.agentes_seguranca enable row level security;
create policy as_read on public.agentes_seguranca for select using (is_agent() or is_admin());
create policy as_admin on public.agentes_seguranca for all using (is_admin()) with check (is_admin());

-- =====================================================================
--  SEGURANÇA ESCOLAR (Biometria, Blacklist, Cercas, Visitantes, Registros)
-- =====================================================================
create table if not exists public.cercas_virtuais_escolares (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  nome_escola   text not null,
  tipo_escola   text not null default 'escola_municipal' check (tipo_escola in ('escola_municipal','escola_estadual','creche','escola_particular','outro')),
  endereco      text,
  poligono      jsonb not null,
  tipos_alerta  text[],
  horario_inicio text,
  horario_fim   text,
  ativo         boolean not null default true,
  criado_por_id text,
  criado_por_nome text
);
alter table public.cercas_virtuais_escolares enable row level security;
create policy cve_rw on public.cercas_virtuais_escolares for all using (is_agent() or is_admin()) with check (is_agent() or is_admin());

create table if not exists public.alunos_biometria (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  nome          text not null,
  data_nascimento date,
  matricula     text not null,
  turno         text not null default 'manha' check (turno in ('manha','tarde','noite','integral')),
  horario_entrada text,
  horario_saida text,
  tolerancia_minutos double precision not null default 15,
  id_escola_cerca text not null,
  nome_escola   text,
  foto_url      text,
  face_embedding double precision[],
  usa_oculos    boolean not null default false,
  foto_url_oculos text,
  face_embedding_oculos double precision[],
  responsaveis_ids text[],
  responsaveis_nomes text[],
  cadastrado_por_id text,
  cadastrado_por_nome text,
  ativo         boolean not null default true
);
create index on public.alunos_biometria (matricula);
create index on public.alunos_biometria (id_escola_cerca);
alter table public.alunos_biometria enable row level security;
create policy ab_read on public.alunos_biometria for select using (is_agent() or is_admin() or true);  -- citizen read (LGPD: ajustar p/ domínio)
create policy ab_write on public.alunos_biometria for insert with check (is_agent() or is_admin());
create policy ab_upd on public.alunos_biometria for update using (is_agent() or is_admin());
create policy ab_del on public.alunos_biometria for delete using (is_admin());

create table if not exists public.biometria_responsaveis (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  nome_responsavel text not null,
  parentesco    text not null default 'responsavel_legal' check (parentesco in ('pai','mae','avo','avoa','tio','tia','responsavel_legal','outro')),
  telefone      text,
  id_escola_cerca text not null,
  nome_escola   text,
  matriculas_vinculadas text[],
  alunos_ids    text[],
  alunos_nomes  text[],
  foto_url      text,
  face_embedding double precision[],
  score_qualidade double precision,
  ativo         boolean not null default true,
  cadastrado_por_id text,
  cadastrado_por_nome text
);
create index on public.biometria_responsaveis (id_escola_cerca);
alter table public.biometria_responsaveis enable row level security;
create policy br_rw on public.biometria_responsaveis for all using (is_agent() or is_admin()) with check (is_agent() or is_admin());

create table if not exists public.blacklist_biometrica (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  descricao_risco text not null,
  nivel_alerta  text not null default 'vermelho' check (nivel_alerta in ('vermelho','laranja','amarelo')),
  face_embedding double precision[],
  foto_url      text,
  nome_suspeito text,
  documentos    text[],
  ativo         boolean not null default true,
  criado_por_id text,
  criado_por_nome text
);
alter table public.blacklist_biometrica enable row level security;
create policy bb_read on public.blacklist_biometrica for select using (is_agent() or is_admin());
create policy bb_admin on public.blacklist_biometrica for all using (is_admin()) with check (is_admin());

create table if not exists public.ordens_servico_visitantes (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  id_escola_cerca text not null,
  nome_escola   text,
  nome_visitante text not null,
  tipo_visitante text not null default 'visitante_comum' check (tipo_visitante in ('fornecedor','tecnico','prestador_servico','visitante_comum')),
  foto_url      text,
  face_embedding double precision[],
  documento_identidade text,
  motivo_visita text,
  qr_token     text,
  data_visita  date not null,
  horario_inicio text,
  horario_fim   text,
  status       text not null default 'pendente' check (status in ('pendente','ativo','utilizado','expirado','cancelado')),
  usado_em     timestamptz,
  criado_por_id text,
  criado_por_nome text
);
create index on public.ordens_servico_visitantes (qr_token);
alter table public.ordens_servico_visitantes enable row level security;
create policy osv_rw on public.ordens_servico_visitantes for all using (is_agent() or is_admin()) with check (is_agent() or is_admin());

create table if not exists public.registros_acesso_escolar (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  id_aluno      text not null,
  nome_aluno    text,
  matricula     text,
  id_escola_cerca text,
  nome_escola   text,
  tipo_evento   text not null check (tipo_evento in ('entrada','saida')),
  data_hora     timestamptz not null,
  confianca_score double precision,
  metodo        text not null default 'facial' check (metodo in ('facial','manual','qrcode')),
  dentro_horario boolean,
  alerta_disparado boolean not null default false,
  motivo_alerta text,
  registrado_por_id text,
  pendente_sync boolean not null default false
);
create index on public.registros_acesso_escolar (id_aluno, data_hora desc);
create index on public.registros_acesso_escolar (id_escola_cerca, data_hora desc);
alter table public.registros_acesso_escolar enable row level security;
create policy rae_read on public.registros_acesso_escolar for select using (is_agent() or is_admin() or true); -- citizen read (LGPD)
create policy rae_write on public.registros_acesso_escolar for insert with check (is_agent() or is_admin() or true);
create policy rae_upd on public.registros_acesso_escolar for update using (is_agent() or is_admin());

create table if not exists public.acesso_logs (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  timestamp     timestamptz not null,
  snapshot_url  text,
  classification text not null check (classification in ('Allowed Student','Student Evasion Attempt','Unauthorized Intruder','Wanted Suspect','Ambiguous')),
  action_taken  text,
  person_name   text,
  person_id     text,
  similarity    double precision,
  camera_id     text,
  module        text check (module in ('escolar','procurados'))
);
create index on public.acesso_logs (module, timestamp desc);
alter table public.acesso_logs enable row level security;
create policy al_rw on public.acesso_logs for all using (is_agent() or is_admin()) with check (is_agent() or is_admin());

create table if not exists public.alertas_intrusao_escolar (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  tipo_alerta   text not null check (tipo_alerta in ('blacklist_match','suspeito_permanencia','acesso_fora_horario','anti_spoofing','visitante_sem_os','panico_operador','intruso_identificado','procurado_identificado')),
  nivel         text not null default 'vermelho' check (nivel in ('vermelho','laranja','amarelo')),
  id_escola_cerca text,
  nome_escola   text,
  descricao     text,
  foto_captura_url text,
  similaridade_blacklist double precision,
  id_blacklist_ref text,
  tempo_permanencia_seg double precision,
  horario_tentativa timestamptz,
  status        text not null default 'ativo' check (status in ('ativo','em_atendimento','resolvido','falso_positivo')),
  bloqueio_ativo boolean not null default false,
  camera_id     text,
  camera_name   text,
  camera_lat    double precision,
  camera_lng    double precision,
  module        text check (module in ('escolar','procurados')),
  agente_designado_id text,
  agente_designado_nome text,
  agente_designado_distancia_m double precision,
  dispatched_at timestamptz,
  atendido_por_id text,
  atendido_por_nome text,
  observacoes   text
);
create index on public.alertas_intrusao_escolar (status, created_date desc);
create index on public.alertas_intrusao_escolar (module);
alter table public.alertas_intrusao_escolar enable row level security;
create policy aie_write on public.alertas_intrusao_escolar for insert with check (true);
create policy aie_rw on public.alertas_intrusao_escolar for select using (is_agent() or is_admin());
create policy aie_upd on public.alertas_intrusao_escolar for update using (is_agent() or is_admin());
create policy aie_del on public.alertas_intrusao_escolar for delete using (is_admin());

-- =====================================================================
--  PROCURADOS
-- =====================================================================
create table if not exists public.wanted_criminals (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  name          text not null,
  alias         text,
  photo_url     text,
  face_embedding double precision[],
  description   text,
  crimes        text[],
  reward        numeric(12,2) not null default 0,
  status        text not null default 'wanted' check (status in ('wanted','captured','inactive')),
  danger_level  text not null default 'medium' check (danger_level in ('low','medium','high','extreme')),
  last_seen_location text,
  last_seen_date date,
  warrant_number text,
  age_approx   double precision,
  notes        text,
  threshold_alerta double precision not null default 80
);
create index on public.wanted_criminals (status);
alter table public.wanted_criminals enable row level security;
create policy wc_read on public.wanted_criminals for select using (is_agent() or is_admin());
create policy wc_admin on public.wanted_criminals for all using (is_admin()) with check (is_admin());

create table if not exists public.wanted_persons (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  alias         text not null,
  photo_url     text,
  face_embedding double precision[],
  threat_level  text not null default 'high' check (threat_level in ('high','medium')),
  notes         text
);
alter table public.wanted_persons enable row level security;
create policy wp_read on public.wanted_persons for select using (is_agent() or is_admin());
create policy wp_admin on public.wanted_persons for all using (is_admin()) with check (is_admin());

-- =====================================================================
--  BOLETINS DE OCORRÊNCIA (IA)
-- =====================================================================
create table if not exists public.boletins_ocorrencia_gerados (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  id_alerta     text not null,
  id_ocorrencia text,
  texto_juridico_bo text,
  tags_reconhecimento_visual text[],
  telemetria_iot jsonb,
  data_emissao  timestamptz,
  status_assinatura text not null default 'rascunho' check (status_assinatura in ('rascunho','assinado','rejeitado')),
  assinatura_agente_responsavel text,
  assinatura_agente_id text,
  texto_revisado_bo text,
  observacoes_revisao text
);
create index on public.boletins_ocorrencia_gerados (id_alerta);
alter table public.boletins_ocorrencia_gerados enable row level security;
create policy bog_write on public.boletins_ocorrencia_gerados for insert with check (is_agent() or is_admin());
create policy bog_read on public.boletins_ocorrencia_gerados for select using (id_alerta = auth.uid()::text or is_agent() or is_admin());
create policy bog_upd on public.boletins_ocorrencia_gerados for update using (is_agent() or is_admin());
create policy bog_del on public.boletins_ocorrencia_gerados for delete using (is_admin());

-- =====================================================================
--  DEFESA CIVIL & GEOFENCE
-- =====================================================================
create table if not exists public.cercas_geograficas_defesa_civil (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  nome          text not null,
  tipo_risco    text not null check (tipo_risco in ('alagamento','deslizamento','incendio','estrutural','quimico','tsunami','tornado','outro')),
  poligono_coordenadas jsonb not null,
  bairro        text,
  cidade        text,
  estado        text,
  nivel_urgencia text not null default 'medio' check (nivel_urgencia in ('extremo','alto','medio','baixo')),
  mensagem_alerta text,
  status        text not null default 'programado' check (status in ('ativo','inativo','programado')),
  data_ativacao timestamptz,
  data_desativacao timestamptz,
  criado_por_id text,
  criado_por_nome text,
  observacoes   text
);
alter table public.cercas_geograficas_defesa_civil enable row level security;
create policy cgdc_read on public.cercas_geograficas_defesa_civil for select using (status = 'ativo' or is_agent() or is_admin());
create policy cgdc_admin on public.cercas_geograficas_defesa_civil for all using (is_admin()) with check (is_admin());

create table if not exists public.notificacoes_geofence (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  cerca_id      text not null,
  cerca_nome    text,
  tipo_risco    text,
  nivel_urgencia text,
  user_id       text not null,
  user_name     text,
  coordenada_lat double precision,
  coordenada_lng double precision,
  data_disparo  timestamptz,
  mensagem      text,
  status_envio  text not null default 'enviado' check (status_envio in ('enviado','pendente','falhou','lido')),
  canal         text not null default 'push' check (canal in ('push','sms','email','todos'))
);
create index on public.notificacoes_geofence (user_id, data_disparo desc);
alter table public.notificacoes_geofence enable row level security;
create policy ng_write on public.notificacoes_geofence for insert with check (is_agent() or is_admin());
create policy ng_read on public.notificacoes_geofence for select using (user_id = auth.uid()::text or is_agent() or is_admin());
create policy ng_admin on public.notificacoes_geofence for update using (is_admin());
create policy ng_del on public.notificacoes_geofence for delete using (is_admin());

-- =====================================================================
--  INFRAESTRUTURA: Câmeras, Postes, Zonas de Patrulha
-- =====================================================================
create table if not exists public.cameras (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  name          text not null,
  type          text not null default 'fixed' check (type in ('fixed','dome','ptz')),
  lat           double precision not null,
  lng           double precision not null,
  zone          text,
  address       text,
  stream_url    text,
  active        boolean not null default true,
  notes         text
);
create index on public.cameras (active);
create index on public.cameras using gist (lat, lng);

create table if not exists public.postes_iluminacao (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  coordenada_lat double precision not null,
  coordenada_lng double precision not null,
  endereco      text,
  bairro        text,
  cidade        text,
  status        text not null default 'funcionando' check (status in ('funcionando','com_defeito','desligado','manutencao')),
  tipo          text not null default 'led' check (tipo in ('led','sodio','mercurio','solar','outro')),
  potencia_watts double precision,
  altura_metros double precision,
  ultima_manutencao date,
  id_prefeitura text,
  observacoes   text
);
create index on public.postes_iluminacao (status);
alter table public.postes_iluminacao enable row level security;
create policy pi_read on public.postes_iluminacao for select using (true); -- público
create policy pi_admin on public.postes_iluminacao for all using (is_admin()) with check (is_admin());

create table if not exists public.patrol_zones (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  name          text not null,
  lat           double precision not null,
  lng           double precision not null,
  shift_type    text not null default 'morning' check (shift_type in ('morning','afternoon','night','24h')),
  assigned_agent_id text,
  notes         text
);
create index on public.patrol_zones (shift_type);

-- =====================================================================
--  VEÍCULOS, MANUTENÇÃO, ESTOQUE TÁTICO
-- =====================================================================
create table if not exists public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  prefix        text not null,
  plate         text not null,
  model         text,
  status        text not null default 'available' check (status in ('available','on_patrol','maintenance','inactive')),
  odometer_km   double precision not null default 0,
  daily_km      double precision not null default 0,
  last_maintenance_date date,
  next_maintenance_km double precision,
  assigned_agent_id text,
  assigned_agent_name text,
  notes         text
);
create index on public.vehicles (status);
create unique index on public.vehicles (prefix);

create table if not exists public.vehicle_maintenance (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  vehicle_id    text not null,
  vehicle_prefix text,
  vehicle_plate text,
  type          text not null default 'preventive' check (type in ('preventive','corrective','inspection','tire','oil_change')),
  scheduled_date date,
  completed_date date,
  odometer_at_service double precision,
  next_service_km double precision,
  next_service_date date,
  workshop      text,
  cost          numeric(12,2) not null default 0,
  status        text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','overdue')),
  notes         text,
  alert_sent    boolean not null default false
);
create index on public.vehicle_maintenance (vehicle_id, scheduled_date);

create table if not exists public.tactical_items (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  name          text not null,
  category      text not null default 'other' check (category in ('vest','radio','flashlight','handcuff','first_aid','other')),
  serial_number text,
  total_quantity double precision not null default 0,
  available_quantity double precision not null default 0,
  min_quantity  double precision not null default 2,
  maintenance_interval_days double precision,
  last_maintenance_date date,
  next_maintenance_date date,
  status        text not null default 'ok' check (status in ('ok','low_stock','maintenance_due','inactive')),
  notes         text
);
create index on public.tactical_items (status);

create table if not exists public.tactical_stocks (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  name          text not null,
  category      text not null default 'other' check (category in ('weapon','vest','ammo','radio','flashlight','handcuff','medical','other')),
  serial_number text,
  qr_code       text,
  total_qty     double precision not null default 0,
  available_qty double precision not null default 0,
  min_qty       double precision not null default 2,
  expiry_date   date,
  last_inspection_date date,
  next_inspection_date date,
  status        text not null default 'ok' check (status in ('ok','low_stock','expiring_soon','expired','inactive')),
  notes         text
);
create index on public.tactical_stocks (qr_code);

create table if not exists public.tactical_checkouts (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  item_id       text not null,
  item_name     text,
  item_category text,
  agent_id      text not null,
  agent_name    text,
  type          text not null check (type in ('checkout','return')),
  quantity      double precision not null default 1,
  shift_id      text,
  condition_on_return text not null default 'ok' check (condition_on_return in ('ok','damaged','lost')),
  notes         text
);
create index on public.tactical_checkouts (agent_id, created_date desc);

create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  item_id       text not null,
  item_name     text,
  agent_id      text,
  agent_name    text,
  type          text not null check (type in ('checkout','return')),
  quantity      double precision not null default 1,
  shift_id      text,
  notes         text
);
create index on public.stock_movements (item_id, created_date desc);

create table if not exists public.maintenance_tickets (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  item_type     text not null check (item_type in ('vehicle','tactical_item')),
  item_id       text,
  item_name     text not null,
  reported_by_id text,
  reported_by_name text,
  description   text not null,
  photo_urls    text[],
  status        text not null default 'open' check (status in ('open','approved','in_repair','resolved','rejected')),
  manager_notes text,
  priority      text not null default 'medium' check (priority in ('low','medium','high','critical'))
);
create index on public.maintenance_tickets (status, created_date desc);

-- =====================================================================
--  TURNOS, ESCALAS, CHECKLISTS, BREADCRUMBS, MISSÕES
-- =====================================================================
create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text,
  vehicle_plate text,
  vehicle_prefix text not null,
  start_time    timestamptz,
  end_time      timestamptz,
  status        text not null default 'active' check (status in ('active','ended')),
  notes         text
);
create index on public.shifts (agent_id, start_time desc);

create table if not exists public.scheduled_shifts (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  vehicle_id    text,
  vehicle_name  text,
  zone_id       text,
  zone_name     text,
  date          date not null,
  shift_type    text not null default 'morning' check (shift_type in ('morning','afternoon','night')),
  start_time    text,
  end_time      text,
  notes         text,
  alert_sent    boolean not null default false
);
create index on public.scheduled_shifts (date, shift_type);

create table if not exists public.shift_breadcrumbs (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  shift_id      text not null,
  agent_id      text not null,
  agent_name    text,
  points        jsonb
);
create index on public.shift_breadcrumbs (shift_id);

create table if not exists public.equipment_checklists (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  shift_id      text,
  shift_date    date not null,
  radio_status  text not null default 'ok' check (radio_status in ('ok','inoperante','ausente')),
  weapon_status text not null default 'ok' check (weapon_status in ('ok','inoperante','ausente')),
  medical_kit_status text not null default 'ok' check (medical_kit_status in ('ok','inoperante','ausente')),
  vest_status   text not null default 'ok' check (vest_status in ('ok','inoperante','ausente')),
  handcuff_status text not null default 'ok' check (handcuff_status in ('ok','inoperante','ausente')),
  flashlight_status text not null default 'ok' check (flashlight_status in ('ok','inoperante','ausente')),
  baton_status  text not null default 'ok' check (baton_status in ('ok','inoperante','ausente')),
  inoperante_items text[],
  maintenance_alert_sent boolean not null default false,
  notes         text
);
create index on public.equipment_checklists (agent_id, shift_date desc);

create table if not exists public.vehicle_checklists (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  vehicle_id    text not null,
  vehicle_prefix text,
  shift_date    date not null,
  fuel_ok boolean, tires_ok boolean, signals_ok boolean,
  fire_extinguisher_ok boolean, first_aid_ok boolean,
  lights_ok boolean, radio_ok boolean,
  critical_issues text[],
  notes         text,
  status        text not null default 'pending' check (status in ('pending','approved','blocked'))
);
create index on public.vehicle_checklists (agent_id, shift_date desc);

create table if not exists public.shift_missions (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  mission_key   text not null,
  title         text not null,
  description   text,
  type          text not null default 'resolve' check (type in ('resolve','checklist','patrol_zone','response_time','feedback')),
  target        double precision,
  progress      double precision not null default 0,
  reward_points double precision not null default 50,
  reward_badge  text,
  expires_at    timestamptz,
  completed     boolean not null default false,
  completed_at  timestamptz,
  shift_id      text
);
create index on public.shift_missions (agent_id, created_date desc);

create table if not exists public.agent_rankings (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  resolved_count double precision not null default 0,
  avg_response_min double precision not null default 0,
  positive_feedbacks double precision not null default 0,
  score         double precision not null default 0,
  medals        text[],
  period        text
);
create index on public.agent_rankings (period, score desc);

-- =====================================================================
--  CAPACITAÇÃO, PSICOLOGIA, CONQUISTAS
-- =====================================================================
create table if not exists public.training_modules (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  title         text not null,
  description   text,
  video_url     text,
  category      text not null default 'protocols' check (category in ('protocols','legislation','first_aid','communication','tactical')),
  quiz          jsonb,
  passing_score double precision not null default 70,
  active        boolean not null default true
);

create table if not exists public.training_progress (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  module_id     text not null,
  module_title  text,
  status        text not null default 'not_started' check (status in ('not_started','watching','quiz','passed','failed')),
  score         double precision,
  attempts      double precision not null default 0,
  completed_at  timestamptz,
  submitted_task text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','revision')),
  review_feedback text,
  reviewed_at   timestamptz
);
create unique index on public.training_progress (agent_id, module_id);

create table if not exists public.certificate_records (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  module_id     text not null,
  module_title  text,
  issued_at     timestamptz,
  expires_at    timestamptz,
  score         double precision,
  valid         boolean not null default true
);
create index on public.certificate_records (agent_id);

create table if not exists public.psych_evaluations (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  stress_level  double precision not null,
  fatigue_level double precision not null,
  panic_triggers text[],
  sleep_hours   double precision,
  mood          text not null default 'neutral' check (mood in ('great','good','neutral','bad','critical')),
  notes         text,
  is_critical   boolean not null default false,
  hr_alert_sent boolean not null default false,
  reviewed_by   text
);
create index on public.psych_evaluations (agent_id, created_date desc);

create table if not exists public.psych_appointments (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  agent_id      text not null,
  agent_name    text,
  psychologist_id text,
  psychologist_name text,
  scheduled_at  timestamptz not null,
  duration_min  double precision not null default 50,
  modality      text not null default 'in_person' check (modality in ('in_person','online')),
  status        text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  reason        text,
  notes_confidential text,
  is_urgent     boolean not null default false,
  alert_sent_to_manager boolean not null default false
);
create index on public.psych_appointments (agent_id, scheduled_at);

create table if not exists public.team_achievements (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  title         text not null,
  description   text,
  icon          text,
  category      text not null default 'resolutions' check (category in ('resolutions','response_time','checklists','training','community')),
  target        double precision not null,
  current       double precision not null default 0,
  completed     boolean not null default false,
  completed_at  timestamptz,
  reward_description text,
  difficulty    text not null default 'bronze' check (difficulty in ('bronze','silver','gold','platinum'))
);

-- =====================================================================
--  MENSAGENS (chat & offline)
-- =====================================================================
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  occurrence_id text,
  channel       text not null,
  sender_id    text,
  sender_name   text,
  sender_role   text,
  content       text not null,
  msg_type      text not null default 'text' check (msg_type in ('text','image','video','audio','location')),
  media_url     text,
  location      jsonb
);
create index on public.chat_messages (channel, created_date);
create index on public.chat_messages (occurrence_id);

create table if not exists public.message_threads (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  name          text,
  type          text not null default 'direct' check (type in ('direct','group')),
  participant_ids text[] not null,
  last_message  text,
  last_message_at timestamptz
);
create index on public.message_threads using gin (participant_ids);

create table if not exists public.direct_messages (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  thread_id     text not null,
  sender_id     text,
  sender_name   text,
  sender_role   text,
  content       text not null,
  read_by       text[]
);
create index on public.direct_messages (thread_id, created_date);

create table if not exists public.offline_messages (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  sender_id     text not null,
  sender_name   text,
  channel       text not null,
  content       text not null,
  lat           double precision,
  lng           double precision,
  is_emergency  boolean not null default false,
  synced        boolean not null default false
);
create index on public.offline_messages (channel, created_date);

-- =====================================================================
--  INTELIGÊNCIA PREDITIVA & LOGS DE SISTEMA / QA
-- =====================================================================
create table if not exists public.analises_preditivas (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  titulo        text not null,
  resumo        text,
  tipo_crime    text not null,
  subtipos      text[],
  regiao        text not null,
  bairro        text,
  cidade        text,
  percentual_variacao double precision,
  tendencia     text not null default 'estavel' check (tendencia in ('alta','estavel','queda','pico')),
  faixa_horaria_inicio text,
  faixa_horaria_fim text,
  dias_criticos text[],
  data_geracao  timestamptz,
  periodo_analise_inicio date,
  periodo_analise_fim date,
  total_ocorrencias_periodo double precision,
  heatmap_coordenadas jsonb,
  recomendacoes text,
  fatores_contribuintes text[],
  status        text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  nivel_confianca text not null default 'media' check (nivel_confianca in ('alta','media','baixa'))
);
alter table public.analises_preditivas enable row level security;
create policy ap_write on public.analises_preditivas for insert with check (is_agent() or is_admin());
create policy ap_read on public.analises_preditivas for select using (is_agent() or is_admin());
create policy ap_admin on public.analises_preditivas for update using (is_admin());
create policy ap_del on public.analises_preditivas for delete using (is_admin());

create table if not exists public.system_logs (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  event         text not null,
  actor_id      text,
  actor_name    text,
  details       text,
  severity      text not null default 'info' check (severity in ('info','warning','critical'))
);
create index on public.system_logs (created_date desc);

create table if not exists public.system_health_logs (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  run_id        text not null,
  trigger       text not null default 'cron' check (trigger in ('cron','manual')),
  profile       text not null check (profile in ('citizen','agent','admin','system')),
  flow_key      text not null,
  flow_label    text,
  status        text not null default 'success' check (status in ('success','error','warning')),
  latency_ms    double precision,
  error_message text,
  error_payload text,
  is_critical   boolean not null default false,
  run_date      date,
  run_started_at timestamptz
);
create index on public.system_health_logs (run_date desc, profile);

create table if not exists public.logs_auditoria_qa (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  execucao_id   text not null,
  etapa         text not null check (etapa in ('geracao_dados','criacao_ocorrencias','triagem_ia','atribuicao_agente','progressao_status','finalizacao','health_check')),
  status        text not null default 'success' check (status in ('success','error','timeout','skipped')),
  tempo_ms      double precision,
  ocorrencia_id text,
  agente_id     text,
  error_message text,
  error_details text,
  detalhe       text,
  data_execucao timestamptz
);
create index on public.logs_auditoria_qa (execucao_id);
alter table public.logs_auditoria_qa enable row level security;
create policy laq on public.logs_auditoria_qa for all using (is_admin()) with check (is_admin());

-- =====================================================================
--  MULTITENANCY: Planos, Módulos, Clientes Municipais
-- =====================================================================
create table if not exists public.planos_assinatura (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  plano_id      text not null check (plano_id in ('basico','essencial','avancado','premium')),
  nome          text not null,
  descricao     text,
  faixa_populacional text,
  populacao_min double precision,
  populacao_max double precision,
  preco_base    numeric(12,2) not null,
  limite_cidadaos double precision,
  limite_agentes double precision,
  modulos_incluidos text[],
  ativo         boolean not null default true
);
create unique index on public.planos_assinatura (plano_id);

create table if not exists public.modulos_sentinela (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  modulo_id     text not null,
  nome          text not null,
  descricao     text,
  categoria     text not null check (categoria in ('cidadao','agente','gestao','ia','saude','defesa_civil')),
  planos_incluidos text[],
  preco_adicional numeric(12,2) not null default 0,
  ativo         boolean not null default true
);
create unique index on public.modulos_sentinela (modulo_id);

create table if not exists public.clientes_municipais (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id uuid references auth.users(id) on delete set null,
  nome_municipio text not null,
  estado        text not null,
  populacao     double precision not null,
  nome_responsavel text,
  email_responsavel text,
  telefone      text,
  cnpj          text,
  plano         text not null default 'basico' check (plano in ('basico','essencial','avancado','premium')),
  status        text not null default 'trial' check (status in ('ativo','suspenso','trial','cancelado')),
  modulos_ativos text[],
  limite_usuarios_cidadaos double precision not null default 1000,
  limite_usuarios_agentes double precision not null default 10,
  usuarios_cidadaos_ativos double precision not null default 0,
  usuarios_agentes_ativos double precision not null default 0,
  valor_mensal  numeric(12,2),
  data_inicio_contrato date,
  data_renovacao date,
  observacoes   text,
  invite_token   text
);
create unique index on public.clientes_municipais (invite_token);

-- =====================================================================
--  Triggers de updated_date (uma por tabela)
-- =====================================================================
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    and table_name <> 'users'  -- users usa trigger do auth; criar mesmo assim
  loop
    execute format('drop trigger if exists trg_updated_date on public.%I;', t);
    execute format('create trigger trg_updated_date before update on public.%I for each row execute function public.set_updated_date();', t);
  end loop;
end $$;

-- Nota: habilitar pgvector para busca biométrica por similaridade (opcional):
-- create extension if not exists vector;
-- alter table public.alunos_biometria add column face_embedding_vec vector(128);
-- (converter double precision[] -> vector no momento da carga)

-- FIM DO DDL