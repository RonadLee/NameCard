"use client";

import { useSession } from "./store";

const cacheKey = (path: string) => `namecard-cache:${path}`;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function refresh(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
  if (!res.ok) return false;
  const body = await res.json();
  useSession.getState().setSession(body);
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = useSession.getState().accessToken;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: "include" });
  } catch (error) {
    if (!init.method || init.method === "GET") {
      const cached = localStorage.getItem(cacheKey(path));
      if (cached) return JSON.parse(cached) as T;
    }
    throw error;
  }
  if (res.status === 401 && retry && !path.startsWith("/auth/login")) {
    const ok = await refresh().catch(() => false);
    if (ok) return api<T>(path, init, false);
    useSession.getState().logout();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      message = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message || message;
    } catch {
      /* response was not JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) return res as unknown as T;
  const data = (await res.json()) as T;
  if (!init.method || init.method === "GET") localStorage.setItem(cacheKey(path), JSON.stringify(data));
  return data;
}

export async function download(path: string, filename: string) {
  const token = useSession.getState().accessToken;
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
