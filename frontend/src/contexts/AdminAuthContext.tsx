import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api } from "../api/client";
import { connectSocket, disconnectSocket } from "../api/socket";

interface AdminInfo {
  id: string;
  username: string;
  displayName: string;
}

interface AdminAuthContextValue {
  admin: AdminInfo | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("kn_admin_token");
    const savedAdmin = localStorage.getItem("kn_admin_info");
    if (savedToken && savedAdmin) {
      setToken(savedToken);
      setAdmin(JSON.parse(savedAdmin));
      connectSocket(savedToken);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token: string; admin: AdminInfo }>("/auth/admin/login", {
      username,
      password,
    });
    localStorage.setItem("kn_admin_token", res.token);
    localStorage.setItem("kn_admin_info", JSON.stringify(res.admin));
    setToken(res.token);
    setAdmin(res.admin);
    connectSocket(res.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kn_admin_token");
    localStorage.removeItem("kn_admin_info");
    setToken(null);
    setAdmin(null);
    disconnectSocket();
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, token, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth phải được dùng bên trong AdminAuthProvider");
  return ctx;
}
