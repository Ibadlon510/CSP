const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function handle401() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    // Use soft redirect via Next.js router instead of hard page reload
    window.dispatchEvent(new Event("auth:logout"));
  }
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && e.message === "Failed to fetch") return true;
  if (e instanceof Error && /network|connection|refused/i.test(e.message)) return true;
  return false;
}

const CONNECTION_MSG =
  "Cannot reach the backend. Run ./stop then ./start in the project folder, wait ~30 seconds, then open http://localhost:3000";

async function request(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (e) {
    if (isNetworkError(e)) throw new Error(CONNECTION_MSG);
    throw e;
  }

  if (res.status === 401) {
    handle401();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const message = Array.isArray(detail)
      ? detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join("; ")
      : typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "msg" in detail
          ? String((detail as { msg?: string }).msg)
          : `API error ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }
  return res.json();
}

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, data: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(data) }),
  put: (path: string, data: unknown) =>
    request(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: (path: string, data: unknown) =>
    request(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path: string) => request(path, { method: "DELETE" }),
  getBlob: (path: string) => fetchWithAuth(path).then((r) => {
    if (r.status === 401) {
      handle401();
      throw new Error("Unauthorized");
    }
    if (!r.ok) throw new Error("Download failed");
    return r.blob();
  }),
  postForm: (path: string, formData: FormData) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { method: "POST", body: formData, headers }).then(async (r) => {
      if (r.status === 401) {
        handle401();
      }
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { detail?: unknown };
        const d = b.detail;
        const msg = Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join("; ") : typeof d === "string" ? d : d && typeof d === "object" && "msg" in d ? String((d as { msg?: string }).msg) : "Upload failed";
        throw new Error(msg);
      }
      return r.json();
    });
  },
};
