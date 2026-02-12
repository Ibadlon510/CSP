"use client";

import { api } from "./api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  org_id: string | null;
  org_name: string | null;
}

export async function login(email: string, password: string): Promise<string> {
  const data = await api.post("/api/auth/login", { email, password });
  localStorage.setItem("token", data.access_token);
  return data.access_token;
}

export async function register(
  email: string,
  password: string,
  full_name: string,
  org_name?: string
): Promise<string> {
  const data = await api.post("/api/auth/register", {
    email,
    password,
    full_name,
    org_name: org_name || null,
  });
  localStorage.setItem("token", data.access_token);
  return data.access_token;
}

export async function getMe(): Promise<User> {
  return api.get("/api/auth/me");
}

export function logout() {
  localStorage.removeItem("token");
  // Use soft redirect via custom event (caught by layout) instead of hard page reload
  window.dispatchEvent(new Event("auth:logout"));
}

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}

export async function forgotPassword(email: string): Promise<string> {
  const data = await api.post("/api/auth/forgot-password", { email });
  return data.message;
}

export async function resetPassword(token: string, new_password: string): Promise<string> {
  const data = await api.post("/api/auth/reset-password", { token, new_password });
  return data.message;
}
