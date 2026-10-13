import { supabase } from './supabase';
import { getState, setState, onDataChange } from './store';
import type { Rec } from './types';

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export async function syncNow(): Promise<void> {
  const s = getState();
  if (!supabase || !s.household || !s.me || s.me === 'local' || running) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  running = true;
  setState({ syncing: true, syncError: null });
  try {
    // 1) subir cambios locales
    const dirty = Object.values(s.recs).filter(r => r.dirty);
    if (dirty.length) {
      const rows = dirty.map(r => ({
        id: r.id, household_id: s.household, owner_id: r.owner, kind: r.kind, data: r.data, deleted: r.deleted
      }));
      const { error } = await supabase.from('records').upsert(rows);
      if (error) throw error;
      const recs = { ...getState().recs };
      for (const d of dirty) {
        // solo limpia si no cambio mientras subia
        if (recs[d.id] && recs[d.id].data === d.data && recs[d.id].deleted === d.deleted) recs[d.id] = { ...recs[d.id], dirty: false };
      }
      setState({ recs });
    }
    // 2) bajar cambios remotos
    let q = supabase.from('records').select('*').order('updated_at', { ascending: true }).limit(2000);
    const lp = getState().lastPull;
    if (lp) q = q.gt('updated_at', lp);
    const { data, error } = await q;
    if (error) throw error;
    if (data && data.length) {
      const recs = { ...getState().recs };
      let last = lp;
      for (const row of data) {
        const local = recs[row.id];
        if (!local || !local.dirty) {
          recs[row.id] = { id: row.id, kind: row.kind, owner: row.owner_id, data: row.data, deleted: row.deleted, dirty: false } as Rec;
        }
        last = row.updated_at;
      }
      setState({ recs, lastPull: last });
    }
    setState({ lastSync: new Date().toISOString(), syncing: false });
  } catch (e: any) {
    setState({ syncing: false, syncError: e?.message ?? 'Error de sincronizacion' });
  } finally {
    running = false;
  }
}

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  onDataChange(() => {
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  });
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(syncNow, 60_000);
  syncNow();
}
