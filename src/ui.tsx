import { ReactNode } from 'react';
import { list, State } from './store';
import { totalFunds } from './calc';
import type { Account, Goal, Item, LedgerItem, Payroll, People, Person, Plan, Settle, Setting, Txn } from './types';

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
  setting: Item<Setting> | null;
  total: number;
  people: Person[];
  peopleId: string | null;
  myKey: string | null;
  payrolls: Item<Payroll>[];
  settles: Item<Settle>[];
  ledger: Item<LedgerItem>[];
}

/** Datos visibles segun el filtro (Mio / Casa / Todo). */
export function selectData(s: State, scope: Scope): Data {
  const me = s.me ?? 'local';
  const ok = (o: string | null) => scope === 'all' || (scope === 'mine' ? o === me : o === null);
  const allAccounts = list<Account>(s, 'account');
  const allTxns = list<Txn>(s, 'txn');
  const allPlans = list<Plan>(s, 'plan');
  const peopleRec = list<People>(s, 'people')[0] ?? null;
  const people = peopleRec?.data.people ?? [];
  return {
    people, peopleId: peopleRec?.id ?? null,
    ledger: list<LedgerItem>(s, 'ledger').filter(l => l.owner === me),
    myKey: people.find(p => p.userId === me)?.key ?? null,
    payrolls: list<Payroll>(s, 'payroll'), settles: list<Settle>(s, 'settle'),
    me, allAccounts, allTxns, allPlans,
    total: totalFunds(allAccounts, allTxns, allPlans).total,
    setting: list<Setting>(s, 'setting').find(x => x.owner === me) ?? null,
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
