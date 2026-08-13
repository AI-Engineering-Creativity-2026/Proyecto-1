export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
}

export type ChatStatus = "idle" | "connecting" | "waiting_response" | "error";

export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error: string | null;
}
