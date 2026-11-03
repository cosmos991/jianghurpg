-- Initial editable draft. Existing content is never overwritten on repeat runs.
begin;
insert into public.era_templates (id,name,description,duration_years,version,status)
values ('demonic_rise_v1','마교의 준동','마교의 세력 확장을 막고, 정파 내부의 갈등 속에서 사람들과 지역을 지키는 시대.',20,1,'draft')
on conflict (id) do nothing;
insert into public.era_objectives (era_id,id,name,category,condition_code,target_key,points,sort_order) values
('demonic_rise_v1','clue_01','첫 번째 단서 확보','investigation','CLUE_FOUND','clue_01',5,1),
('demonic_rise_v1','clue_02','두 번째 단서 확보','investigation','CLUE_FOUND','clue_02',5,2),
('demonic_rise_v1','clue_03','세 번째 단서 확보','investigation','CLUE_FOUND','clue_03',5,3),
('demonic_rise_v1','expose_network','잠입 조직의 정체 확인','investigation','INFILTRATORS_EXPOSED','infiltration_network',5,4),
('demonic_rise_v1','protect_01','첫 번째 피해 지역 보호','protection','DEFENSE_SUCCESS','region_01',10,5),
('demonic_rise_v1','protect_02','두 번째 피해 지역 보호','protection','DEFENSE_SUCCESS','region_02',10,6),
('demonic_rise_v1','ally_01','첫 번째 문파의 협력 확보','cooperation','ALLIANCE_SECURED','ally_01',10,7),
('demonic_rise_v1','ally_02','두 번째 문파의 협력 확보','cooperation','ALLIANCE_SECURED','ally_02',10,8),
('demonic_rise_v1','supply_stop','보급 거점 무력화','operation','SUPPLY_BASE_STOPPED','supply_base',15,9),
('demonic_rise_v1','ritual_stop','핵심 의식 중단','operation','RITUAL_STOPPED','core_ritual',25,10)
on conflict (era_id,id) do nothing;
insert into public.era_outcomes (era_id,id,name,min_score,max_score,required_objective_ids,world_result,fame_reward,contribution_reward,legacy_reward_code) values
('demonic_rise_v1','failure','준동 저지 실패',0,24,'{}','마교의 영향력이 크게 확장되었습니다. 완료한 임무와 선택은 개인 기록으로 남습니다.',0,0,'NONE'),
('demonic_rise_v1','defense','일부 지역 방어',25,49,'{}','일부 지역을 지켰지만 마교의 확산을 막지는 못했습니다.',10,20,'NONE'),
('demonic_rise_v1','containment','핵심 확산 저지',50,74,'{}','핵심 확산을 억제했지만 잔존 세력과 피해는 남았습니다.',25,50,'NONE'),
('demonic_rise_v1','victory','주요 세력 격퇴',75,89,'{}','마교의 주요 세력을 격퇴하고 지역의 안정을 되찾았습니다.',40,80,'SECT_LEGACY_CHOICE'),
('demonic_rise_v1','decisive','지도부 계획 와해',90,100,'{ritual_stop}','핵심 의식을 중단하고 지도부의 계획을 무너뜨렸습니다.',60,120,'SPECIAL_LEGACY_CHOICE')
on conflict (era_id,id) do nothing;
commit;
-- After reviewing all three tables, publish with:
-- update public.era_templates set status = 'published' where id = 'demonic_rise_v1';
