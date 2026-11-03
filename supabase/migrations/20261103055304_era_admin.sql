begin;

create table jianghu_private.era_admin_emails (
  email text primary key check (email = lower(trim(email)) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table jianghu_private.era_admin_emails enable row level security;
revoke all on jianghu_private.era_admin_emails from public, anon, authenticated;

-- Uses the current, verified Auth record, never user-editable metadata or an email supplied by the browser.
create function jianghu_private.is_era_admin() returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join jianghu_private.era_admin_emails a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function jianghu_private.is_era_admin() from public, anon, authenticated;
grant usage on schema jianghu_private to authenticated;
grant execute on function jianghu_private.is_era_admin() to authenticated;

create function public.era_admin_access() returns boolean
language sql stable security invoker set search_path = pg_catalog as $$
  select jianghu_private.is_era_admin();
$$;
revoke all on function public.era_admin_access() from public, anon;
grant execute on function public.era_admin_access() to authenticated;

drop policy era_templates_public_read on public.era_templates;
drop policy era_objectives_public_read on public.era_objectives;
drop policy era_outcomes_public_read on public.era_outcomes;
create policy era_templates_public_read on public.era_templates for select to anon using (status='published');
create policy era_objectives_public_read on public.era_objectives for select to anon using (exists (select 1 from public.era_templates e where e.id=era_id and e.status='published'));
create policy era_outcomes_public_read on public.era_outcomes for select to anon using (exists (select 1 from public.era_templates e where e.id=era_id and e.status='published'));

-- Only allowlisted, verified accounts gain editor access. Normal game accounts remain read-only.
grant select, insert, update, delete on public.era_templates, public.era_objectives, public.era_outcomes to authenticated;
create policy era_templates_admin_read on public.era_templates for select to authenticated using (status='published' or (select jianghu_private.is_era_admin()));
create policy era_templates_admin_insert on public.era_templates for insert to authenticated with check ((select jianghu_private.is_era_admin()));
create policy era_templates_admin_update on public.era_templates for update to authenticated using ((select jianghu_private.is_era_admin())) with check ((select jianghu_private.is_era_admin()));
create policy era_templates_admin_delete on public.era_templates for delete to authenticated using ((select jianghu_private.is_era_admin()));
create policy era_objectives_admin_read on public.era_objectives for select to authenticated using (exists (select 1 from public.era_templates e where e.id=era_id and e.status='published') or (select jianghu_private.is_era_admin()));
create policy era_objectives_admin_insert on public.era_objectives for insert to authenticated with check ((select jianghu_private.is_era_admin()));
create policy era_objectives_admin_update on public.era_objectives for update to authenticated using ((select jianghu_private.is_era_admin())) with check ((select jianghu_private.is_era_admin()));
create policy era_objectives_admin_delete on public.era_objectives for delete to authenticated using ((select jianghu_private.is_era_admin()));
create policy era_outcomes_admin_read on public.era_outcomes for select to authenticated using (exists (select 1 from public.era_templates e where e.id=era_id and e.status='published') or (select jianghu_private.is_era_admin()));
create policy era_outcomes_admin_insert on public.era_outcomes for insert to authenticated with check ((select jianghu_private.is_era_admin()));
create policy era_outcomes_admin_update on public.era_outcomes for update to authenticated using ((select jianghu_private.is_era_admin())) with check ((select jianghu_private.is_era_admin()));
create policy era_outcomes_admin_delete on public.era_outcomes for delete to authenticated using ((select jianghu_private.is_era_admin()));
grant execute on function jianghu_private.validate_era_catalog(text), jianghu_private.check_era_catalog_change(), jianghu_private.era_catalog_touch_updated_at() to authenticated;

-- Child edits made in the dashboard also invalidate an open editor's revision.
create function jianghu_private.touch_era_revision() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_op in ('UPDATE','DELETE') then update public.era_templates set updated_at=now() where id=old.era_id; end if;
  if tg_op in ('INSERT','UPDATE') then update public.era_templates set updated_at=now() where id=new.era_id; end if;
  return null;
end;
$$;
revoke all on function jianghu_private.touch_era_revision() from public, anon;
grant execute on function jianghu_private.touch_era_revision() to authenticated;
create trigger era_objectives_revision after insert or update or delete on public.era_objectives for each row execute function jianghu_private.touch_era_revision();
create trigger era_outcomes_revision after insert or update or delete on public.era_outcomes for each row execute function jianghu_private.touch_era_revision();

create function public.era_editor_catalog(era_key text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog as $$
declare result jsonb;
begin
  if not jianghu_private.is_era_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  select jsonb_build_object(
    'era',to_jsonb(e),
    'objectives',coalesce((select jsonb_agg(to_jsonb(o) order by sort_order,id) from public.era_objectives o where o.era_id=e.id),'[]'::jsonb),
    'outcomes',coalesce((select jsonb_agg(to_jsonb(o) order by min_score,id) from public.era_outcomes o where o.era_id=e.id),'[]'::jsonb)
  ) into result from public.era_templates e where e.id=era_key;
  if result is null then raise exception '시대 데이터를 찾을 수 없습니다.'; end if;
  return result;
end;
$$;
revoke all on function public.era_editor_catalog(text) from public, anon;
grant execute on function public.era_editor_catalog(text) to authenticated;

create function public.save_era_editor_catalog(era_key text, expected_updated_at timestamptz, document jsonb, publish boolean default false) returns jsonb
language plpgsql security invoker set search_path = pg_catalog as $$
declare current_revision timestamptz;
begin
  if not jianghu_private.is_era_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if jsonb_typeof(document->'objectives') is distinct from 'array' or jsonb_typeof(document->'outcomes') is distinct from 'array' then raise exception '과제와 결과 목록이 필요합니다.'; end if;
  if jsonb_array_length(document->'objectives') > 50 or jsonb_array_length(document->'outcomes') > 20 or octet_length(document::text) > 262144 then raise exception '편집 가능한 데이터 크기를 초과했습니다.'; end if;
  select updated_at into current_revision from public.era_templates where id=era_key for update;
  if not found then raise exception '시대 데이터를 찾을 수 없습니다.'; end if;
  if expected_updated_at is null or current_revision <> expected_updated_at then raise exception '다른 곳에서 수정된 데이터가 있습니다. 다시 불러온 뒤 저장해주세요.' using errcode='40001'; end if;
  update public.era_templates set name=document->'era'->>'name', description=coalesce(document->'era'->>'description',''), duration_years=(document->'era'->>'duration_years')::int, version=(document->'era'->>'version')::int, status='draft' where id=era_key;
  delete from public.era_outcomes where era_id=era_key;
  delete from public.era_objectives where era_id=era_key;
  insert into public.era_objectives (era_id,id,name,description,category,condition_code,target_key,points,sort_order)
  select era_key,x.id,x.name,coalesce(x.description,''),x.category,x.condition_code,x.target_key,x.points,x.sort_order
  from jsonb_to_recordset(document->'objectives') as x(id text,name text,description text,category text,condition_code text,target_key text,points int,sort_order int);
  insert into public.era_outcomes (era_id,id,name,min_score,max_score,required_objective_ids,world_result,fame_reward,contribution_reward,legacy_reward_code)
  select era_key,x.id,x.name,x.min_score,x.max_score,coalesce(x.required_objective_ids,'{}'),x.world_result,x.fame_reward,x.contribution_reward,x.legacy_reward_code
  from jsonb_to_recordset(document->'outcomes') as x(id text,name text,min_score int,max_score int,required_objective_ids text[],world_result text,fame_reward int,contribution_reward int,legacy_reward_code text);
  update public.era_templates set status=case when publish then 'published' else 'draft' end where id=era_key;
  if publish then perform jianghu_private.validate_era_catalog(era_key); end if;
  return public.era_editor_catalog(era_key);
end;
$$;
revoke all on function public.save_era_editor_catalog(text,timestamptz,jsonb,boolean) from public, anon;
grant execute on function public.save_era_editor_catalog(text,timestamptz,jsonb,boolean) to authenticated;

comment on function public.save_era_editor_catalog(text,timestamptz,jsonb,boolean) is '확인된 관리자만 시대·과제·보상을 원자적으로 저장합니다. 버전 충돌 시 덮어쓰지 않습니다.';
commit;
