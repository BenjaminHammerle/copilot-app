import { ValidationError } from "../types/auth";

export const validateEmail = (email: string): ValidationError | null => {
  if (!email) {
    return { field: "email", message: "Email is required" };
  }
  if (!email.includes("@")) {
    return { field: "email", message: "Email must contain @" };
  }
  return null;
};

export const validatePassword = (password: string): ValidationError | null => {
  if (!password) {
    return { field: "password", message: "Password is required" };
  }
  if (password.length < 6) {
    return {
      field: "password",
      message: "Password must be at least 6 characters",
    };
  }
  return null;
};
