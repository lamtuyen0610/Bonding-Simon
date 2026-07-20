const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Mỗi route trong ứng dụng chỉ dùng 1 trong 2 vai trò tại một thời điểm
// (Player mở /join.., Admin mở /admin..), nên ưu tiên token phù hợp với đường dẫn hiện tại.
function getToken(): string | null {
  const isAdminPath = window.location.pathname.startsWith("/admin");
  if (isAdminPath) {
    return localStorage.getItem("kn_admin_token") || localStorage.getItem("kn_team_token");
  }
  return localStorage.getItem("kn_team_token") || localStorage.getItem("kn_admin_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    throw new ApiError(body?.error || "Đã xảy ra lỗi. Vui lòng thử lại.", res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
