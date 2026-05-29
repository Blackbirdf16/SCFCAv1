import { http } from "./http";
import { Role, User } from "../types";

interface LoginInput {
  username: string;
  password: string;
  role: Role;
}

export const authService = {
  async login(input: LoginInput): Promise<User> {
    const response = await http.post("/api/v1/auth/login", {
      username: input.username,
      password: input.password,
      role: input.role
    });

    const payload = response.data ?? {};
    return {
      username: payload.username ?? input.username,
      role: payload.role ?? input.role,
      token: payload.token ?? "demo-token"
    };
  },

  async reauth(password: string): Promise<string> {
    const csrf = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("scfca_csrf="));
    const csrfToken = csrf ? decodeURIComponent(csrf.substring("scfca_csrf=".length)) : null;
    const response = await http.post(
      "/api/v1/auth/reauth",
      { password },
      { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined }
    );
    return response.data?.reauthToken;
  }
};
