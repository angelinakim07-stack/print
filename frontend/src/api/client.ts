// API client: in-memory access token, secure refresh token, auto-refresh on 401.
import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const REFRESH_KEY = "ppc_refresh_token";

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function setRefreshToken(token: string | null) {
  if (token) await storage.secureSet(REFRESH_KEY, token);
  else await storage.secureRemove(REFRESH_KEY);
}

export async function getRefreshToken() {
  return storage.secureGet<string | null>(REFRESH_KEY, null);
}

type Options = RequestInit & { auth?: boolean };

async function doFetch(path: string, opts: Options = {}) {
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, { ...opts, headers });
}

async function rotate(): Promise<boolean> {
  const rt = await getRefreshToken();
  if (!rt) return false;
  const res = await doFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: rt }),
    auth: false,
  });
  if (!res.ok) {
    accessToken = null;
    await setRefreshToken(null);
    return false;
  }
  const data = await res.json();
  accessToken = data.access_token;
  await setRefreshToken(data.refresh_token);
  return true;
}

export class ApiError extends Error {
  status: number;
  detail: any;
  constructor(status: number, detail: any) {
    super(typeof detail === "string" ? detail : detail?.message || "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  let res = await doFetch(path, opts);
  if (res.status === 401 && opts.auth !== false) {
    refreshing ??= rotate().finally(() => (refreshing = null));
    const ok = await refreshing;
    if (ok) res = await doFetch(path, opts);
  }
  if (!res.ok) {
    let detail: any = null;
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : (res as any);
}

export const apiGet = <T = any>(p: string) => api<T>(p);
export const apiPost = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });

export async function uploadFile(uri: string, name: string, type: string, category: string, orderId?: string) {
  const form = new FormData();
  form.append("file", { uri, name, type } as any);
  form.append("category", category);
  if (orderId) form.append("order_id", orderId);
  return api<{ id: string; original_name: string; content_type: string; category: string; size: number }>(
    "/files",
    { method: "POST", body: form },
  );
}

export function fileDownloadUrl(id: string) {
  const t = accessToken ? `?token=${encodeURIComponent(accessToken)}` : "";
  return `${BASE}/files/${id}/download${t}`;
}

export { BASE };
