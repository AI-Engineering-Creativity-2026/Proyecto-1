import type { Message } from "../../../packages/core/src/types/chat";

export const mockMessages: readonly Message[] = [
  {
    id: "mock-agent-1",
    role: "agent",
    content: "Hi Maya! I’m Nova, your AGIChat guide. How can I help today?",
    timestamp: "2026-08-31T09:41:00.000Z",
  },
  {
    id: "mock-user-1",
    role: "user",
    content: "Can you help me understand my latest invoice?",
    timestamp: "2026-08-31T09:42:00.000Z",
    status: "sent",
  },
  {
    id: "mock-agent-2",
    role: "agent",
    content:
      "Of course. Your August invoice is $48.00 and includes your workspace plan plus two extra seats.",
    timestamp: "2026-08-31T09:42:20.000Z",
  },
];

export const mockSuggestions = [
  "Explain my latest invoice",
  "Update my account details",
  "Talk to a support specialist",
] as const;

export const mockErrorMessage =
  "We couldn’t send your message. Check your connection and try again.";
