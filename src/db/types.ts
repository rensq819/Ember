export type FastingProtocol =
  | "16:8"
  | "18:6"
  | "20:4"
  | "OMAD"
  | "24h"
  | "36h"
  | "72h"
  | "custom";

export interface FastingSession {
  id?: number;
  startedAt: number;
  endedAt: number | null;
  targetHours: number | null;
  protocol: FastingProtocol;
  notes?: string;
}

export interface MetabolicLog {
  id?: number;
  timestamp: number;
  glucoseMmol: number | null;
  ketonesMmol: number | null;
  gki: number | null;
  notes?: string;
  tags?: string[];
  sourceId?: string;
}

export interface ElectrolyteLog {
  id?: number;
  timestamp: number;
  sodiumMg: number | null;
  magnesiumMg: number | null;
  potassiumMg: number | null;
  calciumMg: number | null;
  notes?: string;
  tags?: string[];
}

export type GlucoseUnit = "mmol/L" | "mg/dL";

export interface UserSettings {
  id: "singleton";
  preferredProtocol: FastingProtocol;
  glucoseUnit: GlucoseUnit;
  gkiTargets: {
    therapeutic: number;
    optimal: [number, number];
  };
  theme: "system" | "light" | "dark";
}
