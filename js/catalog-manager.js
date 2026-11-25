import { supabase, dashboardState } from "./supabase-client.js";
import { inferProductId } from "../shared/js/version.js";

export function getTargetVersionForDevice(dev) {
  const prodId = inferProductId(dev);
  const anyProd = dashboardState.productCatalog.find((c) => c.product_id === prodId);
  if (anyProd && anyProd.latest_version) return anyProd.latest_version;
  return dev.fw || "1.0.0";
}

export function editCatalogEntry(prodId, modId) {
  const row = dashboardState.productCatalog.find(
    (c) => c.product_id === prodId && c.model_id === modId
  );
  if (!row) return;
  document.getElementById("catProdId").value = row.product_id || "";
  document.getElementById("catProdName").value = row.product_name || "";
  document.getElementById("catModelId").value = row.model_id || "";
  document.getElementById("catModelName").value = row.model_name || "";
  document.getElementById("catChip").value = row.chip || "ESP32-S3";
  document.getElementById("catHwRev").value = row.hw_rev || "1.0";
  document.getElementById("catVersion").value = row.latest_version || "1.0.0";
  document.getElementById("catCaps").value = Array.isArray(row.capabilities)
    ? row.capabilities.join(",")
    : "";
  document.getElementById("catNotes").value = row.release_notes || row.description || "";
  const box = document.getElementById("adminCatalogBox");
  if (box) {
    box.open = true;
    box.scrollIntoView({ behavior: "smooth" });
  }
}

