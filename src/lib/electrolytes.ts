export interface ElectrolyteTarget {
  key: "sodium" | "magnesium" | "potassium" | "calcium";
  symbol: string;
  label: string;
  dailyMin: number;
  dailyMax: number;
  unit: "mg";
}

export const ELECTROLYTE_TARGETS: ElectrolyteTarget[] = [
  { key: "sodium", symbol: "Na", label: "Sodium", dailyMin: 3000, dailyMax: 5000, unit: "mg" },
  { key: "potassium", symbol: "K", label: "Potassium", dailyMin: 3500, dailyMax: 4700, unit: "mg" },
  { key: "magnesium", symbol: "Mg", label: "Magnesium", dailyMin: 300, dailyMax: 500, unit: "mg" },
  { key: "calcium", symbol: "Ca", label: "Calcium", dailyMin: 1000, dailyMax: 1200, unit: "mg" },
];
