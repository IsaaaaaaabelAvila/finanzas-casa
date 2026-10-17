import type { Account, Item, Plan, Txn } from './types';

export const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n || 0);

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const cutIn = (y: number, m: number, cut: number) => new Date(y, m, Math.min(cut, dim(y, m)));
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

/** Periodo de facturacion que contiene `ref` dado el dia de corte. */
export function period(cutDay: number, ref = new Date()) {
  const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let end = cutIn(r.getFullYear(), r.getMonth(), cutDay);
  if (r > end) end = cutIn(r.getFullYear(), r.getMonth() + 1, cutDay);
  const prevCut = cutIn(end.getFullYear(), end.getMonth() - 1, cutDay);
  const start = new Date(prevCut.getFullYear(), prevCut.getMonth(), prevCut.getDate() + 1);
  return { start: iso(start), end: iso(end), endDate: end, startDate: start };
}

/** Saldo de la cuenta. Para tarjetas de credito un saldo negativo es deuda. */
export function accountBalance(acc: Item<Account>, txns: Item<Txn>[], plans: Item<Plan>[]): number {
  let bal = acc.data.type === 'credit' ? -acc.data.initial : acc.data.initial;
  for (const t of txns) {
    const x = t.data;
    if (x.type === 'income' && x.accountId === acc.id) bal += x.amount;
    if (x.type === 'expense' && x.accountId === acc.id) bal -= x.amount;
    if (x.type === 'adjust' && x.accountId === acc.id) bal += x.amount;
    if (x.type === 'transfer') {
      if (x.accountId === acc.id) bal -= x.amount;
      if (x.toAccountId === acc.id) bal += x.amount;
    }
  }
  if (acc.data.type === 'credit') for (const p of plans) if (p.data.accountId === acc.id) bal -= p.data.total;
  return bal;
}

export interface MinSpend {
  spent: number; min: number; remaining: number; daysLeft: number; perDay: number;
  start: string; end: string; status: 'ok' | 'ontrack' | 'behind' | 'urgent';
}
export function minSpend(acc: Item<Account>, txns: Item<Txn>[], plans: Item<Plan>[], now = new Date()): MinSpend | null {
  const a = acc.data;
  if (a.type !== 'credit' || !a.cutDay || !a.minSpend) return null;
  const p = period(a.cutDay, now);
  let spent = 0;
  for (const t of txns) if (t.data.type === 'expense' && t.data.accountId === acc.id && t.data.date >= p.start && t.data.date <= p.end) spent += t.data.amount;
  for (const pl of plans) if (pl.data.accountId === acc.id && pl.data.startDate >= p.start && pl.data.startDate <= p.end) spent += pl.data.total;
  const remaining = Math.max(0, a.minSpend - spent);
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.max(0, daysBetween(t0, p.endDate));
  const total = Math.max(1, daysBetween(p.startDate, p.endDate) + 1);
  const elapsed = Math.min(total, Math.max(0, daysBetween(p.startDate, t0) + 1));
  let status: MinSpend['status'] = 'ok';
  if (remaining > 0) status = daysLeft <= 5 ? 'urgent' : spent / a.minSpend >= elapsed / total ? 'ontrack' : 'behind';
  return { spent, min: a.minSpend, remaining, daysLeft, perDay: remaining / Math.max(1, daysLeft), start: p.start, end: p.end, status };
}

export function planProgress(p: Plan, now = new Date()) {
  const s = parse(p.startDate);
  let paid = (now.getFullYear() - s.getFullYear()) * 12 + now.getMonth() - s.getMonth();
  if (now.getDate() < s.getDate()) paid -= 1;
  paid = Math.min(p.months, Math.max(0, paid));
  const monthly = p.total / p.months;
  return { paid, monthly, remainingMonths: p.months - paid, remainingAmount: monthly * (p.months - paid), finished: paid >= p.months };
}

export function goalPlan(target: number, saved: number, deadline?: string, now = new Date()) {
  const left = Math.max(0, target - saved);
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  let perMonth: number | null = null; let monthsLeft: number | null = null;
  if (deadline && left > 0) {
    const d = parse(deadline);
    monthsLeft = Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
    perMonth = left / monthsLeft;
  }
  return { left, pct, perMonth, monthsLeft };
}

/** Gasto del periodo actual vs tope maximo (tarjetas con maxSpend). */
export function spendCap(acc: Item<Account>, txns: Item<Txn>[], plans: Item<Plan>[], now = new Date()) {
  const a = acc.data;
  if (a.type !== 'credit' || !a.cutDay || !a.maxSpend) return null;
  const p = period(a.cutDay, now);
  let spent = 0;
  for (const t of txns) if (t.data.type === 'expense' && t.data.accountId === acc.id && t.data.date >= p.start && t.data.date <= p.end) spent += t.data.amount;
  for (const pl of plans) if (pl.data.accountId === acc.id && pl.data.startDate >= p.start && pl.data.startDate <= p.end) spent += pl.data.total;
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { spent, max: a.maxSpend, left: a.maxSpend - spent, pct: (spent / a.maxSpend) * 100, end: p.end, daysLeft: Math.max(0, daysBetween(t0, p.endDate)) };
}

export const inTotal = (a: Item<Account>) => a.data.inTotal ?? ['debit', 'cash', 'credit'].includes(a.data.type);

/** Dinero total: suma de saldos de las cuentas marcadas como "en el total" (las tarjetas restan su deuda). */
export function totalFunds(accs: Item<Account>[], txns: Item<Txn>[], plans: Item<Plan>[]) {
  let total = 0, liquid = 0, cards = 0, outside = 0;
  for (const a of accs) {
    const b = accountBalance(a, txns, plans);
    if (!inTotal(a)) { outside += b; continue; }
    total += b;
    if (a.data.type === 'credit') cards += b; else liquid += b;
  }
  return { total, liquid, cards, outside };
}
