import { supabase, dashboardState } from "./supabase-client.js";

export function renderEventLogs() {
  const box = document.getElementById("eventsLog");
  if (!box) return;
  if (!dashboardState.eventLogs.length) {
    box.innerHTML = "<div style='color:var(--muted-dash)'>No activity events recorded yet.</div>";
    return;
  }
  box.innerHTML = dashboardState.eventLogs
    .map(
      (e) =>
        `<div class="log-entry"><span style="color:var(--muted-dash)">[${e.time}]</span> <strong style="color:var(--cyan)">${e.hwId}</strong> &bull; <span style="color:var(--green)">${e.eventType}</span> — ${e.detail}</div>`
    )
    .join("");
}

export async function loadEventsFromSupabase() {
  const { data } = await supabase
    .from("smarty_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(120);
  if (data) {
    dashboardState.eventLogs = data.map((r) => ({
      time: new Date(r.created_at).toLocaleString("en-GB"),
      hwId: r.hw_id,
      eventType: r.event_type,
      detail: r.detail + (r.actor_email ? ` (${r.actor_email})` : "")
    }));
    renderEventLogs();
  }
}

export async function pushEventLog(hwId, eventType, detail) {
  const actor = dashboardState.currentProfile?.email || "";
  dashboardState.eventLogs.unshift({
    time: new Date().toLocaleString("en-GB"),
    hwId,
    eventType,
    detail: detail + (actor ? ` (${actor})` : "")
  });
  if (dashboardState.eventLogs.length > 120) dashboardState.eventLogs.length = 120;
  renderEventLogs();

  await supabase.from("smarty_events").insert({
    hw_id: hwId,
    event_type: eventType,
    detail,
    actor_email: actor
  });
}

export async function clearEventLog() {
  if (dashboardState.currentProfile?.role !== "admin") return;
  await supabase.from("smarty_events").delete().gt("id", 0);
  dashboardState.eventLogs = [];
  renderEventLogs();
}
