import { supabase, dashboardState } from "./supabase-client.js";

function renderAvatarElement(el, profile) {
  if (!el) return;
  const initials = (profile?.username || profile?.email || "U")[0].toUpperCase();
  if (profile?.avatar_url) {
    el.innerHTML = `<img src="${profile.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;" />`;
  } else {
    el.textContent = initials;
  }
}

export function showAuthAlert(msg, type = "err") {
  const el = document.getElementById("authFeedback");
  el.className = `auth-alert ${type}`;
  el.textContent = msg;
}

export function setAuthMode(mode, btnEl = null) {
  dashboardState.authMode = mode;
  document.getElementById("authFeedback").className = "auth-alert";
  if (btnEl) {
    document.querySelectorAll(".auth-mode-tab").forEach((b) => b.classList.remove("active"));
    btnEl.classList.add("active");
  }
  const userWrap = document.getElementById("usernameFieldWrap");
  const emailWrap = document.getElementById("emailFieldWrap");
  const passWrap = document.getElementById("passFieldWrap");
  const passInput = document.getElementById("authPass");
  const userInput = document.getElementById("authUsername");
  const submitBtn = document.getElementById("authSubmitBtn");
  const passLabel = document.getElementById("passFieldLabel");

  if (mode === "login") {
    userWrap.style.display = "none";
    userInput.required = false;
    emailWrap.style.display = "flex";
    passWrap.style.display = "flex";
    passInput.required = true;
    passLabel.textContent = "Password";
    submitBtn.textContent = "Sign In to Dashboard";
  } else if (mode === "signup") {
    userWrap.style.display = "flex";
    userInput.required = true;
    emailWrap.style.display = "flex";
    passWrap.style.display = "flex";
    passInput.required = true;
    passLabel.textContent = "Create Password (min. 6 characters)";
    submitBtn.textContent = "Complete Authorized Registration";
  } else if (mode === "reset") {
    userWrap.style.display = "none";
    userInput.required = false;
    emailWrap.style.display = "flex";
    passWrap.style.display = "none";
    passInput.required = false;
    submitBtn.textContent = "Send Password Recovery Email";
  } else if (mode === "update_password") {
    document.getElementById("authTabs").style.display = "none";
    userWrap.style.display = "none";
    emailWrap.style.display = "none";
    passWrap.style.display = "flex";
    passInput.required = true;
    passLabel.textContent = "Enter New Password";
    submitBtn.textContent = "Save New Password";
  }
}

export function applyRolePermissionsUI() {
  const profile = dashboardState.currentProfile;
  const role = profile?.role || "viewer";
  const isEditorOrAdmin = role === "editor" || role === "admin";
  const isAdmin = role === "admin";

  const badge = document.getElementById("userRoleBadge");
  badge.textContent = role.toUpperCase();
  badge.className = "pill " + (isAdmin ? "purple" : isEditorOrAdmin ? "cyan" : "amber");

  const displayName =
    profile?.username || profile?.full_name || profile?.email.split("@")[0] || "User";
  document.getElementById("navUsername").textContent = displayName;
  document.getElementById("profileUsernameInput").value = displayName;
  document.getElementById("profileEmailInfo").textContent = `${profile?.email} • Role: ${role.toUpperCase()}`;

  renderAvatarElement(document.getElementById("navAvatarBox"), profile);
  renderAvatarElement(document.getElementById("profileAvatarPreview"), profile);

  document.getElementById("navUsersBtn").style.display = isAdmin ? "inline-flex" : "none";

  document.querySelectorAll(".role-editor").forEach((el) => {
    el.disabled = !isEditorOrAdmin;
  });
  document.querySelectorAll(".role-admin").forEach((el) => {
    el.disabled = !isAdmin;
    if (el.tagName === "BUTTON") {
      el.style.display = isAdmin ? "inline-flex" : "none";
    }
  });
}

export async function handleAuthSubmit(e, onBootSession) {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim().toLowerCase();
  const password = document.getElementById("authPass").value;
  const username = document.getElementById("authUsername").value.trim();
  const btn = document.getElementById("authSubmitBtn");
  btn.disabled = true;

  try {
    if (dashboardState.authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const { data: invite } = await supabase
          .from("role_invites")
          .select("email, role, accepted_at")
          .ilike("email", email)
          .maybeSingle();

        if (invite && !invite.accepted_at) {
          setAuthMode("signup", document.getElementById("tabBtnSignup"));
          document.getElementById("authEmail").value = email;
          showAuthAlert(
            `First-Time Access Denied: Your email (${email}) has been pre-authorized by the Administrator with role "${invite.role.toUpperCase()}". Please complete your registration below by choosing a username and password.`,
            "warn"
          );
          return;
        }
        if (!invite && error.message.includes("Invalid login credentials")) {
          throw new Error(
            "Sign-in denied: invalid credentials, or your email has not been authorized by the Administrator. Please contact the Administrator."
          );
        }
        throw error;
      }
    } else if (dashboardState.authMode === "signup") {
      const { data: invite } = await supabase
        .from("role_invites")
        .select("email, role, accepted_at")
        .ilike("email", email)
        .maybeSingle();

      if (!invite) {
        throw new Error(
          "Registration Denied: Your email address has not been pre-authorized by the Administrator. Please contact the Administrator to request access."
        );
      }
      if (invite.accepted_at) {
        throw new Error("This email address is already registered. Please sign in or use Password Recovery.");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: username },
          emailRedirectTo: window.location.href
        }
      });
      if (error) {
        if (error.message.includes("SM_NOT_INVITED")) {
          throw new Error(
            "Registration Denied: Your email address has not been authorized by the Administrator. Please contact the Administrator."
          );
        }
        throw error;
      }

      if (data.session) {
        showAuthAlert(`Account activated with role ${invite.role.toUpperCase()}!`, "ok");
      } else {
        showAuthAlert(
          `Registration submitted (Assigned Role: ${invite.role.toUpperCase()})! Please check your inbox (${email}) and click the confirmation link from Supabase to activate your account.`,
          "ok"
        );
      }
    } else if (dashboardState.authMode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href
      });
      if (error) throw error;
      showAuthAlert("Password recovery email sent! Click the link in your email to set a new password.", "ok");
    } else if (dashboardState.authMode === "update_password") {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      document.getElementById("authTabs").style.display = "grid";
      showAuthAlert("Password updated successfully!", "ok");
      await onBootSession();
    }
  } catch (err) {
    showAuthAlert(err.message || "Authentication error", "err");
  } finally {
    btn.disabled = false;
  }
}

export async function logoutUser() {
  await supabase.auth.signOut();
  location.reload();
}
