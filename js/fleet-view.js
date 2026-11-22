import { supabase, dashboardState } from "./supabase-client.js";
import { buildStylizedPcbSvg } from "../shared/js/pcb-visualizer.js";
import { fmtTs, fmtDur, fmtRelTime, inferProductId } from "../shared/js/version.js";
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
  const statusFilter = (document.getElementById("statusFilter")?.value || "all").toLowerCase();
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
    const isOnline = nowMs - (d.last_seen_ms || 0) < 180000;
    const targetVer = getTargetVersionForDevice(d);
    const isOutdated = Boolean(d.fw && d.fw !== targetVer);

    if (prodFilter !== "all" && devProd !== prodFilter) return false;
    if (statusFilter === "online" && !isOnline) return false;
    if (statusFilter === "offline" && isOnline) return false;
    if (statusFilter === "active" && !d.power) return false;
    if (statusFilter === "outdated" && !isOutdated) return false;
    if (!q) return true;
    return (
      (d.hw_id || "").toLowerCase().includes(q) ||
      (d.alias || "").toLowerCase().includes(q) ||
      (d.wifi_ip || "").toLowerCase().includes(q) ||
      devProd.includes(q) ||
      (d.model_id || "").toLowerCase().includes(q)
    );
  });

  const list = document.getElementById("devicesGrid");
  if (!filtered.length) {
    list.innerHTML = `<div class="fleet-empty">
      No MAICXEN EDGE devices match your current filter. Any registered unit appears automatically as soon as it connects to Wi-Fi.
    </div>`;
    return;
  }

  list.innerHTML = filtered
    .map((d) => {
      const isOnline = nowMs - (d.last_seen_ms || 0) < 180000;
      const targetVer = getTargetVersionForDevice(d);
      const isUpToDate = d.fw === targetVer;
      const devProd = inferProductId(d).toUpperCase();
      const devModel = d.model_id || "esp32s3-std";
      const hasValidIp = d.wifi_ip && d.wifi_ip !== "0.0.0.0";
      const verTitle = isUpToDate
        ? `Up to date (v${d.fw || "--"})`
        : `Update available: v${targetVer}`;

      const emblemUrl = `./shared/assets/emblems/edge-${devProd.toLowerCase()}-${devModel.toLowerCase()}-emblem.webp`;
      return `
        <div class="device-row ${isOnline ? "online" : "offline"}" onclick="openDeviceModal('${d.hw_id}')">
          <div class="device-thumb">
            <img
              src="${emblemUrl}"
              alt="${devProd} ${devModel}"
              width="52"
              height="52"
              style="width:52px;height:52px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);${d.power ? "" : "opacity:0.55;filter:grayscale(0.5);"}"
              onerror="this.replaceWith(document.createRange().createContextualFragment(\`${buildStylizedPcbSvg(devProd.toLowerCase(), {
                isPoweredOn: Boolean(d.power),
                maxWidth: "74px"
              }).replace(/`/g, "\\`")}\`))"
            />
          </div>

          <div class="device-identity">
            <div class="device-name-line">
              <span class="status-dot ${isOnline ? "on" : "off"}"></span>
              <span class="device-name">${d.alias || d.hw_id}</span>
            </div>
            <div class="device-sub">${devProd} · ${devModel} · <span class="mono">${d.hw_id}</span> · ${fmtRelTime(d.last_seen_ms)}</div>
          </div>

          <div class="device-telemetry-inline">
            <span class="power-chip">
              <span class="p-dot" style="background:${d.power ? "var(--green)" : "var(--apple-text-tertiary)"}"></span>
              ${d.power ? "ON" : "OFF"}
            </span>
            <span class="mono">${Number(d.temp || 0).toFixed(0)}°C</span>
            <span class="mono">${hasValidIp ? d.wifi_ip : "—"}</span>
          </div>

          <div class="device-actions">
            <span class="pill ${isUpToDate ? "green" : "amber"}" title="${verTitle}">v${d.fw || "--"}</span>
            ${
              hasValidIp
                ? `<a href="http://${d.wifi_ip}" target="_blank" rel="noopener" class="pill-btn" onclick="event.stopPropagation()">Local UI ↗</a>`
                : ""
            }
            <span class="row-chevron" aria-hidden="true">›</span>
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
  const devProdSlug = inferProductId(d);
  const devProd = devProdSlug.toUpperCase();
  const devModel = d.model_id || "esp32s3-std";

  document.getElementById("mTitle").textContent = d.alias || d.hw_id;
  document.getElementById("mSubtitle").textContent = `${devProd} · ${devModel} (Rev ${
    d.hw_rev || "1.0"
  }) · ${d.hw_id}`;
  document.getElementById("mPcbPreview").innerHTML = buildStylizedPcbSvg(devProdSlug, {
    isPoweredOn: Boolean(d.power),
    maxWidth: "380px"
  });

  const pill = document.getElementById("mOnlinePill");
  pill.textContent = isOnline ? "ONLINE" : "OFFLINE";
  pill.className = "pill " + (isOnline ? "green" : "amber");

  const localBtn = document.getElementById("mLocalUiBtn");
  if (d.wifi_ip && d.wifi_ip !== "0.0.0.0") {
    localBtn.href = `http://${d.wifi_ip}`;
    localBtn.style.display = "inline-flex";
    localBtn.textContent = `Open Local UI (${d.wifi_ip}) ↗`;
  } else {
    localBtn.style.display = "none";
  }

  const flashBtn = document.getElementById("mFlashUsbBtn");
  if (flashBtn) {
    flashBtn.href = `https://iot.maicxen.it/?product=${encodeURIComponent(devProdSlug)}&model=${encodeURIComponent(devModel)}`;
  }

  document.getElementById("mOverviewGrid").innerHTML = `
    <div class="kv-row"><span>Product &amp; Model</span><strong>${devProd} · ${devModel}</strong></div>
    <div class="kv-row"><span>Hardware ID</span><strong class="mono">${d.hw_id} (Rev ${d.hw_rev || "1.0"})</strong></div>
    <div class="kv-row"><span>Power State</span><strong style="color:${
      d.power ? "var(--green)" : "var(--apple-text-secondary)"
    };">${d.power ? "Powered ON" : "Standby (OFF)"}</strong></div>
    <div class="kv-row"><span>Firmware</span><strong class="mono">v${d.fw || "--"} · ${
    isUpToDate ? "Up to date" : "v" + targetVer + " available"
  }</strong></div>
    <div class="kv-row"><span>Wi-Fi Signal</span><strong>${d.wifi_ssid || "--"} (${d.rssi || 0} dBm)</strong></div>
    <div class="kv-row"><span>Temp &amp; Free RAM</span><strong class="mono">${Number(d.temp || 0).toFixed(
      1
    )}°C · ${Math.round((d.heap_free || 0) / 1024)} KB</strong></div>
  `;

  document.getElementById("mTelemGrid").innerHTML = `
    <div class="kv-row"><span>Last Connected</span><strong>${
      d.last_seen_ms ? new Date(Number(d.last_seen_ms)).toLocaleString("en-GB") : "N/A"
    }</strong></div>
    <div class="kv-row"><span>First Registered</span><strong>${
      d.first_registered_ms ? new Date(Number(d.first_registered_ms)).toLocaleString("en-GB") : "N/A"
    }</strong></div>
    <div class="kv-row"><span>Last Powered ON</span><strong>${fmtTs(d.last_on_ts)}</strong></div>
    <div class="kv-row"><span>Last Powered OFF</span><strong>${fmtTs(d.last_off_ts)}</strong></div>
    <div class="kv-row"><span>Cumulative On-Time</span><strong class="mono">${fmtDur(d.total_on_sec)}</strong></div>
    <div class="kv-row"><span>Session Uptime</span><strong class="mono">${fmtDur(d.uptime)} (${
    d.boot_count || 1
  } boots)</strong></div>
    <div class="kv-row"><span>Local IPv4</span><strong class="mono">${
      d.wifi_ip && d.wifi_ip !== "0.0.0.0"
        ? `<a href="http://${d.wifi_ip}" target="_blank" rel="noopener">http://${d.wifi_ip} ↗</a>`
        : "--"
    }</strong></div>
    <div class="kv-row"><span>Heap (Free / Min)</span><strong class="mono">${Math.round(
      (d.heap_free || 0) / 1024
    )} KB / ${Math.round((d.heap_min || 0) / 1024)} KB</strong></div>
  `;

  document.getElementById("mSysGrid").innerHTML = `
    <div class="kv-row"><span>Installed Firmware</span><strong class="mono">v${d.fw || "--"} (${
    isUpToDate ? "Up to date" : "v" + targetVer + " available"
  })</strong></div>
    <div class="kv-row"><span>Active OTA Partition</span><strong class="mono">${
      d.ota_part || "app0"
    }</strong></div>
    <div class="kv-row"><span>FOTA Status</span><strong>${d.fota_status || "Ready"}</strong></div>
    <div class="kv-row"><span>USB-FOTA Support</span><strong>${
      d.serial_ota ? "Native CRC-16" : "Bootloader Mode"
    }</strong></div>
    <div class="kv-row"><span>Cloud Sync</span><strong>${
      d.cloud_online ? "Online" : "Disconnected"
    }</strong></div>
    <div class="kv-row"><span>MAC Address</span><strong class="mono">${d.mac || "--"}</strong></div>
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
