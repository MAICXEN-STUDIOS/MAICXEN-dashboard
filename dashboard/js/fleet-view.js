import { supabase, dashboardState } from "./supabase-client.js";
import { buildStylizedPcbSvg } from "../../shared/js/pcb-visualizer.js";
import { fmtTs, fmtDur, fmtRelTime, inferProductId } from "../../shared/js/version.js";
import { getTargetVersionForDevice } from "./catalog-manager.js";
import { pushEventLog } from "./activity-log.js";

export async function upsertDeviceToSupabase(dev) {
  const inferredProd = inferProductId(dev);
  await supabase.from("smarty_devices").upsert({
    hw_id: dev.hw_id,
    product_id: inferredProd,
    model_id: dev.model_id || "esp32s3-std",
    hw_rev: dev.hw_rev || "1.0",
    alias: dev.alias || dev.hw_id,
    mac: dev.mac || "",
    profile: dev.profile || "Smarty_1",
    sinric_id: dev.sinric_id || "",
    fw: dev.fw || "",
    ota_part: dev.ota_part || "app0",
    serial_ota: Boolean(dev.serial_ota),
    power: Boolean(dev.power),
    mode: dev.mode || "Start",
    brightness: Number(dev.brightness ?? 100),
    speed: Number(dev.speed ?? 75),
    hex: dev.hex || "#10b981",
    temp: Number(dev.temp || 0),
    heap_free: Number(dev.heap_free || 0),
    heap_min: Number(dev.heap_min || 0),
    wifi_ssid: dev.wifi_ssid || "",
    wifi_ip: dev.wifi_ip || "",
    rssi: Number(dev.rssi || 0),
    cloud_online: Boolean(dev.cloud_online),
    boot_count: Number(dev.boot_count || 0),
    uptime: Number(dev.uptime || 0),
    total_on_sec: Number(dev.total_on_sec || 0),
    last_on_ts: Number(dev.last_on_ts || 0),
    last_off_ts: Number(dev.last_off_ts || 0),
    fota_status: dev.fota_status || "Ready",
    first_registered_ms: Number(dev.first_registered_ms || Date.now()),
    last_seen_ms: Number(dev.last_seen_ms || Date.now()),
    updated_at: new Date().toISOString()
  });
}

