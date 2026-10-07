const SOURCE_URL = "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m&timezone=Asia%2FSeoul";

function kstDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return map.year + "-" + map.month + "-" + map.day;
}

function sourceIso(localTime) {
  if (typeof localTime !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localTime)) {
    return null;
  }
  const base = localTime.length === 16 ? localTime + ":00" : localTime;
  return base + "+09:00";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const upstream = await fetch(SOURCE_URL, {
      headers: { "accept": "application/json" },
      signal: controller.signal
    });

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error_code: upstream.status === 429 ? "rate_limit" : "upstream_http",
        upstream_status: upstream.status
      });
    }

    const raw = await upstream.json();
    const value = raw && raw.current ? raw.current.temperature_2m : null;
    const unit = raw && raw.current_units ? raw.current_units.temperature_2m : null;

    if (!Number.isFinite(value) || typeof unit !== "string" || !raw.current || !raw.current.time) {
      return res.status(502).json({ ok: false, error_code: "schema_error" });
    }

    const fetchedAt = new Date().toISOString();
    const reading = {
      signal_id: "seoul.temperature_2m",
      normalized_value: value,
      unit,
      source_name: "Open-Meteo Forecast API",
      source_url: SOURCE_URL,
      source_time: sourceIso(raw.current.time),
      fetched_at: fetchedAt,
      record_timezone: "Asia/Seoul",
      record_date: kstDate(new Date(fetchedAt))
    };

    return res.status(200).json({
      ok: true,
      reading,
      status: { freshness: "fresh", error_code: "none" },
      raw: {
        latitude: raw.latitude,
        longitude: raw.longitude,
        timezone: raw.timezone,
        timezone_abbreviation: raw.timezone_abbreviation,
        current_units: {
          time: raw.current_units.time,
          temperature_2m: raw.current_units.temperature_2m
        },
        current: {
          time: raw.current.time,
          interval: raw.current.interval,
          temperature_2m: raw.current.temperature_2m
        }
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error_code: error && error.name === "AbortError" ? "timeout" : "offline"
    });
  } finally {
    clearTimeout(timeout);
  }
};