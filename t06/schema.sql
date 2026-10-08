-- T06 Plan → Do → See schema
-- Production database: PostgreSQL (Supabase)
-- Public browser clients never connect to these tables directly.

create table if not exists public.t06_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  start_date date not null,
  end_date date not null,
  priority text not null check (priority in ('high','medium','low')),
  success_criteria text not null check (char_length(success_criteria) between 1 and 1000),
  expected_minutes integer not null default 0 check (expected_minutes >= 0),
  next_from_reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.t06_plan_revisions (
  id bigint generated always as identity primary key,
  plan_id uuid not null references public.t06_plans(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  snapshot jsonb not null,
  changed_at timestamptz not null default now(),
  unique (plan_id, revision_no)
);

create table if not exists public.t06_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.t06_plans(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  due_date date not null,
  priority text not null check (priority in ('high','medium','low')),
  tags text[] not null default '{}',
  expected_minutes integer not null default 0 check (expected_minutes >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  completion_cycle integer not null default 0 check (completion_cycle >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.t06_completion_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t06_tasks(id) on delete cascade,
  cycle_no integer not null check (cycle_no > 0),
  completed_at timestamptz not null default now(),
  unique (task_id, cycle_no)
);

create table if not exists public.t06_execution_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t06_tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  actual_minutes integer not null check (actual_minutes >= 0),
  blocker_reason text not null default '',
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

create table if not exists public.t06_reflections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.t06_plans(id) on delete cascade,
  improvement_note text not null check (char_length(improvement_note) between 1 and 1000),
  next_plan_id uuid references public.t06_plans(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists t06_tasks_plan_due_idx on public.t06_tasks(plan_id, due_date, id);
create index if not exists t06_tasks_plan_status_idx on public.t06_tasks(plan_id, completed, deleted_at);
create index if not exists t06_execution_task_idx on public.t06_execution_logs(task_id, started_at);
create index if not exists t06_revision_plan_idx on public.t06_plan_revisions(plan_id, revision_no);

alter table public.t06_plans enable row level security;
alter table public.t06_plan_revisions enable row level security;
alter table public.t06_tasks enable row level security;
alter table public.t06_completion_events enable row level security;
alter table public.t06_execution_logs enable row level security;
alter table public.t06_reflections enable row level security;

revoke all on table public.t06_plans from anon, authenticated;
revoke all on table public.t06_plan_revisions from anon, authenticated;
revoke all on table public.t06_tasks from anon, authenticated;
revoke all on table public.t06_completion_events from anon, authenticated;
revoke all on table public.t06_execution_logs from anon, authenticated;
revoke all on table public.t06_reflections from anon, authenticated;

grant select, insert, update, delete on table public.t06_plans to service_role;
grant select, insert, update, delete on table public.t06_plan_revisions to service_role;
grant select, insert, update, delete on table public.t06_tasks to service_role;
grant select, insert, update, delete on table public.t06_completion_events to service_role;
grant select, insert, update, delete on table public.t06_execution_logs to service_role;
grant select, insert, update, delete on table public.t06_reflections to service_role;
grant usage, select on sequence public.t06_plan_revisions_id_seq to service_role;

create or replace function public.t06_update_plan(
  p_id uuid,
  p_title text,
  p_start_date date,
  p_end_date date,
  p_priority text,
  p_success_criteria text,
  p_expected_minutes integer,
  p_next_from_reflection text default null
) returns public.t06_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_row public.t06_plans;
  new_row public.t06_plans;
  next_revision integer;
begin
  select * into old_row from public.t06_plans where id = p_id for update;
  if old_row.id is null then raise exception 'PLAN_NOT_FOUND'; end if;

  select coalesce(max(revision_no), 0) + 1 into next_revision
  from public.t06_plan_revisions where plan_id = p_id;

  insert into public.t06_plan_revisions(plan_id, revision_no, snapshot)
  values (p_id, next_revision, to_jsonb(old_row));

  update public.t06_plans
  set title = p_title,
      start_date = p_start_date,
      end_date = p_end_date,
      priority = p_priority,
      success_criteria = p_success_criteria,
      expected_minutes = p_expected_minutes,
      next_from_reflection = p_next_from_reflection,
      updated_at = now()
  where id = p_id
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function public.t06_set_task_completed(
  p_task_id uuid,
  p_completed boolean
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  task_row public.t06_tasks;
  event_count integer;
begin
  select * into task_row
  from public.t06_tasks
  where id = p_task_id and deleted_at is null
  for update;

  if task_row.id is null then raise exception 'TASK_NOT_FOUND'; end if;

  if p_completed and not task_row.completed then
    update public.t06_tasks
    set completed = true,
        completed_at = now(),
        completion_cycle = completion_cycle + 1,
        updated_at = now()
    where id = p_task_id
    returning * into task_row;

    insert into public.t06_completion_events(task_id, cycle_no, completed_at)
    values (task_row.id, task_row.completion_cycle, task_row.completed_at)
    on conflict (task_id, cycle_no) do nothing;
  elsif (not p_completed) and task_row.completed then
    update public.t06_tasks
    set completed = false,
        completed_at = null,
        updated_at = now()
    where id = p_task_id
    returning * into task_row;
  end if;

  select count(*)::integer into event_count
  from public.t06_completion_events
  where task_id = p_task_id;

  return jsonb_build_object(
    'task', to_jsonb(task_row),
    'completion_event_count', event_count
  );
end;
$$;

revoke all on function public.t06_update_plan(uuid,text,date,date,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.t06_set_task_completed(uuid,boolean) from public, anon, authenticated;
grant execute on function public.t06_update_plan(uuid,text,date,date,text,text,integer,text) to service_role;
grant execute on function public.t06_set_task_completed(uuid,boolean) to service_role;
