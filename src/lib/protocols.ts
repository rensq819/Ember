import type { FastingProtocol } from "@/db/types";

export interface ProtocolInfo {
  key: FastingProtocol;
  label: string;
  targetHours: number | null;
  description: string;
}

export const PROTOCOLS: ProtocolInfo[] = [
  { key: "16:8", label: "16:8", targetHours: 16, description: "Daily window — 16h fast, 8h eating." },
  { key: "18:6", label: "18:6", targetHours: 18, description: "Tighter daily window, deeper fat burning." },
  { key: "20:4", label: "20:4 · Warrior", targetHours: 20, description: "One meal plus snack in 4h." },
  { key: "OMAD", label: "OMAD", targetHours: 23, description: "One meal a day — ~23h fast." },
  { key: "24h", label: "24h", targetHours: 24, description: "Full-day fast, early ketosis." },
  { key: "36h", label: "36h", targetHours: 36, description: "Extends into deep ketosis." },
  { key: "72h", label: "72h", targetHours: 72, description: "Triggers deep autophagy." },
  { key: "custom", label: "Custom", targetHours: null, description: "Open-ended — no target." },
];

export function getProtocol(key: FastingProtocol): ProtocolInfo {
  return PROTOCOLS.find((p) => p.key === key) ?? PROTOCOLS[0];
}
