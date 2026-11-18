import {
  FLASHER_VERSION,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  USB_FOTA_MIN_VERSION
} from "../../shared/js/config.js";
import { compareVersions, isVersionAtLeast, fmtDur, inferProductId } from "../../shared/js/version.js";
import { buildStylizedPcbSvg } from "../../shared/js/pcb-visualizer.js";
import { DEFAULT_CATALOG_PRODUCTS, fetchPublicCatalog } from "../../shared/js/catalog-data.js";
import {
  safeClosePort,
  openAndProbeOnSamePort,
  runNativeUsbFota,
  runClassicEsptoolFlash
} from "./serial-protocol.js";
import { createUsbDiagnosticsController } from "./usb-diagnostics.js";

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let catalogProducts = DEFAULT_CATALOG_PRODUCTS;
let selectedProduct = catalogProducts[0];
let selectedModel = catalogProducts[0].models[0];

const pcbVisEl = document.getElementById("pcbVisualizer");
const productTabsEl = document.getElementById("productTabs");
const modelSelectEl = document.getElementById("modelSelect");
const selectedModelTitleEl = document.getElementById("selectedModelTitle");
const fwVersionEl = document.getElementById("fwVersion");
const fwNotesEl = document.getElementById("fwNotes");
const capTagsEl = document.getElementById("capTags");
const modeBadgeEl = document.getElementById("modeBadge");
const flashBtn = document.getElementById("flashBtn");
const progressSection = document.getElementById("progressSection");
const progressStep = document.getElementById("progressStep");
const progressPct = document.getElementById("progressPct");
const progressFill = document.getElementById("progressFill");
const statusBanner = document.getElementById("statusBanner");
const consoleLog = document.getElementById("consoleLog");
const consoleDetails = document.getElementById("consoleDetails");

function renderIdleBitmap(isError = false, customColor = null) {
  const prodId = selectedProduct ? selectedProduct.product_id : "smarty";
  pcbVisEl.innerHTML = buildStylizedPcbSvg(prodId, { progressPct: -1, isError, customColor });
}

function renderMatrixProgress(pct) {
  const prodId = selectedProduct ? selectedProduct.product_id : "smarty";
  pcbVisEl.innerHTML = buildStylizedPcbSvg(prodId, { progressPct: pct });
}

function logLine(msg) {
  consoleLog.textContent += msg + "\n";
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function setStatus(type, message) {
  if (!type) {
    statusBanner.className = "status-banner";
    statusBanner.textContent = "";
    return;
  }
  statusBanner.className = `status-banner ${type}`;
  statusBanner.textContent = message;
}

function updateProgress(stepText, pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  progressSection.classList.add("active");
  progressStep.textContent = stepText;
  progressPct.textContent = `${clamped}%`;
  progressFill.style.width = `${clamped}%`;
  document.getElementById("matrixStatusRight").textContent = `${stepText} (${clamped}%)`;
  renderMatrixProgress(clamped);
}

function renderProductTabs() {
  productTabsEl.innerHTML = "";
  catalogProducts.forEach((prod) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "product-tab" + (selectedProduct && selectedProduct.product_id === prod.product_id ? " active" : "");
    const prodVer = prod.latest_version || prod.models?.[0]?.latest_version || "1.0.0";
    btn.innerHTML = `
      <div class="product-tab-top">
        <span class="product-tab-name">${prod.product_name}</span>
        <span class="product-tab-chip">v${prodVer}</span>
      </div>
      <div class="product-tab-desc">${prod.tagline || `${prod.models.length} hardware variant(s)`}</div>
    `;
    btn.addEventListener("click", () => selectProduct(prod.product_id));
    productTabsEl.appendChild(btn);
  });
}

function selectModel(modelId) {
  if (!selectedProduct) return;
  selectedModel = selectedProduct.models.find((m) => m.model_id === modelId) || selectedProduct.models[0];
  if (!selectedModel) return;

  const unifiedVer = selectedProduct.latest_version || selectedModel.latest_version || "1.0.0";
  selectedModelTitleEl.textContent = `${selectedProduct.product_name} — ${selectedModel.model_name}`;
  fwVersionEl.textContent = `v${unifiedVer}`;
  fwNotesEl.textContent = selectedModel.notes || selectedModel.release_notes || "Ready for WebSerial deployment.";
  document.getElementById("matrixLeftLabel").textContent = `${selectedProduct.product_name} (v${unifiedVer}) · ${selectedModel.chip} Hardware Render`;
  renderIdleBitmap(false, selectedProduct.accent || "#f59e0b");

  capTagsEl.innerHTML = "";
  (selectedModel.capabilities || []).forEach((cap) => {
    const s = document.createElement("span");
    s.className = "cap-tag";
    s.textContent = String(cap).replace(/_/g, " ");
    capTagsEl.appendChild(s);
  });
}