export function renderFleet() {
  const q = (document.getElementById("searchFilter").value || "").toLowerCase();
  const prodFilter = (document.getElementById("productFilter")?.value || "all").toLowerCase();
  const allDevs = Object.values(dashboardState.fleetRegistry).sort(
    (a, b) => (b.last_seen_ms || 0) - (a.last_seen_ms || 0)
  );
  const nowMs = Date.now();

  let onlineCount = 0;
  let poweredOnCount = 0;
  let outdatedCount = 0;
  allDevs.forEach((d) => {
    const targetVer = getTargetVersionForDevice(d);
    if (nowMs - (d.last_seen_ms || 0) < 180000) onlineCount++;
    if (d.power) poweredOnCount++;
    if (d.fw && d.fw !== targetVer) outdatedCount++;
  });

  document.getElementById("kpiTotal").textContent = allDevs.length;
  document.getElementById("kpiOnline").textContent = onlineCount;
  document.getElementById("kpiPoweredOn").textContent = poweredOnCount;
  document.getElementById("kpiOutdated").textContent = outdatedCount;

  const filtered = allDevs.filter((d) => {
    const devProd = inferProductId(d);
    if (prodFilter !== "all" && devProd !== prodFilter) return false;
    if (!q) return true;
    return (
      (d.hw_id || "").toLowerCase().includes(q) ||
      (d.alias || "").toLowerCase().includes(q) ||
      (d.wifi_ip || "").toLowerCase().includes(q) ||
      devProd.includes(q) ||
      (d.model_id || "").toLowerCase().includes(q)
    );
  });

  const grid = document.getElementById("devicesGrid");
  if (!filtered.length) {
    grid.innerHTML = `<div class="panel-box" style="grid-column:1/-1; text-align:center; color:var(--muted-dash);">
      No MAICXEN EDGE devices match your current filter. Any Smarty or AledA unit will automatically appear here as soon as it connects to Wi-Fi.
    </div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((d) => {
      const isOnline = nowMs - (d.last_seen_ms || 0) < 180000;
      const targetVer = getTargetVersionForDevice(d);
      const isUpToDate = d.fw === targetVer;
      const devProd = inferProductId(d).toUpperCase();
      const devModel = d.model_id || "esp32s3-std";
      const hasValidIp = d.wifi_ip && d.wifi_ip !== "0.0.0.0";

      return `
        <div class="mini-card ${isOnline ? "online" : "offline"}" onclick="openDeviceModal('${d.hw_id}')">
          <div class="mc-top">
            <div>
              <div class="mc-title">
                <span class="dot ${isOnline ? "on" : "off"}"></span>
                <span>${d.alias || d.hw_id}</span>
              </div>
              <div class="mc-sub">${devProd} (${devModel}) &bull; ${d.hw_id} &bull; ${fmtRelTime(d.last_seen_ms)}</div>
            </div>
            <span class="pill ${isUpToDate ? "green" : "amber"}">v${d.fw || "--"}</span>
          </div>

          <div class="mc-pcb-wrap">
            ${buildStylizedPcbSvg(devProd.toLowerCase(), {
              isPoweredOn: Boolean(d.power),
              maxWidth: devProd.toLowerCase() === "smarty" ? "230px" : "210px"
            })}
          </div>

          <div class="mc-status-row">
            <span><span class="color-dot" style="background:${d.power ? "#10b981" : "#475569"}"></span>${
        d.power ? "Power: ON" : "Power: OFF"
      }</span>
            <span>${d.wifi_ip || "--"} &bull; ${Number(d.temp || 0).toFixed(0)}°C</span>
          </div>

          <div class="mc-footer">
            ${
              hasValidIp
                ? `<a href="http://${d.wifi_ip}" target="_blank" class="btn-primary" style="text-decoration:none;padding:8px 11px;border-radius:9px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:5px;" onclick="event.stopPropagation()">Open Local UI &nearr;</a>`
                : `<span style="font-size:11.5px;color:var(--muted-dash);">No Local IP</span>`
            }
            <button class="btn-cyan" onclick="openDeviceModal('${d.hw_id}', event)">Inspect Telemetry &rarr;</button>
          </div>
        </div>
      `;
    })
    .join("");
}

export function populateModal(hwId) {
  const d = dashboardState.fleetRegistry[hwId];
  if (!d) return;

  const isOnline = Date.now() - (d.last_seen_ms || 0) < 180000;
  const targetVer = getTargetVersionForDevice(d);
  const isUpToDate = d.fw === targetVer;
  const devProd = inferProductId(d).toUpperCase();
  const devModel = d.model_id || "esp32s3-std";

  document.getElementById("mTitle").textContent = d.alias || d.hw_id;
  document.getElementById("mSubtitle").textContent = `Product: ${devProd} (${devModel} · Rev ${
    d.hw_rev || "1.0"
  }) • ID: ${d.hw_id} • MAC: ${d.mac || "--"}`;
  document.getElementById("mPcbPreview").innerHTML = buildStylizedPcbSvg(devProd.toLowerCase(), {
    isPoweredOn: Boolean(d.power),
    maxWidth: devProd.toLowerCase() === "smarty" ? "460px" : "380px"
  });

  const pill = document.getElementById("mOnlinePill");
  pill.textContent = isOnline ? "ONLINE" : "OFFLINE";
  pill.className = "pill " + (isOnline ? "green" : "amber");

  const localBtn = document.getElementById("mLocalUiBtn");
  if (d.wifi_ip && d.wifi_ip !== "0.0.0.0") {
    localBtn.href = `http://${d.wifi_ip}`;
    localBtn.style.display = "inline-flex";
    localBtn.textContent = `Open Local UI (http://${d.wifi_ip}) ↗`;
  } else {
    localBtn.style.display = "none";
  }

  document.getElementById("mOverviewGrid").innerHTML = `
    <div class="detail-cell"><span>Product Line &amp; Model</span><strong>${devProd} &bull; ${devModel}</strong></div>
    <div class="detail-cell"><span>Hardware ID &amp; Revision</span><strong>${d.hw_id} (Rev ${d.hw_rev || "1.0"})</strong></div>
    <div class="detail-cell"><span>Current Power State</span><strong style="color:${
      d.power ? "var(--green)" : "var(--muted-dash)"
    };">${d.power ? "POWERED ON" : "STANDBY (OFF)"}</strong></div>
    <div class="detail-cell"><span>Installed Firmware</span><strong>v${d.fw || "--"} (${
    isUpToDate ? "Up to date" : "v" + targetVer + " available"
  })</strong></div>
    <div class="detail-cell"><span>Wi-Fi SSID &amp; Signal</span><strong>${d.wifi_ssid || "--"} (${d.rssi || 0} dBm)</strong></div>
    <div class="detail-cell"><span>MCU SoC Temp &amp; Free RAM</span><strong>${Number(d.temp || 0).toFixed(
      1
    )} °C &bull; ${Math.round((d.heap_free || 0) / 1024)} KB</strong></div>
  `;

  document.getElementById("mTelemGrid").innerHTML = `
    <div class="detail-cell"><span>Last Connected</span><strong>${
      d.last_seen_ms ? new Date(Number(d.last_seen_ms)).toLocaleString("en-GB") : "N/A"
    }</strong></div>
    <div class="detail-cell"><span>First Registered</span><strong>${
      d.first_registered_ms ? new Date(Number(d.first_registered_ms)).toLocaleString("en-GB") : "N/A"
    }</strong></div>
    <div class="detail-cell"><span>Last Powered ON</span><strong>${fmtTs(d.last_on_ts)}</strong></div>
    <div class="detail-cell"><span>Last Powered OFF</span><strong>${fmtTs(d.last_off_ts)}</strong></div>
    <div class="detail-cell"><span>Cumulative On-Time</span><strong>${fmtDur(d.total_on_sec)}</strong></div>
    <div class="detail-cell"><span>Session Uptime / Boots</span><strong>${fmtDur(d.uptime)} (${
    d.boot_count || 1
  } boots)</strong></div>
    <div class="detail-cell"><span>Wi-Fi Network &amp; RSSI</span><strong>${d.wifi_ssid || "--"} (${d.rssi || 0} dBm)</strong></div>
    <div class="detail-cell"><span>Local IPv4 Address</span><strong><a href="http://${
      d.wifi_ip
    }" target="_blank" style="color:var(--cyan);">http://${d.wifi_ip || "--"} &nearr;</a></strong></div>
    <div class="detail-cell"><span>ESP32-S3 SoC Temp</span><strong>${Number(d.temp || 0).toFixed(1)} °C</strong></div>
    <div class="detail-cell"><span>RAM Heap (Free / Min)</span><strong>${Math.round(
      (d.heap_free || 0) / 1024
    )} KB / ${Math.round((d.heap_min || 0) / 1024)} KB</strong></div>
  `;

  document.getElementById("mSysGrid").innerHTML = `
    <div class="detail-cell"><span>Installed Firmware</span><strong>v${d.fw || "--"} (${
    isUpToDate ? "Up to date" : "Update v" + targetVer + " available"
  })</strong></div>
    <div class="detail-cell"><span>Active OTA Partition</span><strong>${
      d.ota_part || "app0"
    } (Dual-OTA Rollback)</strong></div>
    <div class="detail-cell"><span>FOTA Engine Status</span><strong>${d.fota_status || "Ready"}</strong></div>
    <div class="detail-cell"><span>Native USB FOTA</span><strong>${
      d.serial_ota ? "Supported (921600 baud CRC16)" : "Bootloader Mode"
    }</strong></div>
    <div class="detail-cell"><span>Cloud / Ecosystem Sync</span><strong>${
      d.cloud_online ? "Connected (ONLINE)" : "Disconnected"
    }</strong></div>
    <div class="detail-cell"><span>Hardware MAC Address</span><strong>${d.mac || "--"}</strong></div>
  `;
}

