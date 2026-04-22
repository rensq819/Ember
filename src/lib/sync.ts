import { supabase } from './supabase';
import { db } from '@/db';
import type { FastingProtocol, UserSettings } from '@/db/types';

// ─── Individual record sync ───────────────────────────────────────────────────

export async function syncSession(userId: string, s: {
  uuid: string; startedAt: number; endedAt: number | null;
  targetHours: number | null; protocol: string; notes?: string;
}): Promise<void> {
  await supabase.from('fasting_sessions').upsert({
    uuid: s.uuid, user_id: userId,
    started_at: s.startedAt, ended_at: s.endedAt ?? null,
    target_hours: s.targetHours ?? null, protocol: s.protocol,
    notes: s.notes ?? null,
  }, { onConflict: 'uuid' });
}

export async function updateSessionEndedAt(uuid: string, endedAt: number): Promise<void> {
  await supabase.from('fasting_sessions').update({ ended_at: endedAt }).eq('uuid', uuid);
}

export async function updateSessionStartedAt(uuid: string, startedAt: number): Promise<void> {
  await supabase.from('fasting_sessions').update({ started_at: startedAt }).eq('uuid', uuid);
}

export async function deleteSession(uuid: string): Promise<void> {
  await supabase.from('fasting_sessions').delete().eq('uuid', uuid);
}

export async function syncMetabolicLog(userId: string, log: {
  uuid: string; timestamp: number; glucoseMmol: number | null;
  ketonesMmol: number | null; gki: number | null;
  notes?: string; tags?: string[]; sourceId?: string;
}): Promise<void> {
  await supabase.from('metabolic_logs').upsert({
    uuid: log.uuid, user_id: userId,
    timestamp: log.timestamp, glucose_mmol: log.glucoseMmol,
    ketones_mmol: log.ketonesMmol, gki: log.gki,
    notes: log.notes ?? null, tags: log.tags ?? [],
    source_id: log.sourceId ?? null,
  }, { onConflict: 'uuid' });
}

export async function deleteMetabolicLog(uuid: string): Promise<void> {
  await supabase.from('metabolic_logs').delete().eq('uuid', uuid);
}

export async function patchMetabolicLog(uuid: string, notes: string | undefined, tags: string[] | undefined): Promise<void> {
  await supabase.from('metabolic_logs').update({ notes: notes ?? null, tags: tags ?? [] }).eq('uuid', uuid);
}

export async function syncElectrolyteLog(userId: string, log: {
  uuid: string; timestamp: number;
  sodiumMg: number | null; magnesiumMg: number | null;
  potassiumMg: number | null; calciumMg: number | null;
  notes?: string; tags?: string[];
}): Promise<void> {
  await supabase.from('electrolyte_logs').upsert({
    uuid: log.uuid, user_id: userId,
    timestamp: log.timestamp,
    sodium_mg: log.sodiumMg, magnesium_mg: log.magnesiumMg,
    potassium_mg: log.potassiumMg, calcium_mg: log.calciumMg,
    notes: log.notes ?? null, tags: log.tags ?? [],
  }, { onConflict: 'uuid' });
}

export async function deleteElectrolyteLog(uuid: string): Promise<void> {
  await supabase.from('electrolyte_logs').delete().eq('uuid', uuid);
}

export async function patchElectrolyteLog(uuid: string, notes: string | undefined, tags: string[] | undefined): Promise<void> {
  await supabase.from('electrolyte_logs').update({ notes: notes ?? null, tags: tags ?? [] }).eq('uuid', uuid);
}

