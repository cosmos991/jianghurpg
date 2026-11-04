begin;
-- A single read statement gives one consistent, public-only configuration snapshot.
-- RLS applies even when called by an editor: drafts are explicitly excluded.
create function public.era_public_catalog(era_key text default null) returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object(
  'era',to_jsonb(e),
  'objectives',coalesce((select jsonb_agg(to_jsonb(o) order by sort_order,id) from public.era_objectives o where o.era_id=e.id),'[]'::jsonb),
  'outcomes',coalesce((select jsonb_agg(to_jsonb(o) order by min_score,id) from public.era_outcomes o where o.era_id=e.id),'[]'::jsonb)
 ) from public.era_templates e
 where e.status='published' and (era_key is null or e.id=era_key)
 order by e.updated_at desc,e.id limit 1;
$$;
revoke all on function public.era_public_catalog(text) from public;
grant execute on function public.era_public_catalog(text) to anon, authenticated;
comment on function public.era_public_catalog(text) is '공개된 시대와 과제·결과를 일관된 스냅샷으로 읽습니다. 초안은 반환하지 않습니다.';
commit;