export async function loadDevicesFromSupabase() {
  const { data } = await supabase
    .from("smarty_devices")
    .select("*")
    .order("last_seen_ms", { ascending: false });
  if (data) {
    data.forEach((row) => {
      dashboardState.fleetRegistry[row.hw_id] = row;
    });
    renderFleet();
  }
}

export function ingestTelemetryPacket(pkt, serverTimestampSec = null, persistToDb = true) {
  if (!pkt || !pkt.hw_id) return;
  const id = pkt.hw_id;
  const nowMs = Date.now();
  const seenMs = serverTimestampSec ? serverTimestampSec * 1000 : nowMs;

  const prev = dashboardState.fleetRegistry[id] || {
    hw_id: id,
    alias: `${pkt.product || "Smarty"} (${id})`,
    first_registered_ms: seenMs,
    last_seen_ms: 0
  };

  if (seenMs < (prev.last_seen_ms || 0)) return;

  const prevPower = prev.power;
  const updated = {
    ...prev,
    ...pkt,
    alias: prev.alias || `${pkt.product || "Smarty"} (${id})`,
    first_registered_ms: prev.first_registered_ms || seenMs,
    last_seen_ms: seenMs
  };

  if (pkt.event === "power_on" && (!updated.last_on_ts || updated.last_on_ts < 1700000000)) {
    updated.last_on_ts = Math.floor(seenMs / 1000);
  }
  if (pkt.event === "power_off" && (!updated.last_off_ts || updated.last_off_ts < 1700000000)) {
    updated.last_off_ts = Math.floor(seenMs / 1000);
  }

  dashboardState.fleetRegistry[id] = updated;
  if (persistToDb) {
    upsertDeviceToSupabase(updated);
  }

  if (persistToDb && pkt.event && (pkt.event !== "heartbeat" || prevPower !== pkt.power)) {
    pushEventLog(id, pkt.event.toUpperCase(), `State: ${pkt.power ? "ON" : "OFF"} | Mode: ${pkt.mode} | FW: v${pkt.fw}`);
  }

  renderFleet();
  if (dashboardState.selectedHwId === id) {
    populateModal(id);
  }
}

