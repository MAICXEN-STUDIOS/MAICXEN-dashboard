import { supabase, dashboardState } from "./supabase-client.js";
import { applyRolePermissionsUI } from "./auth-rbac.js";
import { renderFleet, upsertDeviceToSupabase } from "./fleet-view.js";

export async function loadUsersList() {
  const myRole = dashboardState.currentProfile?.role || "viewer";
  if (myRole !== "admin" && myRole !== "owner") return;
  const { data: users } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: true });
  const { data: invites } = await supabase
    .from("role_invites")
    .select("*")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const tbody = document.getElementById("usersTableBody");
  let html = "";

  if (users) {
    html += users
      .map((u) => {
        const initial = (u.username || u.email || "U")[0].toUpperCase();
        const avHtml = u.avatar_url
          ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;" />`
          : initial;
        const isSelf = u.id === dashboardState.currentUser.id;
        const isProtectedOwner = u.role === "owner" && myRole !== "owner";
        const locked = isSelf || isProtectedOwner;
        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="avatar-img" style="width:32px;height:32px;">${avHtml}</div>
                <div>
                  <strong>${u.username || u.full_name || "User"}</strong><br>
                  <span style="color:var(--muted-dash);font-size:11.5px;">${u.email}</span>
                </div>
              </div>
            </td>
            <td>
              <select class="apple-select" style="width:auto;min-width:120px;" onchange="changeUserRole('${u.id}', this.value)" ${
          locked ? "disabled" : ""
        }>
                <option value="viewer" ${u.role === "viewer" ? "selected" : ""}>Viewer (L1)</option>
                <option value="editor" ${u.role === "editor" ? "selected" : ""}>Editor (L2)</option>
                <option value="manager" ${u.role === "manager" ? "selected" : ""}>Manager (L3)</option>
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin (L4)</option>
                ${
                  u.role === "owner" || myRole === "owner"
                    ? `<option value="owner" ${u.role === "owner" ? "selected" : ""}>Owner (L5)</option>`
                    : ""
                }
              </select>
            </td>
            <td>
              <span class="pill ${u.is_active ? "green" : "red"}">${u.is_active ? "Active" : "Suspended"}</span>
              ${
                !u.is_active && u.ban_reason
                  ? `<div style="font-size:11px;color:var(--apple-text-secondary);margin-top:3px;">${u.ban_reason}</div>`
                  : ""
              }
            </td>
            <td class="mono">${new Date(u.created_at).toLocaleDateString("en-GB")}</td>
            <td style="text-align:right;">
              ${
                !locked
                  ? `<button type="button" class="pill-btn ${u.is_active ? "danger" : "primary"}" onclick="toggleUserBan('${
                      u.id
                    }', ${u.is_active})">${u.is_active ? "Suspend" : "Reactivate"}</button>`
                  : `<span style="color:var(--apple-text-tertiary);font-size:12px;">${isSelf ? "Current Session" : "Protected Owner"}</span>`
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  if (invites && invites.length > 0) {
    html += invites
      .map((inv) => {
        const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
        const inviteUrl = `${window.location.origin}${window.location.pathname}?mode=signup&email=${encodeURIComponent(inv.email)}`;
        return `
          <tr>
            <td>
              <strong>${inv.email}</strong><br>
              <span style="color:${expired ? "var(--red)" : "var(--amber)"};font-size:11px;">${
                expired ? "Invite Expired" : "Pre-authorized (Pending user registration)"
              }${inv.console_enabled ? ` · Console: ${(inv.console_divisions || []).join(", ") || "enabled"}` : ""}</span>
            </td>
            <td><span class="pill cyan">${inv.role}</span></td>
            <td><span class="pill ${expired ? "red" : "amber"}">${expired ? "Expired" : "Invited"}</span></td>
            <td class="mono">${new Date(inv.created_at).toLocaleDateString("en-GB")}</td>
            <td style="text-align:right;">
              <div style="display:inline-flex;gap:6px;">
                <button type="button" class="pill-btn" onclick="navigator.clipboard.writeText('${inviteUrl}');alert('Registration link copied for ${inv.email}')">Copy Link</button>
                <button type="button" class="pill-btn danger" onclick="deleteRoleInvite('${inv.email}')">Revoke</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  tbody.innerHTML = html || "<tr><td colspan='5' style='color:var(--muted-dash)'>No users found.</td></tr>";
}

export async function changeUserRole(userId, newRole) {
  const { error } = await supabase
    .from("user_profiles")
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) alert("Error: " + error.message);
  else await loadUsersList();
}

export async function toggleUserBan(userId, currentlyActive) {
  let reason = "";
  if (currentlyActive) {
    const r = prompt("Optional reason for temporarily blocking this user:", "Suspended by Administrator");
    if (r === null) return;
    reason = r.trim();
  }
  const { error } = await supabase
    .from("user_profiles")
    .update({
      is_active: !currentlyActive,
      ban_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);
  if (error) alert("Error: " + error.message);
  else await loadUsersList();
}

export async function assignRoleByEmail() {
  const email = document.getElementById("inviteEmailInput").value.trim().toLowerCase();
  const role = document.getElementById("inviteRoleSelect").value;
  if (!email) return;

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing && existing.id) {
    await changeUserRole(existing.id, role);
  } else {
    const expiresAt = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
    let { error } = await supabase.from("role_invites").upsert({
      email,
      role,
      expires_at: expiresAt,
      accepted_at: null,
      invited_by: dashboardState.currentUser.id
    });
    if (error && error.message.includes("column")) {
      const retry = await supabase.from("role_invites").upsert({
        email,
        role: role === "manager" ? "editor" : role,
        accepted_at: null,
        invited_by: dashboardState.currentUser.id
      });
      error = retry.error;
    }
    if (error) alert("Error: " + error.message);
  }
  document.getElementById("inviteEmailInput").value = "";
  await loadUsersList();
}

export async function deleteRoleInvite(email) {
  await supabase.from("role_invites").delete().eq("email", email);
  await loadUsersList();
}

export async function saveProfileUsername() {
  const uname = document.getElementById("profileUsernameInput").value.trim();
  if (!uname || !dashboardState.currentUser) return;
  const { error } = await supabase
    .from("user_profiles")
    .update({ username: uname, full_name: uname, updated_at: new Date().toISOString() })
    .eq("id", dashboardState.currentUser.id);
  if (error) {
    alert("Error saving username: " + error.message);
  } else {
    dashboardState.currentProfile.username = uname;
    applyRolePermissionsUI();
    alert("Username updated!");
  }
}

async function resizeImageToBlob(file, maxDim = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = maxDim;
      canvas.height = maxDim;
      const ctx = canvas.getContext("2d");
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxDim, maxDim);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.86);
    };
    reader.readAsDataURL(file);
  });
}

export async function handleAvatarUpload(ev) {
  const file = ev.target.files[0];
  if (!file || !dashboardState.currentUser) return;
  try {
    const jpegBlob = await resizeImageToBlob(file, 256);
    const filePath = `${dashboardState.currentUser.id}/avatar.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, jpegBlob, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;

    const { data: pubData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = `${pubData.publicUrl}?t=${Date.now()}`;

    const { error: dbErr } = await supabase
      .from("user_profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", dashboardState.currentUser.id);
    if (dbErr) throw dbErr;

    dashboardState.currentProfile.avatar_url = publicUrl;
    applyRolePermissionsUI();
  } catch (err) {
    alert("Avatar upload failed: " + (err.message || err));
  }
}

export async function updateMyPassword() {
  const curPassword = document.getElementById("curPassInput").value;
  const newPassword = document.getElementById("newPassInput").value;
  const confPassword = document.getElementById("confPassInput").value;

  if (!curPassword) {
    alert("Please enter your current password.");
    return;
  }
  if (!newPassword || newPassword.length < 6) {
    alert("New password must be at least 6 characters.");
    return;
  }
  if (newPassword !== confPassword) {
    alert("New password and confirmation do not match.");
    return;
  }

  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: dashboardState.currentProfile.email,
    password: curPassword
  });
  if (verifyErr) {
    alert("Verification Failed: Your current password is incorrect.");
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    alert("Error updating password: " + error.message);
  } else {
    document.getElementById("curPassInput").value = "";
    document.getElementById("newPassInput").value = "";
    document.getElementById("confPassInput").value = "";
    alert("Password verified and updated successfully!");
  }
}

export function exportRegistry() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          fleetRegistry: dashboardState.fleetRegistry,
          eventLogs: dashboardState.eventLogs
        },
        null,
        2
      )
    ],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `maicxen-edge-fleet-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

export async function importRegistry(ev) {
  if (dashboardState.currentProfile?.role !== "admin") return;
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.fleetRegistry) {
        for (const dev of Object.values(data.fleetRegistry)) {
          dashboardState.fleetRegistry[dev.hw_id] = dev;
          await upsertDeviceToSupabase(dev);
        }
      }
      renderFleet();
    } catch (_) {
      alert("Invalid JSON backup file.");
    }
  };
  reader.readAsText(f);
}
