export const getToken = () => localStorage.getItem('srg_token') || '';
export const setToken = t => (t ? localStorage.setItem('srg_token', t) : localStorage.removeItem('srg_token'));
export async function api(url, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(url, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken(), 'X-Lang': localStorage.getItem('srg_lang') || 'en' },
    });
    let data = {}; try { data = await res.json(); } catch { /* empty */ }
    return { ok: res.ok, status: res.status, data };
  } catch { return { ok: false, status: 0, data: { error: 'network' } }; }
}
