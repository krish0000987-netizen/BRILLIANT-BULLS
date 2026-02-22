import { createContext, useContext } from "react";
import { useAuth as useAuthHook } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: { username: string; password: string }) => Promise<User>;
  loginError: string | null;
  isLoggingIn: boolean;
  logout: () => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthHook();

  return (
    <AuthContext.Provider value={{
      user: auth.user ?? null,
      isLoading: auth.isLoading,
      login: auth.login,
      loginError: auth.loginError,
      isLoggingIn: auth.isLoggingIn,
      logout: auth.logout,
      isLoggingOut: auth.isLoggingOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
