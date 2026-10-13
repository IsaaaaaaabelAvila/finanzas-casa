import { ReactNode } from 'react';
import { list, State } from './store';
import type { Account, Goal, Item, Plan, Txn } from './types';

export type Scope = 'mine' | 'shared' | 'all';

export interface Data {
  me: string;
  accounts: Item<Account>[];
  txns: Item<Txn>[];
  plans: Item<Plan>[];
  goals: Item<Goal>[];
  allAccounts: Item<Account>[];
  allTxns: Item<Txn>[];
  allPlans: Item<Plan>[];
}

/** Datos visibles segun el filtro (Mio / Casa / Todo). */
export function selectData(s: State, scope: Scope): Data {
  const me = s.me ?? 'local';
  const ok = (o: string | null) => scope === 'all' || (scope === 'mine' ? o === me : o === null);
  const allAccounts = list<Account>(s, 'account');
  const allTxns = list<Txn>(s, 'txn');
  const allPlans = list<Plan>(s, 'plan');
  return {
    me, allAccounts, allTxns, allPlans,
    accounts: allAccounts.filter(a => ok(a.owner)),
    txns: allTxns.filter(t => ok(t.owner)),
    plans: allPlans.filter(p => ok(p.owner)),
    goals: list<Goal>(s, 'goal').filter(g => ok(g.owner))
  };
}

export const ownerLabel = (o: string | null) => (o === null ? 'Casa' : 'Mio');

export function Card({ title, right, children, className = '' }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && <div className="card-head"><h3>{title}</h3>{right}</div>}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Bar({ pct, tone = 'good' }: { pct: number; tone?: 'good' | 'warn' | 'bad' }) {
  return <div className="bar"><div className={`bar-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };
