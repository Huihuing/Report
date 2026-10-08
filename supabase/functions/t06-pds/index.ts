import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
const serverSecret = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  serverSecret,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: H });

const clean = (v: unknown, max = 1000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const toInt = (v: unknown, min = 0, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : min;
};

const toPriority = (v: unknown) =>
  ["high", "medium", "low"].includes(String(v)) ? String(v) : "medium";

const toTags = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => clean(x, 30)).filter(Boolean).slice(0, 10) : [];

const dateOnly = (v: unknown) => {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("INVALID_DATE");
  return s;
};

const iso = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_TIME");
  return d.toISOString();
};

function kstToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}

async function getState(requestedPlanId?: string | null) {
  const p = await db.from("t06_plans").select("*").order("created_at");
  if (p.error) throw p.error;
  const plans = p.data ?? [];
  const planId = requestedPlanId && plans.some((x) => x.id === requestedPlanId)
    ? requestedPlanId
    : plans[0]?.id ?? null;

  const revisions = planId
    ? await db.from("t06_plan_revisions").select("*").eq("plan_id", planId).order("revision_no")
    : { data: [], error: null };
  if (revisions.error) throw revisions.error;

  const taskResult = planId
    ? await db.from("t06_tasks").select("*").eq("plan_id", planId).is("deleted_at", null).order("due_date").order("created_at")
    : { data: [], error: null };
  if (taskResult.error) throw taskResult.error;
  const tasks = taskResult.data ?? [];
  const taskIds = tasks.map((t) => t.id);

  let executions: any[] = [];
  let completions: any[] = [];
  if (taskIds.length) {
    const e = await db.from("t06_execution_logs").select("*").in("task_id", taskIds).order("started_at");
    if (e.error) throw e.error;
    executions = e.data ?? [];

    const c = await db.from("t06_completion_events").select("*").in("task_id", taskIds).order("completed_at");
    if (c.error) throw c.error;
    completions = c.data ?? [];
  }

  const reflections = planId
    ? await db.from("t06_reflections").select("*").eq("plan_id", planId).order("created_at")
    : { data: [], error: null };
  if (reflections.error) throw reflections.error;

  const safety = await db.from("t06_security_checks").select("check_key,stored_text,created_at").order("created_at");
  if (safety.error) throw safety.error;

  const today = kstToday();
  const summary = {
    plan_count: tasks.length,
    completed_count: tasks.filter((t) => t.completed).length,
    delayed_count: tasks.filter((t) => !t.completed && t.due_date < today).length,
    blocked_count: tasks.filter((t) => executions.some((e) => e.task_id === t.id && clean(e.blocker_reason))).length,
    expected_minutes: tasks.reduce((sum, t) => sum + Number(t.expected_minutes || 0), 0),
    actual_minutes: executions.reduce((sum, e) => sum + Number(e.actual_minutes || 0), 0)
  };
  (summary as any).difference_minutes = summary.actual_minutes - summary.expected_minutes;

  return {
    ok: true,
    timezone: "Asia/Seoul",
    today,
    plans,
    active_plan_id: planId,
    revisions: revisions.data ?? [],
    tasks,
    executions,
    completions,
    reflections: reflections.data ?? [],
    security_checks: safety.data ?? [],
    summary,
    sort_rule: "마감일 오름차순 → 우선순위 high/medium/low → 생성시각 오름차순"
  };
}

