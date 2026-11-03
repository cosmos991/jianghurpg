-- Game configuration only. Does not create player saves or enable game features.
-- Apply once through Supabase SQL Editor, or through Supabase migrations.
begin;

create schema if not exists jianghu_private;
revoke all on schema jianghu_private from public, anon, authenticated;

create table public.era_templates (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '',
  duration_years integer not null default 20 check (duration_years between 1 and 100),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.era_objectives (
  era_id text not null references public.era_templates(id) on delete restrict,
  id text not null check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '',
  category text not null check (category in ('investigation','protection','cooperation','operation')),
  condition_code text not null check (condition_code in ('CLUE_FOUND','INFILTRATORS_EXPOSED','DEFENSE_SUCCESS','ALLIANCE_SECURED','SUPPLY_BASE_STOPPED','RITUAL_STOPPED')),
  target_key text not null check (length(trim(target_key)) between 1 and 100),
  points integer not null check (points between 1 and 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (era_id, id),
  unique (era_id, condition_code, target_key)
);
create table public.era_outcomes (
  era_id text not null references public.era_templates(id) on delete restrict,
  id text not null check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) between 1 and 100),
  min_score integer not null check (min_score between 0 and 100),
  max_score integer not null check (max_score between 0 and 100),
  required_objective_ids text[] not null default '{}',
  world_result text not null check (length(trim(world_result)) > 0),
  fame_reward integer not null default 0 check (fame_reward between 0 and 10000),
  contribution_reward integer not null default 0 check (contribution_reward between 0 and 10000),
  legacy_reward_code text not null default 'NONE' check (legacy_reward_code in ('NONE','SECT_LEGACY_CHOICE','SPECIAL_LEGACY_CHOICE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (era_id, id),
  check (min_score <= max_score),
  check (array_position(required_objective_ids, null) is null)
);

comment on table public.era_templates is '시대 설정. draft에서 편집하고 published로 변경하면 전체 구성을 검사합니다.';
comment on table public.era_objectives is '과제별 최초 완료에만 점수를 줍니다. condition_code와 target_key 조합은 시대 안에서 중복할 수 없습니다.';
comment on table public.era_outcomes is '결산 결과표. 최고 한 구간의 보상만 지급하며 필수 목표 미달이면 아래 등급으로 내려갑니다.';
comment on column public.era_templates.version is '시대를 시작할 때 버전과 설정 전체를 고정합니다. 기존 세계에 소급 적용하지 않습니다.';
comment on column public.era_objectives.target_key is '세계 생성 시 인물·장소에 연결하는 고정 슬롯. 예: clue_01, region_01. 자유 실행 코드가 아닙니다.';
comment on column public.era_outcomes.required_objective_ids is '이 결과 등급에 필요한 과제 ID 배열. 최고 등급은 ritual_stop 필수 등의 방식으로 지정합니다.';

create function jianghu_private.era_catalog_touch_updated_at() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger era_templates_touch before update on public.era_templates for each row execute function jianghu_private.era_catalog_touch_updated_at();
create trigger era_objectives_touch before update on public.era_objectives for each row execute function jianghu_private.era_catalog_touch_updated_at();
create trigger era_outcomes_touch before update on public.era_outcomes for each row execute function jianghu_private.era_catalog_touch_updated_at();

-- A published era must have exactly 100 available points and cover score 0..100.
create function jianghu_private.validate_era_catalog(era_key text) returns void
language plpgsql security invoker set search_path = pg_catalog as $$
declare total integer; cursor_score integer := 0; row_outcome record;
begin
  -- Lock the parent so concurrent edits and publication cannot interleave.
  perform 1 from public.era_templates where id = era_key for update;
  if not exists (select 1 from public.era_templates where id = era_key and status = 'published') then return; end if;
  select coalesce(sum(points),0) into total from public.era_objectives where era_id = era_key;
  if total <> 100 then raise exception '시대 %: 과제 점수 합계는 100이어야 합니다. 현재 %점입니다. draft에서 수정하세요.', era_key, total; end if;
  for row_outcome in select * from public.era_outcomes where era_id = era_key order by min_score, max_score loop
    if row_outcome.min_score <> cursor_score then raise exception '시대 %: 결과 구간에 빈틈 또는 중복이 있습니다. %점부터 이어져야 합니다.', era_key, cursor_score; end if;
    if exists (select 1 from unnest(row_outcome.required_objective_ids) as required(id) where not exists (select 1 from public.era_objectives o where o.era_id = era_key and o.id = required.id)) then
      raise exception '시대 %: 결과 %에 존재하지 않는 필수 과제가 있습니다.', era_key, row_outcome.id;
    end if;
    if cursor_score = 0 and cardinality(row_outcome.required_objective_ids) <> 0 then raise exception '최하위 결과에는 필수 과제를 지정할 수 없습니다.'; end if;
    cursor_score := row_outcome.max_score + 1;
  end loop;
  if cursor_score <> 101 then raise exception '시대 %: 결과 구간은 0~100 전체를 포함해야 합니다.', era_key; end if;
end;
$$;
create function jianghu_private.check_era_catalog_change() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_table_name = 'era_templates' then
    perform jianghu_private.validate_era_catalog(new.id);
  else
    if tg_op in ('UPDATE','DELETE') then perform jianghu_private.validate_era_catalog(old.era_id); end if;
    if tg_op in ('INSERT','UPDATE') then perform jianghu_private.validate_era_catalog(new.era_id); end if;
  end if;
  return null;
end;
$$;
-- Deferred validation permits a complete multi-row update in one transaction.
create constraint trigger era_templates_validate after insert or update on public.era_templates deferrable initially deferred for each row execute function jianghu_private.check_era_catalog_change();
create constraint trigger era_objectives_validate after insert or update or delete on public.era_objectives deferrable initially deferred for each row execute function jianghu_private.check_era_catalog_change();
create constraint trigger era_outcomes_validate after insert or update or delete on public.era_outcomes deferrable initially deferred for each row execute function jianghu_private.check_era_catalog_change();

alter table public.era_templates enable row level security;
alter table public.era_objectives enable row level security;
alter table public.era_outcomes enable row level security;
revoke all on public.era_templates, public.era_objectives, public.era_outcomes from anon, authenticated;
grant select on public.era_templates, public.era_objectives, public.era_outcomes to anon, authenticated;
create policy era_templates_public_read on public.era_templates for select to anon, authenticated using (status = 'published');
create policy era_objectives_public_read on public.era_objectives for select to anon, authenticated using (exists (select 1 from public.era_templates e where e.id = era_id and e.status = 'published'));
create policy era_outcomes_public_read on public.era_outcomes for select to anon, authenticated using (exists (select 1 from public.era_templates e where e.id = era_id and e.status = 'published'));
revoke all on function jianghu_private.validate_era_catalog(text), jianghu_private.check_era_catalog_change(), jianghu_private.era_catalog_touch_updated_at() from public, anon, authenticated;

commit;
