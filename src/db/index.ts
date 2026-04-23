import Dexie, { type EntityTable } from "dexie";
import type {
  DailyCalories,
  ElectrolyteLog,
  FastingSession,
  FoodLogEntry,
  MetabolicLog,
  UserSettings,
} from "./types";

export const db = new Dexie("ember") as Dexie & {
  fastingSessions: EntityTable<FastingSession, "id">;
  metabolicLogs: EntityTable<MetabolicLog, "id">;
  electrolyteLogs: EntityTable<ElectrolyteLog, "id">;
  userSettings: EntityTable<UserSettings, "id">;
  foodLogEntries: EntityTable<FoodLogEntry, "id">;
  dailyCalories: EntityTable<DailyCalories, "date">;
};

db.version(1).stores({
  fastingSessions: "++id, startedAt, endedAt, protocol",
  metabolicLogs: "++id, timestamp",
  electrolyteLogs: "++id, timestamp",
  userSettings: "id",
});

db.version(2).stores({
  fastingSessions: "++id, startedAt, endedAt, protocol",
  metabolicLogs: "++id, timestamp, sourceId",
  electrolyteLogs: "++id, timestamp",
  userSettings: "id",
});

db.version(3).stores({
  fastingSessions: "++id, startedAt, endedAt, protocol",
  metabolicLogs: "++id, timestamp, sourceId, *tags",
  electrolyteLogs: "++id, timestamp, *tags",
  userSettings: "id",
});

db.version(4).stores({
  fastingSessions: "++id, startedAt, endedAt, protocol",
  metabolicLogs: "++id, timestamp, sourceId, *tags",
  electrolyteLogs: "++id, timestamp, *tags",
  userSettings: "id",
  foodLogEntries: "++id, date",
  dailyCalories: "date",
});

export const DEFAULT_SETTINGS: UserSettings = {
  id: "singleton",
  preferredProtocol: "18:6",
  glucoseUnit: "mmol/L",
  gkiTargets: {
    therapeutic: 1,
    optimal: [1, 6],
  },
  theme: "dark",
  dietMode: "standard",
};

export async function getSettings(): Promise<UserSettings> {
  const existing = await db.userSettings.get("singleton");
  if (existing) return existing;
  await db.userSettings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
