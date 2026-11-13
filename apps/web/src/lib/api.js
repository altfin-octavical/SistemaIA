const API = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'geointel_token';

export const getToken = () => (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof location !== 'undefined' && !location.pathname.startsWith('/login')) {
    clearToken();
    location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
