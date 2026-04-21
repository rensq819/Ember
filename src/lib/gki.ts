export type GkiZone =
  | "therapeutic"
  | "deep-ketosis"
  | "optimal"
  | "mild"
  | "out-of-ketosis";

export interface GkiZoneInfo {
  zone: GkiZone;
  label: string;
  description: string;
}

export function calculateGki(glucoseMmol: number, ketonesMmol: number): number | null {
  if (!ketonesMmol || ketonesMmol <= 0) return null;
  return glucoseMmol / ketonesMmol;
}

export function gkiZone(gki: number): GkiZoneInfo {
  if (gki < 1) return { zone: "therapeutic", label: "Therapeutic", description: "GKI < 1 — deep therapeutic range" };
  if (gki < 3) return { zone: "deep-ketosis", label: "Deep ketosis", description: "GKI 1–3 — strong ketosis" };
  if (gki < 6) return { zone: "optimal", label: "Optimal", description: "GKI 3–6 — metabolic sweet spot" };
  if (gki < 9) return { zone: "mild", label: "Mild ketosis", description: "GKI 6–9 — mild ketosis" };
  return { zone: "out-of-ketosis", label: "Out of ketosis", description: "GKI > 9 — not in ketosis" };
}

export function mgDlToMmol(mgDl: number): number {
  return mgDl / 18.0182;
}

export function mmolToMgDl(mmol: number): number {
  return mmol * 18.0182;
}

export function autophagyScore(gki: number | null, fastingHours: number): number {
  let gkiPoints = 0;
  if (gki !== null) {
    if (gki < 1) gkiPoints = 60;
    else if (gki < 3) gkiPoints = 50;
    else if (gki < 6) gkiPoints = 35;
    else if (gki < 9) gkiPoints = 15;
    else gkiPoints = 0;
  }

  let hourPoints = 0;
  if (fastingHours >= 72) hourPoints = 40;
  else if (fastingHours >= 48) hourPoints = 32;
  else if (fastingHours >= 24) hourPoints = 22;
  else if (fastingHours >= 18) hourPoints = 12;
  else if (fastingHours >= 12) hourPoints = 6;

  return Math.min(100, gkiPoints + hourPoints);
}
