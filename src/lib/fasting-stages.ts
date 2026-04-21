export interface FastingStage {
  key: string;
  label: string;
  description: string;
  minHours: number;
}

export const FASTING_STAGES: FastingStage[] = [
  { key: "fed", label: "Fed", description: "Digesting and absorbing nutrients.", minHours: 0 },
  { key: "early", label: "Early fast", description: "Insulin falling, glycogen depleting.", minHours: 4 },
  { key: "fat-burning", label: "Fat burning", description: "Glycogen low, lipolysis accelerating.", minHours: 12 },
  { key: "ketosis", label: "Ketosis", description: "Ketone production ramping up.", minHours: 18 },
  { key: "deep-ketosis", label: "Deep ketosis", description: "Strong ketone production, mental clarity.", minHours: 24 },
  { key: "autophagy", label: "Autophagy active", description: "Cellular cleanup underway.", minHours: 48 },
  { key: "deep-autophagy", label: "Deep autophagy", description: "Strong autophagic response, stem cell signaling.", minHours: 72 },
];

export function getFastingStage(elapsedHours: number): FastingStage {
  let current = FASTING_STAGES[0];
  for (const stage of FASTING_STAGES) {
    if (elapsedHours >= stage.minHours) current = stage;
  }
  return current;
}