function selectProduct(productId, preferredModelId = null) {
  selectedProduct = catalogProducts.find((p) => p.product_id === productId) || catalogProducts[0];
  if (!selectedProduct) return;
  const unifiedVer = selectedProduct.latest_version || selectedProduct.models?.[0]?.latest_version || "1.0.0";
  selectedProduct.latest_version = unifiedVer;
  selectedProduct.models.forEach((m) => {
    m.latest_version = unifiedVer;
  });
  renderProductTabs();

  modelSelectEl.innerHTML = "";
  selectedProduct.models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.model_id;
    opt.textContent = `${m.model_name} — ${m.chip} · Rev ${m.hw_rev || "1.0"} (Firmware v${unifiedVer})`;
    modelSelectEl.appendChild(opt);
  });

  const targetModel =
    (preferredModelId && selectedProduct.models.find((m) => m.model_id === preferredModelId)) ||
    selectedProduct.models[0];
  if (targetModel) {
    modelSelectEl.value = targetModel.model_id;
    selectModel(targetModel.model_id);
  }
}

function autoMatchProductFromTelemetry(devInfo, preserveModelSelection = false) {
  if (!devInfo) return;
  const detectedProd = inferProductId(devInfo);
  let targetModel = devInfo.model_id || null;
  if (preserveModelSelection && selectedProduct && selectedProduct.product_id === detectedProd && selectedModel) {
    targetModel = selectedModel.model_id;
  }
  if (catalogProducts.some((p) => p.product_id === detectedProd)) {
    selectProduct(detectedProd, targetModel);
    document.getElementById("autoDetectBadge").textContent = `Auto-Detected: ${detectedProd.toUpperCase()} (${devInfo.hw_id || "USB"})`;
  }
}

function updateTelemetryUI(t) {
  autoMatchProductFromTelemetry(t);
  document.getElementById("tHwId").textContent = `${t.hw_id || "ESP32"} (${t.product_id || t.profile || "MAICXEN"})`;
  document.getElementById("tFwPart").textContent = `v${t.fw || "?"} (${t.ota_part || "app0"})`;
  document.getElementById("tModeState").textContent = `${t.power ? "ON" : "OFF"} · ${t.mode || `${t.active_channels ?? 0} ch`} (${t.brightness ?? 100}%)`;
  document.getElementById("tWifi").textContent = t.wifi_ssid ? `${t.wifi_ssid} (${t.rssi} dBm)` : "Disconnected";

  const ipEl = document.getElementById("tIpLink");
  if (t.wifi_ip && t.wifi_ip !== "0.0.0.0") {
    ipEl.innerHTML = `<a href="http://${t.wifi_ip}" target="_blank" style="color:var(--blue);">http://${t.wifi_ip} &nearr;</a>`;
  } else {
    ipEl.textContent = "N/A";
  }

  document.getElementById("tCloud").textContent = t.cloud_online ? "Connected (ONLINE)" : "Offline";
  document.getElementById("tTempHeap").textContent = `${Number(t.temp || 0).toFixed(1)}°C · ${Math.round((t.heap_free || 0) / 1024)} KB free`;
  document.getElementById("tUptime").textContent = `${fmtDur(t.uptime)} / Tot: ${fmtDur(t.total_on_sec)}`;
  document.getElementById("matrixStatusRight").textContent = `${t.hw_id} · ${t.mode || ""} ${t.hex ? `(${t.hex})` : ""}`;
  renderIdleBitmap(false, t.power ? t.hex || (selectedProduct && selectedProduct.accent) || "#f59e0b" : "#1e293b");
}

const espLoaderTerminal = {
  clean() {
    consoleLog.textContent = "";
  },
  writeLine(data) {
    logLine(data);
  },
  write(data) {
    consoleLog.textContent += data;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }
};

const usbDiag = createUsbDiagnosticsController({
  getSelectedProduct: () => selectedProduct,
  onTelemetryPacket: updateTelemetryUI,
  logLine,
  setStatus
});

async function loadCatalog() {
  try {
    const fetched = await fetchPublicCatalog(sb, "./catalog.json");
    if (fetched.length > 0) {
      catalogProducts = fetched;
      const params = new URLSearchParams(window.location.search);
      const qProd = params.get("product") || (selectedProduct ? selectedProduct.product_id : "smarty");
      const qModel = params.get("model") || (selectedModel ? selectedModel.model_id : null);
      selectProduct(qProd, qModel);
    }
  } catch (_) {}
}

