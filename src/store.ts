import { useSyncExternalStore } from 'react';
import type { Item, Kind, Rec } from './types';

const KEY = 'finanzas_state_v1';

export interface State {
  recs: Record<string, Rec>;
  lastPull: string | null;
  me: string | null;          // user id ('local' si no hay nube)
  household: string | null;
  inviteCode: string | null;
  displayName: string;
  lastSync: string | null;
  syncError: string | null;
  syncing: boolean;
}

const empty: State = { recs: {}, lastPull: null, me: null, household: null, inviteCode: null, displayName: '', lastSync: null, syncError: null, syncing: false };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty, ...JSON.parse(raw), syncing: false };
  } catch { /* ignorar */ }
  return empty;
}

let state: State = load();
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>(); // solo cambios de datos (para disparar sync)

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignorar */ }
}
export function setState(patch: Partial<State>, dataChanged = false) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach(l => l());
  if (dataChanged) changeListeners.forEach(l => l());
}
export const getState = () => state;
export function onDataChange(fn: () => void) { changeListeners.add(fn); return () => changeListeners.delete(fn); }
export function resetAll() { state = { ...empty }; persist(); listeners.forEach(l => l()); }

export function useStore(): State {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state
  );
}

export function save<T>(kind: Kind, data: T, owner: string | null, id?: string): string {
  const rid = id ?? crypto.randomUUID();
  const prev = state.recs[rid];
  const rec: Rec = { id: rid, kind, owner: prev ? prev.owner : owner, data, deleted: false, dirty: true };
  setState({ recs: { ...state.recs, [rid]: rec } }, true);
  return rid;
}
export function remove(id: string) {
  const prev = state.recs[id];
  if (!prev) return;
  setState({ recs: { ...state.recs, [id]: { ...prev, deleted: true, dirty: true } } }, true);
}
export function list<T>(s: State, kind: Kind): Item<T>[] {
  return Object.values(s.recs)
    .filter(r => r.kind === kind && !r.deleted)
    .map(r => ({ id: r.id, owner: r.owner, data: r.data as T }));
}
