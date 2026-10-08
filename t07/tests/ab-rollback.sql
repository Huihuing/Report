-- T07 계정 A/B 데이터 격리 재현 검사.
-- 기존 인증된 auth.users 중 두 계정을 임시 소유자로 선택하되 개인정보는 출력하지 않습니다.
-- 모든 테스트 계획/할 일은 ROLLBACK 처리; 실사용 데이터 영구 변경 금지.
-- 이 파일은 PostgreSQL owner 필터, FK와 직접 접근 권한을 검증합니다.
-- HTTP 세션·401/404 응답 검사는 별도이며 이 파일만으로 증명되지 않습니다.
BEGIN;

CREATE TEMP TABLE t07_ab_results(
 check_name text,
 passed boolean,
 details text
) ON COMMIT DROP;

DO $$
DECLARE
 a uuid; b uuid; pa uuid; pb uuid; ta uuid; tb uuid; n integer;
 blocked boolean := false;
BEGIN
 SELECT id INTO a FROM auth.users ORDER BY created_at,id LIMIT 1;
 SELECT id INTO b FROM auth.users ORDER BY created_at,id OFFSET 1 LIMIT 1;
 IF a IS NULL OR b IS NULL OR a=b THEN RAISE EXCEPTION 'TWO_TEST_USERS_REQUIRED'; END IF;

 INSERT INTO public.t07_plans(owner_id,title,start_date,end_date,priority,success_criteria,expected_minutes)
 VALUES(a,'T07_ISOLATION_TEST_A','2026-10-08','2026-10-08','high','rollback only',0) RETURNING id INTO pa;
 INSERT INTO public.t07_plans(owner_id,title,start_date,end_date,priority,success_criteria,expected_minutes)
 VALUES(b,'T07_ISOLATION_TEST_B','2026-10-08','2026-10-08','high','rollback only',0) RETURNING id INTO pb;

 INSERT INTO public.t07_tasks(owner_id,plan_id,title,due_date,priority)
 VALUES(a,pa,'T07_ISOLATION_TASK_A','2026-10-08','high') RETURNING id INTO ta;
 INSERT INTO public.t07_tasks(owner_id,plan_id,title,due_date,priority)
 VALUES(b,pb,'T07_ISOLATION_TASK_B','2026-10-08','high') RETURNING id INTO tb;

 SELECT count(*) INTO n FROM public.t07_plans WHERE owner_id=a AND id=pb;
 INSERT INTO t07_ab_results VALUES('A reads B plan',n=0,'0 visible rows');
 SELECT count(*) INTO n FROM public.t07_plans WHERE owner_id=b AND id=pa;
 INSERT INTO t07_ab_results VALUES('B reads A plan',n=0,'0 visible rows');
 SELECT count(*) INTO n FROM public.t07_tasks WHERE owner_id=a AND id=tb;
 INSERT INTO t07_ab_results VALUES('A reads B task',n=0,'0 visible rows');
 SELECT count(*) INTO n FROM public.t07_tasks WHERE owner_id=b AND id=ta;
 INSERT INTO t07_ab_results VALUES('B reads A task',n=0,'0 visible rows');

 UPDATE public.t07_tasks SET title='WRONG_A_UPDATE' WHERE owner_id=a AND id=tb;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO t07_ab_results VALUES('A updates B task',n=0,'0 rows updated');
 UPDATE public.t07_tasks SET title='WRONG_B_UPDATE' WHERE owner_id=b AND id=ta;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO t07_ab_results VALUES('B updates A task',n=0,'0 rows updated');

 DELETE FROM public.t07_tasks WHERE owner_id=a AND id=tb;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO t07_ab_results VALUES('A deletes B task',n=0,'0 rows deleted');
 DELETE FROM public.t07_tasks WHERE owner_id=b AND id=ta;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO t07_ab_results VALUES('B deletes A task',n=0,'0 rows deleted');

 SELECT count(*) INTO n FROM public.t07_tasks WHERE owner_id=a AND id=ta;
 INSERT INTO t07_ab_results VALUES('A row unchanged',n=1,'source row preserved');
 SELECT count(*) INTO n FROM public.t07_tasks WHERE owner_id=b AND id=tb;
 INSERT INTO t07_ab_results VALUES('B row unchanged',n=1,'source row preserved');

 BEGIN
   INSERT INTO public.t07_tasks(owner_id,plan_id,title,due_date,priority)
   VALUES(b,pa,'WRONG_PLAN_REFERENCE','2026-10-08','medium');
 EXCEPTION WHEN foreign_key_violation THEN blocked := true;
 END;
 INSERT INTO t07_ab_results VALUES('B cannot reference A plan',blocked,'owner_id + plan_id composite FK');
 INSERT INTO t07_ab_results
 SELECT 'anon cannot select private plans',NOT has_table_privilege('anon','public.t07_plans','select'),'direct SELECT revoked';
 INSERT INTO t07_ab_results
 SELECT 'authenticated cannot select private tasks',NOT has_table_privilege('authenticated','public.t07_tasks','select'),'direct SELECT revoked';

 IF EXISTS (SELECT 1 FROM t07_ab_results WHERE NOT passed)
 THEN RAISE EXCEPTION 'AB_ISOLATION_TEST_FAILED'; END IF;
END $$;

SELECT check_name,passed,details FROM t07_ab_results ORDER BY check_name;
ROLLBACK;