flashBtn.addEventListener("click", async () => {
  if (!selectedProduct || !selectedModel) return;
  await usbDiag.closeUsbDiagnostics();

  let port = null;
  try {
    setStatus(null, "");
    port = await navigator.serial.requestPort();

    flashBtn.disabled = true;
    espLoaderTerminal.clean();
    updateProgress("Probing connected MAICXEN EDGE device...", 2);
    logLine(`[MAICXEN EDGE · Flasher v${FLASHER_VERSION}] Probing device telemetry over USB...`);

    const probe = await openAndProbeOnSamePort(
      port,
      selectedProduct ? selectedProduct.product_id : "smarty",
      logLine
    );
    const devInfo = probe.devInfo;
    const forceFlash = Boolean(document.getElementById("forceFlashChk")?.checked);

    if (devInfo) {
      autoMatchProductFromTelemetry(devInfo, true);
      logLine(`[MAICXEN EDGE] Detected ${devInfo.hw_id} (${devInfo.product_id || "device"}) running v${devInfo.fw} (${devInfo.ota_part}).`);

      const targetVer = selectedModel.latest_version || selectedProduct.latest_version;
      const verCmp = compareVersions(devInfo.fw, targetVer);
      if (verCmp >= 0 && !forceFlash) {
        await safeClosePort(port);
        updateProgress("Already Up to Date (Upload Skipped)", 100);
        logLine(`[MAICXEN EDGE] Version check: installed v${devInfo.fw} >= target v${targetVer}. Upload skipped.`);
        setStatus(
          "success",
          `${selectedProduct.product_name} (${devInfo.hw_id}) is already up to date on v${devInfo.fw} (target release: v${targetVer}). Upload skipped.`
        );
        return;
      }
      logLine(`[MAICXEN EDGE] Update eligible: v${devInfo.fw} -> v${targetVer}`);
    } else {
      logLine("[MAICXEN EDGE] No runtime telemetry detected (blank flash or legacy firmware).");
    }

    const prodSlug = String((devInfo && devInfo.product_id) || selectedProduct.product_id || "").toLowerCase();
    const minThr = USB_FOTA_MIN_VERSION[prodSlug] || [1, 0, 0];
    const meetsThreshold = devInfo && (devInfo.serial_ota === true || isVersionAtLeast(devInfo.fw, minThr[0], minThr[1], minThr[2]));
    const baseDir = `./firmware/${selectedProduct.product_id}/${selectedModel.model_id}`;
    const fwUrl = selectedModel.firmware_url || `${baseDir}/firmware.bin`;

    if (meetsThreshold) {
      modeBadgeEl.textContent = `Mode: Seamless USB-FOTA (v${devInfo.fw} -> v${selectedModel.latest_version})`;
      updateProgress("Downloading firmware binary for USB-FOTA...", 6);
      const fwRes = await fetch(`${fwUrl}?cb=${Date.now()}`, { cache: "no-store" });
      if (!fwRes.ok) throw new Error(`Failed to fetch ${fwUrl} (HTTP ${fwRes.status})`);
      const fwBytes = new Uint8Array(await fwRes.arrayBuffer());

      const fotaRes = await runNativeUsbFota({
        port,
        fwBytes,
        targetVer: selectedModel.latest_version,
        probeCtx: probe,
        productName: selectedProduct.product_name,
        modelName: selectedModel.model_name,
        logLine,
        updateProgress,
        setStatus
      });
      if (!fotaRes.ok) {
        if (fotaRes.wroteAnyChunk) {
          throw fotaRes.error || new Error("USB-FOTA transfer interrupted");
        }
        logLine("[MAICXEN EDGE] Native USB-FOTA unavailable — falling back to esptool-js Bootloader mode...");
        await runClassicEsptoolFlash({
          port,
          selectedProduct,
          selectedModel,
          espLoaderTerminal,
          logLine,
          updateProgress,
          setStatus,
          modeBadgeEl
        });
      }
    } else {
      await safeClosePort(port);
      logLine(
        devInfo
          ? `[MAICXEN EDGE] Installed v${devInfo.fw} < USB-FOTA threshold v${minThr.join(".")} -> using direct esptool-js upload.`
          : "[MAICXEN EDGE] Entering direct esptool-js Bootloader upload..."
      );
      await runClassicEsptoolFlash({
        port,
        selectedProduct,
        selectedModel,
        espLoaderTerminal,
        logLine,
        updateProgress,
        setStatus,
        modeBadgeEl
      });
    }
  } catch (err) {
    if (port) await safeClosePort(port);
    consoleDetails.open = true;
    renderIdleBitmap(true);
    logLine(`ERROR: ${err.message || err}`);
    setStatus("error", `Flash interrupted: ${err.message || err}`);
  } finally {
    flashBtn.disabled = false;
  }
});

// Init UI immediately in 0ms, then sync live catalog
modelSelectEl.addEventListener("change", () => selectModel(modelSelectEl.value));
document.getElementById("usbDiagBtn").addEventListener("click", usbDiag.toggleDiagnostics);

renderIdleBitmap();
const initParams = new URLSearchParams(window.location.search);
selectProduct(initParams.get("product") || "smarty", initParams.get("model") || null);
loadCatalog();

if (!("serial" in navigator)) {
  setStatus(
    "warning",
    "Mobile / Non-WebSerial Browser Detected: You can browse the MAICXEN EDGE product catalog and open the Fleet Console above. For physical USB cable flashing, open this page on desktop Chrome, Edge, or Opera."
  );
  flashBtn.disabled = true;
  document.getElementById("usbDiagBtn").disabled = true;
}