export async function probeLocalDevice(openModalFn) {
  const ip = document
    .getElementById("lanProbeIp")
    .value.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!ip) return;
  try {
    const res = await fetch(`http://${ip}/api/status`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const pkt = await res.json();
    ingestTelemetryPacket(pkt, Math.floor(Date.now() / 1000), true);
    openModalFn(pkt.hw_id);
  } catch (_) {
    alert(`Could not reach http://${ip}/api/status`);
  }
}

export function connectRealtimeStream() {
  const pill = document.getElementById("streamStatusPill");
  pill.textContent = "LIVE";
  pill.className = "pill green";

  if (dashboardState.realtimeChannel) {
    supabase.removeChannel(dashboardState.realtimeChannel);
  }
  dashboardState.realtimeChannel = supabase
    .channel("maicxen-fleet-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "smarty_devices" }, (payload) => {
      if (payload.new && payload.new.hw_id) {
        dashboardState.fleetRegistry[payload.new.hw_id] = payload.new;
        renderFleet();
        if (dashboardState.selectedHwId === payload.new.hw_id) {
          populateModal(payload.new.hw_id);
        }
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        pill.textContent = "LIVE";
        pill.className = "pill green";
      }
    });
}

export async function renameCurrentDevice() {
  const hwId = dashboardState.selectedHwId;
  if (!hwId || !dashboardState.fleetRegistry[hwId]) return;
  if (dashboardState.currentProfile?.role === "viewer") return;
  const cur = dashboardState.fleetRegistry[hwId].alias || hwId;
  const next = prompt("Enter a custom label for this MAICXEN EDGE device:", cur);
  if (next && next.trim()) {
    dashboardState.fleetRegistry[hwId].alias = next.trim();
    await upsertDeviceToSupabase(dashboardState.fleetRegistry[hwId]);
    renderFleet();
    populateModal(hwId);
  }
}

export async function removeCurrentDevice(closeModalFn) {
  const hwId = dashboardState.selectedHwId;
  if (!hwId || dashboardState.currentProfile?.role !== "admin") return;
  if (!confirm(`Remove ${hwId} from the Supabase fleet registry?`)) return;
  await supabase.from("smarty_devices").delete().eq("hw_id", hwId);
  delete dashboardState.fleetRegistry[hwId];
  closeModalFn();
  renderFleet();
}
