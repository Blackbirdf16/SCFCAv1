import { http } from "./http";
import { ChatMessage } from "../types";

export const chatService = {
  async listMessages(limit = 100): Promise<ChatMessage[]> {
    const response = await http.get("/api/v1/chat/messages", { params: { limit } });
    return Array.isArray(response.data?.messages) ? (response.data.messages as ChatMessage[]) : [];
  },

  async postMessage(text: string, csrfToken: string): Promise<ChatMessage> {
    const response = await http.post(
      "/api/v1/chat/messages",
      { text },
      {
        headers: {
          "x-csrf-token": csrfToken
        }
      }
    );

    return response.data?.message as ChatMessage;
  }
};
