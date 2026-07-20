import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { connectSocket, disconnectSocket } from "../api/socket";

interface TeamInfo {
  id: string;
  name: string;
}

interface TeamAuthContextValue {
  team: TeamInfo | null;
  token: string | null;
  loading: boolean;
  join: (teamName: string, joinCode: string) => Promise<void>;
  logout: () => void;
}

const TeamAuthContext = createContext<TeamAuthContextValue | null>(null);

export function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("kn_team_token");
    const savedTeam = localStorage.getItem("kn_team_info");
    if (savedToken && savedTeam) {
      setToken(savedToken);
      setTeam(JSON.parse(savedTeam));
      connectSocket(savedToken);
    }
    setLoading(false);
  }, []);

  const join = useCallback(async (teamName: string, joinCode: string) => {
    const res = await api.post<{ token: string; team: TeamInfo }>("/auth/team/join", {
      teamName,
      joinCode,
    });
    localStorage.setItem("kn_team_token", res.token);
    localStorage.setItem("kn_team_info", JSON.stringify(res.team));
    setToken(res.token);
    setTeam(res.team);
    connectSocket(res.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kn_team_token");
    localStorage.removeItem("kn_team_info");
    setToken(null);
    setTeam(null);
    disconnectSocket();
  }, []);

  return (
    <TeamAuthContext.Provider value={{ team, token, loading, join, logout }}>
      {children}
    </TeamAuthContext.Provider>
  );
}

export function useTeamAuth() {
  const ctx = useContext(TeamAuthContext);
  if (!ctx) throw new Error("useTeamAuth phải được dùng bên trong TeamAuthProvider");
  return ctx;
}

export { ApiError };
