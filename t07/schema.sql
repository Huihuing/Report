-- T07 schema reconstruction. Requires Supabase Auth and existing T06 database objects.
-- Secret keys and one-time migration code intentionally excluded.
create table if not exists public.t07_plans(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 160),
 start_date date not null,end_date date not null,priority text not null check(priority in ('high','medium','low')),
 success_criteria text not null,expected_minutes integer not null default 0 check(expected_minutes>=0),
 next_from_reflection text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,owner_id),check(end_date>=start_date)
);
create table if not exists public.t07_plan_revisions(
 id bigint generated always as identity primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null,revision_no integer not null,snapshot jsonb not null,changed_at timestamptz not null default now(),
 unique(plan_id,revision_no),foreign key(plan_id,owner_id) references public.t07_plans(id,owner_id) on delete cascade
);
create table if not exists public.t07_tasks(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null,title text not null check(length(title) between 1 and 240),due_date date not null,
 priority text not null check(priority in ('high','medium','low')),
 tags text[] not null default '{}',expected_minutes integer not null default 0 check(expected_minutes>=0),
 completed boolean not null default false,completed_at timestamptz,completion_cycle integer not null default 0,
 deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,owner_id),foreign key(plan_id,owner_id) references public.t07_plans(id,owner_id) on delete cascade
);
create table if not exists public.t07_completion_events(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,cycle_no integer not null,completed_at timestamptz not null default now(),
 unique(task_id,cycle_no),foreign key(task_id,owner_id) references public.t07_tasks(id,owner_id) on delete cascade
);
create table if not exists public.t07_execution_logs(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,started_at timestamptz not null,ended_at timestamptz not null,
 actual_minutes integer not null check(actual_minutes>=0),blocker_reason text not null default '',
 created_at timestamptz not null default now(),check(ended_at>=started_at),
 foreign key(task_id,owner_id) references public.t07_tasks(id,owner_id) on delete cascade
);
create table if not exists public.t07_reflections(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null,improvement_note text not null,next_plan_id uuid,
 created_at timestamptz not null default now(),
 foreign key(plan_id,owner_id) references public.t07_plans(id,owner_id) on delete cascade,
 foreign key(next_plan_id,owner_id) references public.t07_plans(id,owner_id)
);
create table if not exists public.t07_sessions(
 token_hash text primary key,user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,created_at timestamptz not null default now()
);
create table if not exists public.t07_day_entries(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 day_date date not null,metric_minutes integer check(metric_minutes>=0),note text not null default '',
 rule_version integer not null check(rule_version in(1,2)),
 created_at timestamptz not null default now(),unique(owner_id,day_date)
);
create table if not exists public.t07_rule_settings(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 question text not null,metric_name text not null,unit text not null default '분',
 computation_rule text not null,missing_rule text not null,duplicate_rule text not null,
 outlier_rule text not null,rounding_rule text not null,week_starts_on text not null default 'Monday',
 initial_rule text not null,changed_rule text,changed_at timestamptz,changed_reason text,
 day1_date date,day2_date date,created_at timestamptz not null default now()
);
create table if not exists public.t07_legacy_bundle(
 id integer primary key default 1 check(id=1),
 payload jsonb not null,claim_hash text not null,
 claimed_by uuid references auth.users(id) on delete set null,claimed_at timestamptz
);
create index if not exists t07_sessions_user_idx on public.t07_sessions(user_id);
create index if not exists t07_plans_owner_idx on public.t07_plans(owner_id);
create index if not exists t07_tasks_owner_plan_idx on public.t07_tasks(owner_id,plan_id,deleted_at);
create index if not exists t07_executions_owner_idx on public.t07_execution_logs(owner_id,task_id);
create index if not exists t07_days_owner_day_idx on public.t07_day_entries(owner_id,day_date);
do $$ declare t text; begin
 foreach t in array array[
  't07_plans','t07_plan_revisions','t07_tasks','t07_completion_events',
  't07_execution_logs','t07_reflections','t07_sessions','t07_day_entries',
  't07_rule_settings','t07_legacy_bundle'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.t07_plan_revisions_id_seq to service_role;

-- Functions below are captured from PostgreSQL pg_get_functiondef in the running project.
-- The one-time migration code and private source bundle data are not embedded in this file.

CREATE OR REPLACE FUNCTION public.t07_update_plan(p_owner uuid, p_id uuid, p_title text, p_start date, p_end date, p_priority text, p_criteria text, p_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare old_row public.t07_plans; next_no int; result public.t07_plans;
begin
 select * into old_row from public.t07_plans where id=p_id and owner_id=p_owner for update;
 if old_row.id is null then raise exception 'NOT_FOUND';end if;
 select coalesce(max(revision_no),0)+1 into next_no from public.t07_plan_revisions where plan_id=p_id and owner_id=p_owner;
 insert into public.t07_plan_revisions(owner_id,plan_id,revision_no,snapshot) values (p_owner,p_id,next_no,to_jsonb(old_row));
 update public.t07_plans set title=p_title,start_date=p_start,end_date=p_end,priority=p_priority,success_criteria=p_criteria,expected_minutes=p_minutes,updated_at=now()
 where id=p_id and owner_id=p_owner returning * into result;
 return to_jsonb(result);
end $function$
;

CREATE OR REPLACE FUNCTION public.t07_set_completed(p_owner uuid, p_id uuid, p_completed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare row_data public.t07_tasks; n int;
begin
 select * into row_data from public.t07_tasks where id=p_id and owner_id=p_owner and deleted_at is null for update;
 if row_data.id is null then raise exception 'NOT_FOUND';end if;
 if p_completed and not row_data.completed then
  update public.t07_tasks set completed=true,completed_at=now(),completion_cycle=completion_cycle+1,updated_at=now()
  where id=p_id and owner_id=p_owner returning * into row_data;
  insert into public.t07_completion_events(owner_id,task_id,cycle_no,completed_at)
  values (p_owner,p_id,row_data.completion_cycle,row_data.completed_at) on conflict(task_id,cycle_no) do nothing;
 elsif not p_completed and row_data.completed then
  update public.t07_tasks set completed=false,completed_at=null,updated_at=now()
  where id=p_id and owner_id=p_owner returning * into row_data;
 end if;
 select count(*) into n from public.t07_completion_events where task_id=p_id and owner_id=p_owner;
 return jsonb_build_object('task',to_jsonb(row_data),'completion_event_count',n);
end $function$
;

CREATE OR REPLACE FUNCTION public.t07_claim_legacy(p_code text, p_owner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare b public.t07_legacy_bundle; nplans integer; ntasks integer; nexecutions integer;
begin
  select * into b from public.t07_legacy_bundle where id=1 for update;
  if b.id is null or b.claimed_at is not null or b.claim_hash <> encode(extensions.digest(p_code,'sha256'),'hex') then
    raise exception 'INVALID_OR_USED_MIGRATION_CODE';
  end if;
  if not exists(select 1 from auth.users where id=p_owner) then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.t07_plans(id,owner_id,title,start_date,end_date,priority,success_criteria,expected_minutes,next_from_reflection,created_at,updated_at)
  select x.id,p_owner,x.title,x.start_date,x.end_date,x.priority,x.success_criteria,x.expected_minutes,x.next_from_reflection,x.created_at,x.updated_at
  from jsonb_to_recordset(b.payload->'plans') as x(id uuid,title text,start_date date,end_date date,priority text,success_criteria text,expected_minutes int,next_from_reflection text,created_at timestamptz,updated_at timestamptz);
  get diagnostics nplans=row_count;
  insert into public.t07_tasks(id,owner_id,plan_id,title,due_date,priority,tags,expected_minutes,completed,completed_at,completion_cycle,deleted_at,created_at,updated_at)
  select x.id,p_owner,x.plan_id,x.title,x.due_date,x.priority,x.tags,x.expected_minutes,x.completed,x.completed_at,x.completion_cycle,x.deleted_at,x.created_at,x.updated_at
  from jsonb_to_recordset(b.payload->'tasks') as x(id uuid,plan_id uuid,title text,due_date date,priority text,tags text[],expected_minutes int,completed boolean,completed_at timestamptz,completion_cycle int,deleted_at timestamptz,created_at timestamptz,updated_at timestamptz);
  get diagnostics ntasks=row_count;
  insert into public.t07_execution_logs(id,owner_id,task_id,started_at,ended_at,actual_minutes,blocker_reason,created_at)
  select x.id,p_owner,x.task_id,x.started_at,x.ended_at,x.actual_minutes,x.blocker_reason,x.created_at
  from jsonb_to_recordset(b.payload->'executions') as x(id uuid,task_id uuid,started_at timestamptz,ended_at timestamptz,actual_minutes int,blocker_reason text,created_at timestamptz);
  get diagnostics nexecutions=row_count;
  insert into public.t07_completion_events(id,owner_id,task_id,cycle_no,completed_at)
  select x.id,p_owner,x.task_id,x.cycle_no,x.completed_at
  from jsonb_to_recordset(b.payload->'completions') as x(id uuid,task_id uuid,cycle_no int,completed_at timestamptz);
  insert into public.t07_plan_revisions(owner_id,plan_id,revision_no,snapshot,changed_at)
  select p_owner,x.plan_id,x.revision_no,x.snapshot,x.changed_at
  from jsonb_to_recordset(b.payload->'revisions') as x(plan_id uuid,revision_no int,snapshot jsonb,changed_at timestamptz);
  insert into public.t07_reflections(id,owner_id,plan_id,improvement_note,next_plan_id,created_at)
  select x.id,p_owner,x.plan_id,x.improvement_note,x.next_plan_id,x.created_at
  from jsonb_to_recordset(b.payload->'reflections') as x(id uuid,plan_id uuid,improvement_note text,next_plan_id uuid,created_at timestamptz);
  insert into public.t07_rule_settings(owner_id,question,metric_name,unit,computation_rule,missing_rule,duplicate_rule,outlier_rule,rounding_rule,week_starts_on,initial_rule,day1_date)
  values(p_owner,
    '하루 계획한 과제 작업에 실제 얼마나 많은 시간이 걸렸는가?',
    'Git 기록 또는 직접 측정한 과제 진행 시간','분',
    '해당 날짜에 실제 확인 가능한 과제 진행 구간의 분 합계. 여러 구간은 겹침 없이 합산.',
    '측정값이 없으면 null로 보관하여 합계·평균에서 제외',
    'Asia/Seoul 날짜당 한 건만 허용하고 수정 시 기존 행을 갱신',
    '값이 유난히 커도 삭제하지 않고 근거와 사유를 note에 기록',
    '각 구간 분은 가장 가까운 정수 분으로 반올림, 합계는 정수 합',
    'Monday',
    '과제마다 통과 기준을 확인한 다음 작업을 시작한다.',
    '2026-10-08'
  )
  on conflict(owner_id) do nothing;
  insert into public.t07_day_entries(owner_id,day_date,metric_minutes,note,rule_version)
  values(p_owner,'2026-10-08',106,
  'T06에서 실제 Git 커밋으로 확인한 과제 4·5·6 구간 합계 106분. 개인 집중시간 전체가 아닌 커밋 근거 구간의 근사값.',
  1)
  on conflict(owner_id,day_date) do nothing;
  delete from public.t06_plans where id in (select oldplan.id from jsonb_to_recordset(b.payload->'plans') as oldplan(id uuid));
     update public.t07_legacy_bundle
     set claimed_by=p_owner,claimed_at=now(),payload='{}'::jsonb,claim_hash='claimed'
     where id=1;
  return jsonb_build_object('plans',nplans,'tasks',ntasks,'executions',nexecutions,'day1',true);
end $function$
;

-- Execute these routines only from the server's privileged Edge Function.
revoke all on function public.t07_update_plan(uuid,uuid,text,date,date,text,text,integer) from public,anon,authenticated;
revoke all on function public.t07_set_completed(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.t07_claim_legacy(text,uuid) from public,anon,authenticated;
grant execute on function public.t07_update_plan(uuid,uuid,text,date,date,text,text,integer) to service_role;
grant execute on function public.t07_set_completed(uuid,uuid,boolean) to service_role;
grant execute on function public.t07_claim_legacy(text,uuid) to service_role;
