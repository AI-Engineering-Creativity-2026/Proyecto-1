import type { AgentMessage, UiAction } from "@agichat/contracts";

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
  attachments?: AgentMessage["attachments"];
  providers?: AgentMessage["providers"];
  actions?: UiAction["action"][];
}

export type ChatStatus = "idle" | "connecting" | "waiting_response" | "error";

export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error: string | null;
}
