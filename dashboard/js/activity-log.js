import { supabase, dashboardState } from "./supabase-client.js";

export function renderEventLogs() {
  const box = document.getElementById("eventsLog");
  if (!box) return;
  const q = (document.getElementById("logSearchFilter")?.value || "").trim().toLowerCase();
  const rows = q
    ? dashboardState.eventLogs.filter(
        (e) =>
          (e.hwId || "").toLowerCase().includes(q) ||
          (e.eventType || "").toLowerCase().includes(q) ||
          (e.detail || "").toLowerCase().includes(q)
      )
    : dashboardState.eventLogs;

  if (!rows.length) {
    box.innerHTML = `<div class="fleet-empty">No activity events match the current filter.</div>`;
    return;
  }
  box.innerHTML = rows
    .map((e) => {
      const t = String(e.eventType || "").toUpperCase();
      const cls = t.includes("BOOT") ? "cyan" : t.includes("OFF") ? "muted" : "green";
      return `
        <div class="log-entry">
          <span class="log-time">${e.time}</span>
          <span class="log-hwid">${e.hwId}</span>
          <span class="pill ${cls} log-type">${e.eventType}</span>
          <span class="log-detail">${e.detail}</span>
        </div>
      `;
    })
    .join("");
}

export function exportEventLog() {
  const lines = dashboardState.eventLogs.map((e) => `[${e.time}] ${e.hwId} | ${e.eventType} | ${e.detail}`);
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maicxen-fleet-activity-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
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
  const role = dashboardState.currentProfile?.role || "viewer";
  if (!["owner", "admin", "manager", "editor"].includes(role)) return;
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
  if (!["owner", "admin"].includes(dashboardState.currentProfile?.role || "")) return;
  await supabase.from("smarty_events").delete().gt("id", 0);
  dashboardState.eventLogs = [];
  renderEventLogs();
}
