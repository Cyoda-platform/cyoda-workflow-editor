import { createContext, useContext } from "react";
import { defaultMessages, type Messages } from "./en.js";

export const I18nContext = createContext<Messages>(defaultMessages);

export function useMessages(): Messages {
  return useContext(I18nContext);
}

export type PartialMessages = {
  [K in keyof Messages]?: Partial<Messages[K]>;
};

export function mergeMessages(overrides?: PartialMessages): Messages {
  if (!overrides) return defaultMessages;
  const next: Record<string, unknown> = { ...defaultMessages };
  for (const key of Object.keys(overrides)) {
    const base = (defaultMessages as Record<string, unknown>)[key] ?? {};
    const patch = (overrides as Record<string, unknown>)[key] ?? {};
    next[key] = { ...(base as object), ...(patch as object) };
  }
  return next as Messages;
}
