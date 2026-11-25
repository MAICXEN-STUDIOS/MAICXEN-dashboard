import { supabase, dashboardState } from "./supabase-client.js";
import {
  showAuthAlert,
  setAuthMode,
  handleAuthSubmit,
  logoutUser,
  applyRolePermissionsUI
} from "./auth-rbac.js";
import {
  loadProductCatalog,
  saveCatalogEntry,
  deleteCatalogEntry,
  editCatalogEntry
} from "./catalog-manager.js";
import { loadEventsFromSupabase, renderEventLogs, clearEventLog, exportEventLog } from "./activity-log.js";
import {
  renderFleet,
  loadDevicesFromSupabase,
  populateModal,
  probeLocalDevice,
  connectRealtimeStream,
  renameCurrentDevice,
  removeCurrentDevice,
  triggerRemoteFota,
  saveSmartySinricId
} from "./fleet-view.js";
import {
  loadUsersList,
  changeUserRole,
  toggleUserBan,
  assignRoleByEmail,
  deleteRoleInvite,
  saveProfileUsername,
  removeMyAvatar,
  updateMyEmail,
  logoutAllDevices,
  handleAvatarUpload,
  updateMyPassword,
  exportRegistry,
  importRegistry
} from "./user-profile-admin.js";

function openDeviceModal(hwId, ev = null) {
  if (ev) ev.stopPropagation();
  dashboardState.selectedHwId = hwId;
  populateModal(hwId);
  applyRolePermissionsUI();
  document.getElementById("deviceModal").classList.add("open");
}

function closeDeviceModal() {
  dashboardState.selectedHwId = null;
  document.getElementById("deviceModal").classList.remove("open");
}

function switchSection(secId, btnEl) {
  const role = dashboardState.currentProfile?.role || "viewer";
  const isAdmin = ["owner", "admin"].includes(role);
  const isEditorOrAdmin = isAdmin || ["manager", "editor"].includes(role);
  if (secId === "users" && !isAdmin) return;
  if (secId === "actions" && !isEditorOrAdmin) return;
  document.querySelectorAll(".section-view").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
  document.getElementById("sec-" + secId).classList.add("active");
  if (btnEl) btnEl.classList.add("active");
  if (secId === "users") loadUsersList();
  if (secId === "catalog") loadProductCatalog(renderFleet);
}

function switchModalTab(paneId, btnEl) {
  document.querySelectorAll(".modal-pane").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".modal-tab").forEach((b) => b.classList.remove("active"));
  document.getElementById("mpane-" + paneId).classList.add("active");
  btnEl.classList.add("active");
}

async function bootAuthenticatedSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session || !session.user) {
    document.getElementById("authOverlay").style.display = "flex";
    document.getElementById("appWrap").style.display = "none";
    return;
  }

  dashboardState.currentUser = session.user;

  const { data: profile, error: profErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", dashboardState.currentUser.id)
    .single();

  if (profErr || !profile) {
    await supabase.auth.signOut();
    showAuthAlert("Access Denied: Your profile was not found. Please contact the Administrator.", "err");
    return;
  }

  if (!profile.is_active) {
    const reason = profile.ban_reason ? ` Reason: "${profile.ban_reason}".` : "";
    await supabase.auth.signOut();
    document.getElementById("authOverlay").style.display = "flex";
    document.getElementById("appWrap").style.display = "none";
    showAuthAlert(
      `Account Temporarily Blocked: Your account has been temporarily suspended by the Administrator.${reason} Please contact the Administrator for assistance.`,
      "err"
    );
    return;
  }

  dashboardState.currentProfile = profile;
  document.getElementById("authOverlay").style.display = "none";
  document.getElementById("appWrap").style.display = "block";

  applyRolePermissionsUI();
  await loadProductCatalog(renderFleet);
  await loadDevicesFromSupabase();
  await loadEventsFromSupabase();
  connectRealtimeStream();
}

async function syncWithCloudAndDb() {
  await loadProductCatalog(renderFleet);
  await loadDevicesFromSupabase();
  await loadEventsFromSupabase();
}

function quickFilterFleet(statusVal) {
  const devicesTab = document.querySelector(".nav-tab");
  switchSection("devices", devicesTab);
  const sf = document.getElementById("statusFilter");
  if (sf) sf.value = statusVal || "all";
  renderFleet();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDeviceModal();
});

// Expose DOM event handlers for declarative HTML bindings
Object.assign(window, {
  setAuthMode,
  handleAuthSubmit: (e) => handleAuthSubmit(e, bootAuthenticatedSession),
  logoutUser,
  switchSection,
  switchModalTab,
  renderFleet,
  quickFilterFleet,
  syncWithCloudAndDb,
  openDeviceModal,
  closeDeviceModal,
  renameCurrentDevice,
  removeCurrentDevice: () => removeCurrentDevice(closeDeviceModal),
  triggerRemoteFota,
  saveSmartySinricId,
  probeLocalDevice: () => probeLocalDevice(openDeviceModal),
  loadProductCatalog: () => loadProductCatalog(renderFleet),
  saveCatalogEntry: () => saveCatalogEntry(renderFleet),
  deleteCatalogEntry: (id) => deleteCatalogEntry(id, renderFleet),
  editCatalogEntry,
  renderEventLogs,
  exportEventLog,
  clearEventLog,
  loadUsersList,
  changeUserRole,
  toggleUserBan,
  assignRoleByEmail,
  deleteRoleInvite,
  saveProfileUsername,
  removeMyAvatar,
  updateMyEmail,
  logoutAllDevices,
  handleAvatarUpload,
  updateMyPassword,
  exportRegistry,
  importRegistry
});

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    document.getElementById("authOverlay").style.display = "flex";
    document.getElementById("appWrap").style.display = "none";
    setAuthMode("update_password");
  } else if (event === "SIGNED_IN") {
    bootAuthenticatedSession();
  }
});

bootAuthenticatedSession();
setInterval(() => {
  if (dashboardState.currentUser) loadDevicesFromSupabase();
}, 10000);