async function handle(action: string, body: any) {
  if (action === "state") return getState(body.plan_id ?? null);

  if (action === "create_plan") {
    const row = {
      title: clean(body.title, 160),
      start_date: dateOnly(body.start_date),
      end_date: dateOnly(body.end_date),
      priority: toPriority(body.priority),
      success_criteria: clean(body.success_criteria, 1000),
      expected_minutes: toInt(body.expected_minutes),
      next_from_reflection: clean(body.next_from_reflection, 1000) || null
    };
    if (!row.title || !row.success_criteria) throw new Error("REQUIRED_PLAN_FIELD");
    const q = await db.from("t06_plans").insert(row).select("*").single();
    if (q.error) throw q.error;
    return { ok: true, plan: q.data };
  }

  if (action === "update_plan") {
    const q = await db.rpc("t06_update_plan", {
      p_id: String(body.id),
      p_title: clean(body.title, 160),
      p_start_date: dateOnly(body.start_date),
      p_end_date: dateOnly(body.end_date),
      p_priority: toPriority(body.priority),
      p_success_criteria: clean(body.success_criteria, 1000),
      p_expected_minutes: toInt(body.expected_minutes),
      p_next_from_reflection: clean(body.next_from_reflection, 1000) || null
    });
    if (q.error) throw q.error;
    return { ok: true, plan: q.data };
  }

  if (action === "create_task") {
    const row = {
      plan_id: String(body.plan_id),
      title: clean(body.title, 240),
      due_date: dateOnly(body.due_date),
      priority: toPriority(body.priority),
      tags: toTags(body.tags),
      expected_minutes: toInt(body.expected_minutes)
    };
    if (!row.title) throw new Error("REQUIRED_TASK_TITLE");
    const q = await db.from("t06_tasks").insert(row).select("*").single();
    if (q.error) throw q.error;
    return { ok: true, task: q.data };
  }

  if (action === "update_task") {
    const patch = {
      title: clean(body.title, 240),
      due_date: dateOnly(body.due_date),
      priority: toPriority(body.priority),
      tags: toTags(body.tags),
      expected_minutes: toInt(body.expected_minutes),
      updated_at: new Date().toISOString()
    };
    if (!patch.title) throw new Error("REQUIRED_TASK_TITLE");
    const q = await db.from("t06_tasks").update(patch).eq("id", String(body.id)).is("deleted_at", null).select("*").single();
    if (q.error) throw q.error;
    return { ok: true, task: q.data };
  }

  if (action === "delete_task") {
    const q = await db.from("t06_tasks")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", String(body.id)).is("deleted_at", null).select("id").maybeSingle();
    if (q.error) throw q.error;
    return { ok: true, deleted: Boolean(q.data) };
  }

  if (action === "set_completed") {
    const q = await db.rpc("t06_set_task_completed", {
      p_task_id: String(body.id),
      p_completed: Boolean(body.completed)
    });
    if (q.error) throw q.error;
    return { ok: true, result: q.data };
  }

  if (action === "add_execution") {
    const started = iso(body.started_at);
    const ended = iso(body.ended_at);
    const actual = toInt(body.actual_minutes);
    if (new Date(ended) < new Date(started)) throw new Error("END_BEFORE_START");
    const row = {
      task_id: String(body.task_id),
      started_at: started,
      ended_at: ended,
      actual_minutes: actual,
      blocker_reason: clean(body.blocker_reason, 1000)
    };
    const q = await db.from("t06_execution_logs").insert(row).select("*").single();
    if (q.error) throw q.error;
    return { ok: true, execution: q.data };
  }

  if (action === "carry_reflection") {
    const planId = String(body.plan_id);
    const note = clean(body.improvement_note, 1000);
    if (!note) throw new Error("REQUIRED_REFLECTION");

    const source = await db.from("t06_plans").select("*").eq("id", planId).single();
    if (source.error) throw source.error;

    const next = await db.from("t06_plans").insert({
      title: clean(body.next_title, 160) || source.data.title + " · 다음 계획",
      start_date: dateOnly(body.next_start_date),
      end_date: dateOnly(body.next_end_date),
      priority: source.data.priority,
      success_criteria: clean(body.next_success_criteria, 1000) || source.data.success_criteria,
      expected_minutes: toInt(body.next_expected_minutes ?? source.data.expected_minutes),
      next_from_reflection: note
    }).select("*").single();
    if (next.error) throw next.error;

    const reflection = await db.from("t06_reflections").insert({
      plan_id: planId,
      improvement_note: note,
      next_plan_id: next.data.id
    }).select("*").single();
    if (reflection.error) throw reflection.error;

    return { ok: true, reflection: reflection.data, next_plan: next.data };
  }

  throw new Error("UNKNOWN_ACTION");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const body = await req.json();
    const result = await handle(String(body?.action ?? ""), body ?? {});
    return reply(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return reply({ ok: false, error: message }, 400);
  }
});
