import React, { useEffect, useState } from "react";
import { HomeScreen } from "../../src/screens/HomeScreen";
import { LoginScreen } from "../../src/screens/LoginScreen";
import { authService } from "../../src/services/authService";

export default function HomeTab() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const token = await authService.getToken();
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return <HomeScreen onLogout={() => setIsLoggedIn(false)} />;
}
