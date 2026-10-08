export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t06-pds",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "state" })
      }
    );

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return res.status(502).json({ ok: false, upstream_status: response.status, error: data.error || "T06_UPSTREAM_ERROR" });
    }

    return res.status(200).json({
      ok: true,
      timezone: data.timezone,
      today: data.today,
      active_plan_id: data.active_plan_id,
      plan_count: Array.isArray(data.plans) ? data.plans.length : null,
      task_count: Array.isArray(data.tasks) ? data.tasks.length : null,
      execution_count: Array.isArray(data.executions) ? data.executions.length : null,
      revision_count: Array.isArray(data.revisions) ? data.revisions.length : null,
      reflection_count: Array.isArray(data.reflections) ? data.reflections.length : null,
      summary: data.summary || null
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "T06_PROBE_ERROR" });
  }
}
