-- T08 passwordless WebAuthn schema (PostgreSQL / Supabase)
-- Execute with privileged migration role. NEVER grant public Data API access.
create table if not exists public.t08_accounts (
 id uuid primary key,
 created_at timestamptz not null default now()
);
create table if not exists public.t08_credentials (
 id text primary key,
 owner_id uuid not null references public.t08_accounts(id) on delete cascade,
 public_key_b64 text not null,
 counter bigint not null default 0 check(counter>=0),
 transports text[] not null default '{}'::text[],
 device_type text not null default 'unknown',
 backed_up boolean not null default false,
 label text not null check(length(label) between 1 and 60),
 created_at timestamptz not null default now(),
 last_used_at timestamptz
);
create index if not exists t08_credentials_owner_idx on public.t08_credentials(owner_id);
create table if not exists public.t08_challenges (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('register_new','register_add','login')),
 challenge text not null,
 proposed_account uuid,
 owner_id uuid references public.t08_accounts(id) on delete cascade,
 expires_at timestamptz not null default(now()+interval '5 minutes'),
 consumed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint t08_challenge_kind check (
  (kind='register_new' and proposed_account is not null and owner_id is null) or
  (kind='register_add' and owner_id is not null and proposed_account is null) or
  (kind='login' and owner_id is null and proposed_account is null)
 )
);
create index if not exists t08_challenge_expiry_idx on public.t08_challenges(expires_at);
create table if not exists public.t08_sessions (
 token_hash text primary key,
 owner_id uuid not null references public.t08_accounts(id) on delete cascade,
 expires_at timestamptz not null default(now()+interval '60 minutes'),
 created_at timestamptz not null default now()
);
create index if not exists t08_sessions_owner_idx on public.t08_sessions(owner_id);
create table if not exists public.t08_private_notes (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.t08_accounts(id) on delete cascade,
 title text not null,
 body text not null,
 position smallint not null check(position between 1 and 3),
 created_at timestamptz not null default now(),
 unique(owner_id,position)
);
create index if not exists t08_notes_owner_idx on public.t08_private_notes(owner_id);

alter table public.t08_accounts enable row level security;
alter table public.t08_credentials enable row level security;
alter table public.t08_challenges enable row level security;
alter table public.t08_sessions enable row level security;
alter table public.t08_private_notes enable row level security;
revoke all on public.t08_accounts, public.t08_credentials, public.t08_challenges, public.t08_sessions, public.t08_private_notes from public,anon,authenticated;

-- Service-role-only, atomic one-time challenge consumption. Null means expired/used/missing.
create or replace function public.t08_take_challenge(p_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data public.t08_challenges%rowtype;
begin
 update public.t08_challenges set consumed_at=now()
 where id=p_id and kind=p_kind and consumed_at is null and expires_at>now()
 returning * into row_data;
 if not found then return null; end if;
 return jsonb_build_object('challenge',row_data.challenge,'owner_id',row_data.owner_id,'proposed_account',row_data.proposed_account);
end $$;
revoke all on function public.t08_take_challenge(uuid,text) from public,anon,authenticated;
grant execute on function public.t08_take_challenge(uuid,text) to service_role;

-- All-or-nothing initial account, authenticator public key and 3 fabricated notes.
create or replace function public.t08_initialize_account(
 p_owner uuid,p_credential_id text,p_public_key text,p_counter bigint,
 p_transports text[],p_device_type text,p_backed_up boolean,p_label text
) returns uuid language plpgsql security definer set search_path='' as $$
begin
 insert into public.t08_accounts(id) values(p_owner);
 insert into public.t08_credentials(id,owner_id,public_key_b64,counter,transports,device_type,backed_up,label)
 values(p_credential_id,p_owner,p_public_key,p_counter,p_transports,p_device_type,p_backed_up,p_label);
 insert into public.t08_private_notes(owner_id,title,body,position) values
 (p_owner,'프로젝트 메모 · 샘플','가상의 레거시 호환성 검토 메모 / 테스트 공간 '||left(p_owner::text,8),1),
 (p_owner,'지원 준비 목록 · 샘플','가상의 지원 일정 목록 / 회사명과 연락처는 저장하지 않음',2),
 (p_owner,'학습 회고 · 샘플','가상의 개발 복습 항목 / 실제 개인 기록이 아닌 과제용 데이터',3);
 return p_owner;
end $$;
revoke all on function public.t08_initialize_account(uuid,text,text,bigint,text[],text,boolean,text) from public,anon,authenticated;
grant execute on function public.t08_initialize_account(uuid,text,text,bigint,text[],text,boolean,text) to service_role;

-- Lock the owner row before checking remaining credential count.
create or replace function public.t08_remove_credential(p_owner uuid,p_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare amount integer;
begin
 perform 1 from public.t08_accounts where id=p_owner for update;
 select count(*) into amount from public.t08_credentials where owner_id=p_owner;
 if amount<=1 then return false; end if;
 delete from public.t08_credentials where id=p_id and owner_id=p_owner;
 return found;
end $$;
revoke all on function public.t08_remove_credential(uuid,text) from public,anon,authenticated;
grant execute on function public.t08_remove_credential(uuid,text) to service_role;