export async function loadProductCatalog(onAfterRender) {
  const { data: sbRows } = await supabase
    .from("product_catalog")
    .select("*")
    .order("product_id", { ascending: true });

  // Merge live catalog.json (always synced with compiled firmware releases & emblems) over Supabase rows
  let catalogRows = Array.isArray(sbRows) ? [...sbRows] : [];
  try {
    const res = await fetch(`./catalog.json?cb=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const cat = await res.json();
      if (Array.isArray(cat.products) && cat.products.length > 0) {
        const byKey = new Map(catalogRows.map((r) => [`${r.product_id}::${r.model_id}`, r]));
        cat.products.forEach((prod) => {
          (prod.models || []).forEach((m) => {
            const key = `${prod.product_id}::${m.model_id}`;
            const prev = byKey.get(key) || {};
            byKey.set(key, {
              ...prev,
              product_id: prod.product_id,
              product_name: prod.product_name,
              model_id: m.model_id,
              model_name: m.model_name,
              chip: m.chip || prev.chip || "ESP32-S3",
              hw_rev: m.hw_rev || prev.hw_rev || "1.0",
              emblem: m.emblem || prod.emblem || `./shared/assets/emblems/edge-${prod.product_id}-${m.model_id}-emblem.webp`,
              latest_version: m.latest_version || prod.latest_version || prev.latest_version || "1.0.0",
              capabilities: Array.isArray(m.capabilities) && m.capabilities.length ? m.capabilities : (prev.capabilities || []),
              release_notes: m.notes || prev.release_notes || prev.description || "",
              description: m.notes || prev.description || ""
            });
          });
        });
        catalogRows = Array.from(byKey.values()).sort((a, b) =>
          String(a.product_id).localeCompare(String(b.product_id))
        );
      }
    }
  } catch {
    // Keep Supabase rows if catalog.json fetch fails
  }

  const data = catalogRows;
  if (data) {
    dashboardState.productCatalog = data;

    const pf = document.getElementById("productFilter");
    const curVal = pf.value || "all";
    const uniqueProds = {};
    data.forEach((r) => {
      uniqueProds[r.product_id] = r.product_name;
    });
    pf.innerHTML =
      `<option value="all">All Products (${Object.values(uniqueProds).join(", ") || "All"})</option>` +
      Object.entries(uniqueProds)
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join("");
    pf.value = uniqueProds[curVal] ? curVal : "all";

    const summary = Object.entries(uniqueProds)
      .map(([id, name]) => {
        const m = data.find((x) => x.product_id === id);
        return `${name}: v${m ? m.latest_version : "1.0.0"}`;
      })
      .join(" · ");
    if (summary) document.getElementById("latestFwPill").textContent = summary;

    const tbody = document.getElementById("catalogTableBody");
    if (tbody) {
      const isAdmin = ["owner", "admin"].includes(dashboardState.currentProfile?.role || "");
      tbody.innerHTML = data
        .map((row) => {
          const capsList = Array.isArray(row.capabilities) ? row.capabilities : [];
          const capsTitle = capsList.join(", ");
          const emblemSrc =
            row.emblem ||
            `./shared/assets/emblems/edge-${String(row.product_id).toLowerCase()}-${String(row.model_id).toLowerCase()}-emblem.webp`;
          const notesSafe = String(row.release_notes || row.description || "No release notes provided.")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          return `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <img
                    src="${emblemSrc}"
                    alt="${row.product_name} emblem"
                    width="34"
                    height="34"
                    style="width:34px;height:34px;border-radius:9px;object-fit:contain;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.14);padding:2px;flex-shrink:0;"
                    onerror="this.style.display='none'"
                  />
                  <div>
                    <strong>${row.product_name}</strong><br>
                    <code>${row.product_id}</code>
                  </div>
                </div>
              </td>
              <td>
                <strong>${row.model_name}</strong><br>
                <code>${row.model_id}</code>
              </td>
              <td>
                <span class="pill cyan">${row.chip}</span>
                <span style="font-size:11.5px;color:var(--apple-text-tertiary);margin-left:4px;">Rev ${row.hw_rev}</span>
              </td>
              <td>
                <div class="ver-popover-wrap" tabindex="0">
                  <span class="pill green" style="cursor:pointer;">v${row.latest_version} ⓘ</span>
                  <div class="ver-popover-box">${notesSafe}</div>
                </div>
              </td>
              <td>
                <span class="pill muted" title="${capsTitle}">${capsList.length} features</span>
              </td>
              <td style="text-align:right;">
                <div class="row-inline" style="justify-content:flex-end;">
                  <a href="https://iot.maicxen.it/?product=${encodeURIComponent(row.product_id)}&model=${encodeURIComponent(
            row.model_id
          )}" class="pill-btn">Flash ↗</a>
                  ${
                    isAdmin
                      ? `<button type="button" class="pill-btn" onclick="editCatalogEntry('${row.product_id}','${row.model_id}')">Edit</button>`
                      : ""
                  }
                  ${
                    isAdmin
                      ? `<button type="button" class="pill-btn danger" onclick="deleteCatalogEntry('${row.id}')">Delete</button>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }
    if (onAfterRender) onAfterRender();
  }
}

export async function saveCatalogEntry(onAfterRender) {
  if (dashboardState.currentProfile?.role !== "admin") return;
  const product_id = document.getElementById("catProdId").value.trim().toLowerCase();
  const product_name = document.getElementById("catProdName").value.trim();
  const model_id = document.getElementById("catModelId").value.trim().toLowerCase();
  const model_name = document.getElementById("catModelName").value.trim();
  const chip = document.getElementById("catChip").value.trim() || "ESP32-S3";
  const hw_rev = document.getElementById("catHwRev").value.trim() || "1.0";
  const latest_version = document.getElementById("catVersion").value.trim() || "1.0.0";
  const capabilities = document
    .getElementById("catCaps")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const release_notes = document.getElementById("catNotes").value.trim();

  if (!product_id || !product_name || !model_id || !model_name) {
    alert("Please fill in Product ID, Product Name, Model ID, and Model Title.");
    return;
  }

  const base = `https://iot.maicxen.it/firmware/${product_id}/${model_id}`;
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("product_catalog").upsert(
    {
      product_id,
      product_name,
      model_id,
      model_name,
      chip,
      hw_rev,
      latest_version,
      firmware_url: `${base}/firmware.bin`,
      bootloader_url: `${base}/bootloader.bin`,
      partitions_url: `${base}/partitions.bin`,
      boot_app0_url: `${base}/boot_app0.bin`,
      version_url: `${base}/version.json`,
      capabilities,
      description: release_notes,
      release_notes,
      is_public: true,
      updated_at: nowIso
    },
    { onConflict: "product_id,model_id" }
  );

  if (error) {
    alert("Catalog error: " + error.message);
  } else {
    await supabase
      .from("product_catalog")
      .update({ latest_version, updated_at: nowIso })
      .eq("product_id", product_id);
    await loadProductCatalog(onAfterRender);
  }
}

export async function deleteCatalogEntry(id, onAfterRender) {
  if (dashboardState.currentProfile?.role !== "admin") return;
  if (!confirm("Delete this product variant from the catalog?")) return;
  await supabase.from("product_catalog").delete().eq("id", id);
  await loadProductCatalog(onAfterRender);
}
