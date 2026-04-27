import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthCredentials, AuthResponse } from "../types/auth";

const MOCK_USER = {
  email: "test@example.com",
  password: "password123",
};

const TOKEN_KEY = "auth_token";

export const authService = {
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (
          credentials.email === MOCK_USER.email &&
          credentials.password === MOCK_USER.password
        ) {
          const token = `token_${Date.now()}`;
          resolve({ token, success: true });
        } else {
          resolve({ token: "", success: false });
        }
      }, 1000);
    });
  },

  async storeToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
};
