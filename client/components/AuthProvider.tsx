import React, { useState, useEffect, useCallback, ReactNode } from "react";
import { AuthContext } from "@/hooks/useAuth";
import { storage, User } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await storage.getAuthToken();
      if (token) {
        const userData = await storage.getUser();
        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (accountNumber: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        accountNumber,
        password,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid account number or password");
      }

      const data = await response.json();

      const userData: User = {
        id: data.customerId,
        email: data.email || "",
        name: data.name || `Customer ${accountNumber}`,
        phone: data.phone || "",
        company: data.company || "",
        accountNumber: accountNumber,
      };

      await storage.setAuthToken(data.token);
      await storage.setUser(userData);
      setUser(userData);
    } catch (error: any) {
      console.error("Login failed:", error);
      throw new Error(error.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await storage.clearAuthData();
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
