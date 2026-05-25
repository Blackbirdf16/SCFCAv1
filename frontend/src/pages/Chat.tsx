import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import TableWrapper from "../components/TableWrapper";
import FormContainer from "../components/FormContainer";
import { ChatMessage } from "../types";
import { chatService } from "../services/chat";

function getCookieValue(name: string): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.substring(name.length + 1));
}

type ConnectionState = "connecting" | "connected" | "disconnected";

type FaqItem = {
  question: string;
  answer: string;
};

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  const listRef = useRef<HTMLDivElement | null>(null);

  const csrf = useMemo(() => getCookieValue("scfca_csrf"), []);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  };

  const faqItems: FaqItem[] = useMemo(() => {
    const common: FaqItem[] = [
      {
        question: "Who can see internal chat messages?",
        answer:
          "All authenticated users in the control panel (administrators, case handlers/regular users, and auditors) can see the internal chat feed.",
      },
      {
        question: "Why do I sometimes see “Missing CSRF token”?",
        answer:
          "The demo uses cookie-based sessions. If your CSRF cookie is missing/expired, log out and log in again to refresh it.",
      },
      {
        question: "Is this chat persistent?",
        answer:
          "This PoC stores messages in memory on the backend. Restarting the backend clears chat history.",
      },
    ];

    if (!user) return common;

    if (user.role === "administrator") {
      return [
        ...common,
        {
          question: "What are my responsibilities as an administrator?",
          answer:
            "Administrators oversee approvals, enforce policy decisions, and coordinate with case handlers and auditors. Use audit and ticket views to validate actions and maintain separation of duties.",
        },
      ];
    }

    if (user.role === "auditor") {
      return [
        ...common,
        {
          question: "What is my role as an auditor?",
          answer:
            "Auditors review activity for policy compliance and record integrity. Use the Audit view to validate trails and use internal chat to request clarifications or evidence from admins/case handlers.",
        },
      ];
    }

    return [
      ...common,
      {
        question: "What are my duties as a case handler (regular user)?",
        answer:
          "Case handlers work assigned custody cases, upload documents linked to those cases, and coordinate approvals via tickets. Use internal chat to coordinate with admins and auditors when exceptions or clarifications are needed.",
      },
    ];
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError("");
      try {
        const initial = await chatService.listMessages(100);
        if (!cancelled) setMessages(initial);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load chat history. Check backend status.");
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!csrf) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");

    const ws = new WebSocket(`ws://127.0.0.1:8000/api/v1/chat/ws?csrf=${encodeURIComponent(csrf)}`);

    ws.onopen = () => setConnectionState("connected");
    ws.onclose = () => setConnectionState("disconnected");
    ws.onerror = () => setConnectionState("disconnected");

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "init" && Array.isArray(payload.messages)) {
          setMessages(payload.messages as ChatMessage[]);
          return;
        }
        if (payload?.type === "message" && payload.message) {
          appendMessage(payload.message as ChatMessage);
        }
      } catch (err) {
        console.error("Chat WS parse error", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [csrf]);

  useEffect(() => {
    if (!user) return;
    if (connectionState === "connected") return;

    const id = window.setInterval(async () => {
      try {
        const latest = await chatService.listMessages(100);
        setMessages(latest);
      } catch {
        // ignore transient polling errors
      }
    }, 3000);

    return () => window.clearInterval(id);
  }, [connectionState, user]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!csrf) {
      setError("Missing CSRF token. Please log out and log in again.");
      return;
    }

    setBusy(true);
    try {
      const message = await chatService.postMessage(trimmed, csrf);
      appendMessage(message);
      setText("");
    } catch (err) {
      console.error(err);
      setError("Message send failed. Check backend status and permissions.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TableWrapper title="Internal Chat">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="text-xs text-slate-400">
              {connectionState === "connected" ? "Live" : connectionState === "connecting" ? "Connecting…" : "Offline"}
            </div>
            <div className="text-xs text-slate-500">
              Signed in as <span className="text-slate-200">{user?.username ?? "—"}</span>
              <span className="mx-1">·</span>
              <span className="text-slate-300">{user?.role ?? "—"}</span>
            </div>
          </div>

          <div ref={listRef} className="mt-3 h-[420px] overflow-y-auto space-y-2 pr-2">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-500">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="rounded-md border border-slate-700/40 bg-dark-card/30 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">
                      {m.author} <span className="text-xs font-normal text-slate-400">({m.role})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{m.timestamp}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-200 whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              ))
            )}
          </div>
        </TableWrapper>
      </div>

      <div className="space-y-6">
        <FormContainer title="Send Message">
          <form className="space-y-3" onSubmit={sendMessage}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message to admins, case handlers, and auditors…"
              className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2 min-h-[120px]"
              maxLength={500}
            />
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <button type="submit" disabled={busy} className="accent-button w-full py-2 font-semibold disabled:opacity-60">
              {busy ? "Sending…" : "Send"}
            </button>
            <div className="text-xs text-slate-500">Messages are visible to all authenticated roles.</div>
          </form>
        </FormContainer>

        <FormContainer title="Help (FAQ)">
          <div className="space-y-3">
            {faqItems.map((item) => (
              <div key={item.question} className="rounded-md border border-slate-700/40 bg-dark-card/20 p-3">
                <div className="text-sm font-semibold text-slate-100">{item.question}</div>
                <div className="mt-1 text-sm text-slate-300">{item.answer}</div>
              </div>
            ))}
          </div>
        </FormContainer>
      </div>
    </div>
  );
}