export async function upsertSettings(userId: string, s: UserSettings): Promise<void> {
  await supabase.from('user_settings').upsert({
    user_id: userId,
    preferred_protocol: s.preferredProtocol,
    glucose_unit: s.glucoseUnit,
    gki_targets: s.gkiTargets,
    theme: s.theme,
    lose_it: s.loseIt ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// ─── Bulk sync on login ───────────────────────────────────────────────────────

export async function uploadLocalData(userId: string): Promise<void> {
  const [sessions, metabolic, electrolyte, settings] = await Promise.all([
    db.fastingSessions.toArray(),
    db.metabolicLogs.toArray(),
    db.electrolyteLogs.toArray(),
    db.userSettings.get('singleton'),
  ]);

  const ops: PromiseLike<void>[] = [];

  const sessionRows = sessions.filter(s => s.uuid).map(s => ({
    uuid: s.uuid!, user_id: userId,
    started_at: s.startedAt, ended_at: s.endedAt ?? null,
    target_hours: s.targetHours ?? null, protocol: s.protocol,
    notes: s.notes ?? null,
  }));
  if (sessionRows.length > 0) {
    ops.push(supabase.from('fasting_sessions').upsert(sessionRows, { onConflict: 'uuid' }).then(() => {}));
  }

  const metabolicRows = metabolic.filter(m => m.uuid).map(m => ({
    uuid: m.uuid!, user_id: userId,
    timestamp: m.timestamp, glucose_mmol: m.glucoseMmol,
    ketones_mmol: m.ketonesMmol, gki: m.gki,
    notes: m.notes ?? null, tags: m.tags ?? [],
    source_id: m.sourceId ?? null,
  }));
  if (metabolicRows.length > 0) {
    ops.push(supabase.from('metabolic_logs').upsert(metabolicRows, { onConflict: 'uuid' }).then(() => {}));
  }

  const electrolyteRows = electrolyte.filter(e => e.uuid).map(e => ({
    uuid: e.uuid!, user_id: userId,
    timestamp: e.timestamp,
    sodium_mg: e.sodiumMg, magnesium_mg: e.magnesiumMg,
    potassium_mg: e.potassiumMg, calcium_mg: e.calciumMg,
    notes: e.notes ?? null, tags: e.tags ?? [],
  }));
  if (electrolyteRows.length > 0) {
    ops.push(supabase.from('electrolyte_logs').upsert(electrolyteRows, { onConflict: 'uuid' }).then(() => {}));
  }

  if (settings) {
    ops.push(upsertSettings(userId, settings));
  }

  await Promise.all(ops);
}

export async function downloadCloudData(userId: string): Promise<void> {
  const [sessionsRes, metabolicRes, electrolyteRes, settingsRes] = await Promise.all([
    supabase.from('fasting_sessions').select('*').eq('user_id', userId),
    supabase.from('metabolic_logs').select('*').eq('user_id', userId),
    supabase.from('electrolyte_logs').select('*').eq('user_id', userId),
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  await db.transaction('rw', [db.fastingSessions, db.metabolicLogs, db.electrolyteLogs, db.userSettings], async () => {
    if (sessionsRes.data?.length) {
      await db.fastingSessions.bulkAdd(sessionsRes.data.map(r => ({
        uuid: r.uuid,
        startedAt: r.started_at,
        endedAt: r.ended_at ?? null,
        targetHours: r.target_hours ?? null,
        protocol: r.protocol as FastingProtocol,
        notes: r.notes ?? undefined,
      })));
    }
    if (metabolicRes.data?.length) {
      await db.metabolicLogs.bulkAdd(metabolicRes.data.map(r => ({
        uuid: r.uuid,
        timestamp: r.timestamp,
        glucoseMmol: r.glucose_mmol ?? null,
        ketonesMmol: r.ketones_mmol ?? null,
        gki: r.gki ?? null,
        notes: r.notes ?? undefined,
        tags: r.tags?.length ? r.tags : undefined,
        sourceId: r.source_id ?? undefined,
      })));
    }
    if (electrolyteRes.data?.length) {
      await db.electrolyteLogs.bulkAdd(electrolyteRes.data.map(r => ({
        uuid: r.uuid,
        timestamp: r.timestamp,
        sodiumMg: r.sodium_mg ?? null,
        magnesiumMg: r.magnesium_mg ?? null,
        potassiumMg: r.potassium_mg ?? null,
        calciumMg: r.calcium_mg ?? null,
        notes: r.notes ?? undefined,
        tags: r.tags?.length ? r.tags : undefined,
      })));
    }
    if (settingsRes.data) {
      const s = settingsRes.data;
      await db.userSettings.put({
        id: 'singleton',
        preferredProtocol: s.preferred_protocol as FastingProtocol,
        glucoseUnit: s.glucose_unit as 'mmol/L' | 'mg/dL',
        gkiTargets: s.gki_targets as UserSettings['gkiTargets'],
        theme: s.theme as UserSettings['theme'],
        loseIt: s.lose_it ?? undefined,
      });
    }
  });
}
