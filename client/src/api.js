
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const getToken = () => localStorage.getItem("srg_token") || "";

export const setToken = (t) =>
  t
    ? localStorage.setItem("srg_token", t)
    : localStorage.removeItem("srg_token");

export async function api(url, { method = "GET", body } = {}) {
  try {
    // Preserve absolute URLs; prefix relative API paths with the backend URL.
    const endpoint = /^https?:\/\//i.test(url)
      ? url
      : `${API_URL}/${url.replace(/^\/+/, "")}`;

    const res = await fetch(endpoint, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        "X-Lang": localStorage.getItem("srg_lang") || "en",
      },
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // Response has no JSON body.
    }

    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    console.error("API request failed:", error);
    return {
      ok: false,
      status: 0,
      data: { error: "network" },
    };
  }
}
