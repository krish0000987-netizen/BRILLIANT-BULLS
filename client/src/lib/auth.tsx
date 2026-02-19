import { createContext, useContext } from "react";
import { useAuth as useReplitAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, isLoggingOut } = useReplitAuth();

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, logout, isLoggingOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
