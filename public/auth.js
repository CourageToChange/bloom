"use strict";

// Bloom client auth. Google Sign-In via FedCM (works without third-party cookies,
// e.g. Incognito). We render our own clean button and post the Google credential
// to the server, which enforces the invite allowlist.
(function () {
  let gsiReady = false;
  let clientId = null;

  async function getJson(url, opts) {
    const r = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...(opts || {}) });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }

  async function getMe() {
    const { data } = await getJson("/auth/me");
    return { user: data.user || null, enforced: !!data.enforced };
  }

  function loadGsi() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts) return resolve();
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  const G_SVG = '<svg class="google-g" viewBox="0 0 48 48" aria-hidden="true">'
    + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
    + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
    + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
    + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

  async function renderSignIn(container, opts) {
    opts = opts || {};
    container.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "google-btn";
    btn.innerHTML = G_SVG + '<span>Sign in with Google</span>';
    container.appendChild(btn);

    const cfg = await getJson("/auth/config");
    clientId = cfg.data && cfg.data.googleClientId;
    if (clientId) {
      await loadGsi();
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: true,
          callback: async (resp) => {
            if (!resp || !resp.credential) return;
            const { status, data } = await getJson("/auth/google", { method: "POST", body: JSON.stringify({ credential: resp.credential }) });
            if (status === 200 && data.ok) { if (opts.onSuccess) opts.onSuccess(); }
            else if (opts.onError) opts.onError(data.error || "Sign-in failed.");
          }
        });
        gsiReady = true;
      }
    }
    btn.addEventListener("click", () => {
      if (gsiReady && window.google && google.accounts && google.accounts.id) google.accounts.id.prompt();
      else if (opts.onError) opts.onError("Sign-in isn't set up yet.");
    });
  }

  async function logout() { await getJson("/auth/logout", { method: "POST" }); location.reload(); }
  async function listInvites() { const { data } = await getJson("/admin/invites"); return data; }
  async function addInvite(email) { const { status, data } = await getJson("/admin/invites", { method: "POST", body: JSON.stringify({ email }) }); return { ok: status === 200 && data.ok, data }; }
  async function removeInvite(email) { const { data } = await getJson("/admin/invites", { method: "DELETE", body: JSON.stringify({ email }) }); return data; }

  window.BloomAuth = { getMe, renderSignIn, logout, listInvites, addInvite, removeInvite };
})();
