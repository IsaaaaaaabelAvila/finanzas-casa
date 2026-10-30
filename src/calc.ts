import type { Account, BagMove, Goal, Item, LedgerItem, Payroll, Person, Plan, Settle, Setting, Txn } from './types';

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
export function accountBalance(acc: Item<Account>, txns: Item<Txn>[], plans: Item<Plan>[], oweLeft = 0): number {
  if (acc.data.auto === 'owe') return -oweLeft; // cuenta de deudas: sale de la lista "Yo debo"
  let bal = acc.data.type === 'credit' ? -acc.data.initial : acc.data.initial;
  for (const t of txns) {
    const x = t.data;
    if (x.type === 'income' && x.accountId === acc.id) bal += x.amount;
    if (x.type === 'expense' && x.accountId === acc.id) bal -= x.amount;
    if (x.type === 'adjust' && x.accountId === acc.id) bal += x.amount;
    if ((x.type === 'loan' || x.type === 'payout') && x.accountId === acc.id) bal -= x.amount;
    if (x.type === 'collect' && x.accountId === acc.id) bal += x.amount;
    if (x.type === 'transfer') {
      if (x.accountId === acc.id) bal -= x.amount;
      if (x.toAccountId === acc.id) bal += x.amount;
    }
  }
  if (acc.data.type === 'credit') for (const p of plans) if (p.data.accountId === acc.id && !p.data.txnId) bal -= p.data.total;
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
  for (const pl of plans) if (pl.data.accountId === acc.id && !pl.data.txnId && pl.data.startDate >= p.start && pl.data.startDate <= p.end) spent += pl.data.total;
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
  for (const pl of plans) if (pl.data.accountId === acc.id && !pl.data.txnId && pl.data.startDate >= p.start && pl.data.startDate <= p.end) spent += pl.data.total;
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { spent, max: a.maxSpend, left: a.maxSpend - spent, pct: (spent / a.maxSpend) * 100, end: p.end, daysLeft: Math.max(0, daysBetween(t0, p.endDate)) };
}

export const inTotal = (a: Item<Account>) => a.data.inTotal ?? ['debit', 'cash', 'credit'].includes(a.data.type);

/** Dinero total: suma de saldos de las cuentas marcadas como "en el total" (las tarjetas restan su deuda). */
export function totalFunds(accs: Item<Account>[], txns: Item<Txn>[], plans: Item<Plan>[], oweLeft = 0) {
  let total = 0, liquid = 0, cards = 0, outside = 0;
  for (const a of accs) {
    const b = accountBalance(a, txns, plans, oweLeft);
    if (!inTotal(a)) { outside += b; continue; }
    total += b;
    if (a.data.type === 'credit') cards += b; else liquid += b;
  }
  return { total, liquid, cards, outside };
}

// ---------- Pagos a meses (mensualidades marcadas a mano) ----------
export const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const addMonthsYm = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo - 1 + n, 1)); };
export const monthLabel = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }); };

export function planSchedule(p: Plan): string[] {
  const first = p.firstMonth ?? p.startDate.slice(0, 7);
  return Array.from({ length: p.months }, (_, i) => addMonthsYm(first, i));
}
export function planStatus(p: Plan, month = ym(new Date())) {
  const schedule = planSchedule(p);
  const paidSet = new Set(p.paid ?? []);
  const paidCount = schedule.filter(m => paidSet.has(m)).length;
  const monthly = p.total / p.months;
  return {
    schedule, paidCount, monthly,
    due: schedule.includes(month), paidThisMonth: paidSet.has(month),
    remainingMonths: p.months - paidCount, remainingAmount: monthly * (p.months - paidCount),
    finished: paidCount >= p.months
  };
}

// ---------- Reparto de la casa ----------
export interface HouseRow { key: string; name: string; income: number; pct: number; cash: number; installments: number; paid: number; should: number; diff: number }
export function houseSummary(month: string, people: Person[], payrolls: Item<Payroll>[], txns: Item<Txn>[], plans: Item<Plan>[], settles: Item<Settle>[], pctMonth?: string) {
  const amountIn = (m: string, k: string) => payrolls.filter(p => p.data.month === m && p.data.person === k).reduce((a, p) => a + p.data.amount, 0);
  const complete = (m: string) => people.length > 0 && people.every(p => amountIn(m, p.key) > 0);
  const months = [...new Set(payrolls.map(p => p.data.month))].sort();
  const pick = (lim: string) => (complete(lim) ? lim : months.filter(m => m < lim && complete(m)).pop() ?? null);
  const base = pick(pctMonth ?? month);
  const missing = people.filter(p => amountIn(month, p.key) <= 0).map(p => p.name);
  const incomeOf = (k: string) => payrolls.filter(p => p.data.month === base && p.data.person === k).reduce((a, p) => a + p.data.amount, 0);
  const totalIncome = people.reduce((a, p) => a + incomeOf(p.key), 0);
  const shared = txns.filter(t => t.owner === null && t.data.type === 'expense' && t.data.date.startsWith(month));
  const duePlans = plans.filter(p => p.owner === null && planStatus(p.data, month).due);
  const keys = new Set(people.map(p => p.key));
  const unassigned = shared.filter(t => !t.data.paidBy || !keys.has(t.data.paidBy)).reduce((a, t) => a + t.data.amount, 0)
    + duePlans.filter(p => !p.data.paidBy || !keys.has(p.data.paidBy)).reduce((a, p) => a + p.data.total / p.data.months, 0);
  const rows: HouseRow[] = people.map(p => {
    const income = incomeOf(p.key);
    const cash = shared.filter(t => t.data.paidBy === p.key).reduce((a, t) => a + t.data.amount, 0);
    const installments = duePlans.filter(pl => pl.data.paidBy === p.key).reduce((a, pl) => a + pl.data.total / pl.data.months, 0);
    return { key: p.key, name: p.name, income, pct: totalIncome > 0 ? income / totalIncome : 1 / Math.max(1, people.length), cash, installments, paid: cash + installments, should: 0, diff: 0 };
  });
  const totalSpent = rows.reduce((a, r) => a + r.paid, 0);
  rows.forEach(r => { r.should = totalSpent * r.pct; r.diff = r.paid - r.should; });
  const settle = settles.find(s => s.data.month === month) ?? null;
  // quien debe (diff negativo) y a quien
  const debtor = rows.filter(r => r.diff < -0.005).sort((a, b) => a.diff - b.diff)[0] ?? null;
  const creditor = rows.filter(r => r.diff > 0.005).sort((a, b) => b.diff - a.diff)[0] ?? null;
  const owes = debtor && creditor ? Math.min(-debtor.diff, creditor.diff) : 0;
  return { base, missing, totalIncome, totalSpent, rows, debtor, creditor, owes, settle, unassigned, duePlans };
}

/** Mes de la primera mensualidad: la compra cae en el primer corte >= fecha de compra; se paga en el primer dia de pago posterior a ese corte. */
export function firstPaymentMonth(purchase: string, cutDay: number, payDay: number): string {
  const d = parse(purchase);
  let cut = cutIn(d.getFullYear(), d.getMonth(), cutDay);
  if (d > cut) cut = cutIn(d.getFullYear(), d.getMonth() + 1, cutDay);
  let pay = cutIn(cut.getFullYear(), cut.getMonth(), payDay);
  if (pay <= cut) pay = cutIn(cut.getFullYear(), cut.getMonth() + 1, payDay);
  return ym(pay);
}

// ---------- Deudas con personas ----------
export function ledgerStatus(i: LedgerItem, month = ym(new Date())) {
  if (i.kind === 'lump') {
    const left = Math.max(0, (i.amount ?? 0) - (i.settled ?? 0));
    return { left, monthly: 0, due: false, paidThisMonth: false, paidCount: 0, schedule: [] as string[], remainingMonths: 0, finished: left <= 0.005 };
  }
  const months = i.months ?? 0;
  const schedule = Array.from({ length: months }, (_, k) => addMonthsYm(i.firstMonth ?? month, k));
  const paid = new Set(i.paid ?? []);
  const paidCount = schedule.filter(m => paid.has(m)).length;
  const monthly = i.monthly ?? 0;
  return { left: monthly * (months - paidCount), monthly, due: schedule.includes(month), paidThisMonth: paid.has(month), paidCount, schedule, remainingMonths: months - paidCount, finished: paidCount >= months };
}

/** Lo que me deben + lo que falta de mis compras a meses (para quien suma eso a su dinero total, porque ya esta como deuda en sus tarjetas). */
export function pendingReceivables(plans: Item<Plan>[], ledger: Item<LedgerItem>[], me: string, myKey: string | null) {
  let t = 0;
  for (const p of plans) if (p.owner === me || (myKey && p.owner === null && p.data.paidBy === myKey)) t += planStatus(p.data).remainingAmount;
  for (const l of ledger) if (l.data.dir === 'owed' && !l.data.aside) t += ledgerStatus(l.data).left;
  return t;
}

/** Reparte el dinero total entre las metas ligadas, en orden de prioridad (la primera se llena primero). */
export function allocateGoals(goals: Item<Goal>[], total: number, committed: Record<string, number> = {}) {
  const linked = goals.filter(g => g.data.linkTotal).sort((a, b) => (a.data.order ?? 1e9) - (b.data.order ?? 1e9));
  let rest = Math.max(0, total);
  const alloc: Record<string, number> = {};
  for (const g of linked) {
    const room = Math.max(0, g.data.target - (g.data.kind === 'fund' ? 0 : (committed[g.id] ?? 0))); // en metas de gasto, lo comprometido cuenta dentro de su presupuesto
    const a = Math.min(room, rest);
    alloc[g.id] = a; rest -= a;
  }
  return { alloc, unassigned: rest, linked };
}

/** Lo que ya esta comprometido con cada meta: compras, deudas y gastos marcados "se pagan con la meta". */
export function goalCommitted(me: string, ledger: Item<LedgerItem>[], plans: Item<Plan>[], txns: Item<Txn>[]) {
  const out: Record<string, number> = {};
  const add = (id: string | undefined, v: number) => { if (id) out[id] = (out[id] ?? 0) + v; };
  for (const l of ledger) if (l.data.dir === 'owe') add(l.data.goalId, l.data.kind === 'installments' ? (l.data.monthly ?? 0) * (l.data.months ?? 0) : (l.data.amount ?? 0));
  const linked = new Set(plans.map(p => p.data.txnId).filter(Boolean) as string[]);
  for (const p of plans) if (p.owner === me) add(p.data.goalId, p.data.total);
  for (const t of txns) if (t.owner === me && t.data.type === 'expense' && !t.data.payOf && !linked.has(t.id)) add(t.data.goalId, t.data.amount);
  return out;
}

/** Lo que debo en "Yo debo" (lo que falta por pagar). */
export const oweRemaining = (ledger: Item<LedgerItem>[]) => ledger.filter(l => l.data.dir === 'owe').reduce((a, l) => a + ledgerStatus(l.data).left, 0);

// ---------- Presupuesto rodante (libre para gastar) ----------
export interface BudgetCtx {
  me: string; myKey: string | null; txns: Item<Txn>[]; plans: Item<Plan>[]; ledger: Item<LedgerItem>[];
  people: Person[]; payrolls: Item<Payroll>[]; setting: Setting | null;
}
/** Configuracion vigente en un mes (los cambios aplican solo hacia adelante). */
export const cfgAt = (st: Setting | null, m: string) => {
  const arr = (st?.plan ?? []).filter(c => c.from <= m);
  return arr.length ? arr[arr.length - 1] : null;
};
const casaPct = (ctx: BudgetCtx, m: string) => {
  const ref = m >= ym(new Date()) ? addMonthsYm(m, -1) : m; // a medio mes las nominas son parciales: se usa el ultimo mes cerrado
  return houseSummary(m, ctx.people, ctx.payrolls, [], [], [], ref).rows.find(r => r.key === ctx.myKey)?.pct ?? 0;
};

/** Comprometido del mes: mis mensualidades, lo que debo a personas y mi parte de las mensualidades de la casa. */
export function monthCommitments(ctx: BudgetCtx, m: string) {
  const own = ctx.plans.filter(p => p.owner === ctx.me && !p.data.goalId).reduce((a, p) => { const s = planStatus(p.data, m); return a + (s.due ? s.monthly : 0); }, 0);
  const owe = ctx.ledger.filter(l => l.data.dir === 'owe' && !l.data.goalId).reduce((a, l) => { const s = ledgerStatus(l.data, m); return a + (s.due ? s.monthly : 0); }, 0);
  const casaTotal = ctx.plans.filter(p => p.owner === null).reduce((a, p) => { const s = planStatus(p.data, m); return a + (s.due ? s.monthly : 0); }, 0);
  const casa = casaTotal * casaPct(ctx, m);
  const advanced = ctx.ledger.filter(l => l.data.dir === 'owed').reduce((a, l) => { const s = ledgerStatus(l.data, m); return a + (s.due ? s.monthly : 0); }, 0);
  return { own, owe, casa, advanced, total: own + owe + casa };
}

/** Gastado en el mes (sin lo que ya cuenta por mensualidades): mis egresos y mi parte de los egresos de la casa. */
export function monthSpent(ctx: BudgetCtx, m: string) {
  const linked = new Set(ctx.plans.map(p => p.data.txnId).filter(Boolean) as string[]);
  let own = 0, casa = 0;
  for (const t of ctx.txns) {
    if (t.data.type !== 'expense' || !t.data.date.startsWith(m) || t.data.payOf || t.data.goalId) continue;
    if (t.owner === ctx.me) {
      if (linked.has(t.id)) continue;
      const led = t.data.ledgerId ? ctx.ledger.find(l => l.id === t.data.ledgerId) : undefined;
      if (led && led.data.kind === 'installments') continue;
      own += t.data.amount;
    } else if (t.owner === null) casa += t.data.amount;
  }
  const casaShare = casa * casaPct(ctx, m);
  return { own, casa: casaShare, total: own + casaShare };
}

/** Ingresos recibidos en un mes (o el monto capturado a mano para meses anteriores al arranque). */
export function monthIncome(ctx: BudgetCtx, m: string) {
  const o = ctx.setting?.incomeOverrides?.[m];
  if (o !== undefined) return o;
  return ctx.txns.filter(t => t.owner === ctx.me && t.data.type === 'income' && t.data.date.startsWith(m)).reduce((a, t) => a + t.data.amount, 0);
}

export function monthBase(ctx: BudgetCtx, m: string) {
  const c = cfgAt(ctx.setting, m);
  if (!c) return 0;
  // ahorro fijo: se gasta de lo que ya se recibio el mes anterior, no de lo que se espera recibir
  return c.mode === 'budget' ? c.amount : monthIncome(ctx, addMonthsYm(m, -1)) - c.amount;
}

/** Lo que pasa al mes siguiente del libre del mes m: el monto decidido (entre 0 y el libre) o, sin decision, todo. El resto queda en el ahorro (dinero total). */
export function carryNext(st: Setting | null, m: string, libre: number) {
  const d = st?.carryDecisions?.[m];
  if (d === undefined) return libre;
  return libre >= 0 ? Math.max(0, Math.min(libre, d)) : Math.min(0, Math.max(libre, d));
}

/** Presupuesto + arrastre del mes vencido - comprometido - gastado. El arrastre es el "libre" final del mes anterior. */
export function budgetFor(ctx: BudgetCtx, month: string) {
  const start = ctx.setting?.startMonth;
  if (!start || !ctx.setting?.plan?.length || month < start) return null;
  let carry = 0;
  let m = start;
  for (let i = 0; i < 240; i++) {
    const base = monthBase(ctx, m);
    const commit = monthCommitments(ctx, m).total;
    const spent = monthSpent(ctx, m).total;
    const libre = base + carry - commit - spent;
    const next = carryNext(ctx.setting, m, libre);
    const pct = libre !== 0 ? (next / libre) * 100 : 100;
    if (m === month) return { month: m, base, carry, commit, spent, libre, pct, next };
    carry = next;
    m = addMonthsYm(m, 1);
  }
  return null;
}

export type Level = 'green' | 'amber' | 'red';
/** Semaforo: rojo si ya no queda para gastar; ambar si va mas rapido que el mes o queda poco; verde si va bien. */
export function budgetLevel(b: { base: number; carry: number; commit: number; spent: number; libre: number }, now = new Date()): Level {
  const g0 = b.base + b.carry - b.commit;
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = now.getDate() / dim;
  if (g0 <= 0 || b.libre <= 0) return 'red';
  const used = b.spent / g0;
  if (used > elapsed + 0.15 || b.libre < g0 * 0.15) return 'amber';
  return 'green';
}
export const levelText = (l: Level) => l === 'green' ? 'Va bien este mes' : l === 'amber' ? 'Va por encima del ritmo del mes' : 'Ya no queda para gastar este mes';

/** Lo ahorrado en una meta: lo asignado de tu dinero total (+ lo ya comprometido si es una meta de gasto). */
export const goalSaved = (g: Item<Goal>, alloc: Record<string, number>, committed: Record<string, number>) =>
  g.data.linkTotal ? Math.min(g.data.target, (alloc[g.id] ?? 0) + (g.data.kind === 'fund' ? 0 : (committed[g.id] ?? 0))) : g.data.saved;

// ---------- Bolsas virtuales (gasto / ahorro) y patrimonio ----------
const CASH_TYPES = ['debit', 'cash', 'investment'];
const isCash = (a: Item<Account>) => CASH_TYPES.includes(a.data.type) && inTotal(a) && !a.data.auto;
const delta = (x: Txn, id: string) => {
  let v = 0;
  if (x.accountId === id) {
    if (x.type === 'income' || x.type === 'adjust' || x.type === 'collect') v += x.amount;
    else if (x.type === 'expense' || x.type === 'transfer' || x.type === 'loan' || x.type === 'payout') v -= x.amount;
  }
  if (x.type === 'transfer' && x.toAccountId === id) v += x.amount;
  return v;
};

/** Dinero en cuentas hoy (debito, efectivo e inversion que cuentan en el total). */
export function cashTotal(accs: Item<Account>[], txns: Item<Txn>[], plans: Item<Plan>[], oweLeft = 0) {
  return accs.filter(isCash).reduce((s, a) => s + accountBalance(a, txns, plans, oweLeft), 0);
}
/** Dinero en cuentas antes de una fecha (para el arranque de las bolsas). */
export function cashBefore(accs: Item<Account>[], txns: Item<Txn>[], date: string) {
  let total = 0;
  for (const a of accs.filter(isCash)) {
    let bal = a.data.initial;
    for (const t of txns) if (t.data.date < date) bal += delta(t.data, a.id);
    total += bal;
  }
  return total;
}

/** Reparto de la nomina vigente en una fecha (por defecto 50% ahorro, 40% presupuesto, 10% reserva). */
export const splitAt = (st: Setting | null, date: string) => {
  const m = date.slice(0, 7);
  const arr = (st?.split ?? []).filter(c => c.from <= m);
  return arr.length ? arr[arr.length - 1] : { from: '', ahorro: 50, presupuesto: 40, reserva: 10 };
};

/** Parte de un ingreso que va a la bolsa de ahorro: la nomina usa el reparto; un ingreso adicional, su propio %. */
export function incomeToSavings(st: Setting | null, t: Txn) {
  if (t.type !== 'income') return 0;
  if (t.category === 'Nomina') return (t.amount * splitAt(st, t.date).ahorro) / 100;
  if (t.category === 'Reembolso') return 0;
  return (t.amount * (t.savePct ?? 0)) / 100;
}

/**
 * Deuda por capas. Capa 1: lo que vence en lo que resta del periodo (mes o quincena), siempre sale de la bolsa de gasto.
 * Capa 2: el resto de la deuda propia y por pagar. DM: deuda financiada por metas. A: parte ajena de mensualidades aun no reembolsada.
 */
export function debtLayers(accs: Item<Account>[], plans: Item<Plan>[], ctx: BudgetCtx, pat: { deudaPropia: number; porPagar: number }, ref: string, mode: 'month' | 'quincena' | undefined, oweLeft: number) {
  const m = ref.slice(0, 7);
  const end = mode === 'quincena' && Number(ref.slice(8, 10)) <= 15 ? 15 : 31;
  const pct = casaPct(ctx, m);
  const accById = new Map(accs.map(x => [x.id, x]));
  const dueDay = (id?: string) => accById.get(id ?? '')?.data.payDay ?? 1;
  let D1 = 0, A = 0, DM = 0;
  const DMby: Record<string, number> = {};
  const addDM = (id: string, v: number) => { DM += v; DMby[id] = (DMby[id] ?? 0) + v; };
  const planRem: Record<string, number> = {};
  for (const p of plans) {
    const mine = p.owner === ctx.me;
    if (!mine && p.owner !== null) continue;
    const st = planStatus(p.data, m);
    const cid = p.data.cardId ?? p.data.accountId;
    const titular = mine || p.data.paidBy === ctx.myKey;
    if (titular && cid) planRem[cid] = (planRem[cid] ?? 0) + st.remainingAmount;
    if (mine && p.data.goalId) { addDM(p.data.goalId, st.remainingAmount); continue; }
    if (!st.due || st.paidThisMonth || dueDay(cid) > end) continue;
    if (mine) D1 += st.monthly;
    else { D1 += st.monthly * pct; if (p.data.paidBy === ctx.myKey) A += st.monthly * (1 - pct); }
  }
  let ajenaLeft = 0;
  for (const l of ctx.ledger) {
    const st = ledgerStatus(l.data, m);
    if (l.data.dir === 'owe') {
      if (l.data.goalId) { addDM(l.data.goalId, st.left); continue; }
      if (l.data.kind === 'installments' && st.due && !st.paidThisMonth) D1 += st.monthly;
    } else if (l.data.kind === 'installments' && !l.data.dudoso) {
      ajenaLeft += st.left;
      if (st.due && !st.paidThisMonth) A += st.monthly;
    }
  }
  return { D1, A, DM, DMby, planRem, end, pct, ajenaLeft, ref };
}

/**
 * Las dos bolsas. S es el total de la bolsa de ahorro: arranca en el monto fijado, sube con la parte de cada ingreso que se ahorra y con los movimientos.
 * Lo que ya esta comprometido a deuda sale de S (capa 2 respaldada de forma gradual segun el patrimonio, y deuda de metas completa).
 * Gasto = dinero en cuentas - S. Libre = gasto - capa 1 - otros pagos - parte ajena.
 */
export function bagState(accs: Item<Account>[], txns: Item<Txn>[], plans: Item<Plan>[], moves: Item<BagMove>[], st: Setting | null, me: string, oweLeft: number, ctx: BudgetCtx, pat: ReturnType<typeof patrimonio>) {
  const start = st?.bagStart;
  if (!start) return null;
  const t = today();
  const ref = t < start.from ? start.from : t;
  const L = debtLayers(accs, plans, ctx, pat, ref, st?.payPeriod, oweLeft);
  // contado de tarjetas por tarjeta (saldo - mensualidades pendientes), con ajuste por la parte ajena
  let D1 = L.D1; const O = 0;
  const rows = accs.filter(c => c.data.type === 'credit' && inTotal(c)).map(c => ({ day: c.data.payDay ?? 1, c: Math.max(0, -accountBalance(c, txns, plans, oweLeft) - (L.planRem[c.id] ?? 0)) }));
  const sum = rows.reduce((x, r) => x + r.c, 0);
  const factor = sum > 0 ? Math.max(0, sum - L.ajenaLeft) / sum : 0;
  for (const r of rows) if (r.day <= L.end) D1 += r.c * factor;
  const Dtot = pat.deudaPropia + pat.porPagar;
  D1 = Math.min(D1, Math.max(0, Dtot - L.DM));
  const D2 = Math.max(0, Dtot - D1 - L.DM);
  const P = pat.a;
  const w = D2 > 0 ? Math.min(1, Math.max(0, 1 + P / D2)) : 1;
  const S0 = start.ahorro != null ? start.ahorro : Math.max(0, P - O - L.A) + w * D2 + L.DM;
  let S = S0;
  for (const x of txns) if (x.owner === me && x.data.type === 'income' && x.data.date >= start.from) S += incomeToSavings(st, x.data);
  for (const x of moves) if (x.owner === me && x.data.date >= start.from) S += x.data.amount;
  const cash = cashTotal(accs, txns, plans, oweLeft);
  const B2 = Math.min(w * D2, Math.max(0, S - L.DM));
  const ahorro = Math.max(0, Math.min(S - B2 - L.DM, Math.max(0, P)));
  const ahorroBag = Math.min(Math.max(0, cash), ahorro + B2 + L.DM);
  const gastoBag = cash - ahorroBag;
  const libre = gastoBag - D1 - O - L.A;
  const held: Record<string, number> = {};
  const spent = goalSpent(moves, me);
  for (const k of new Set([...Object.keys(spent), ...Object.keys(L.DMby)])) held[k] = (spent[k] ?? 0) + (L.DMby[k] ?? 0);
  return {
    cash, gastoBag, ahorroBag, libre, ahorro, B2, DM: L.DM, D1, D2, A: L.A, O, sinCobertura: D2 - B2,
    comprometida: D1 + B2 + L.DM, patrimonio: P, S0, S, w, from: start.from, started: t >= start.from,
    fixed: start.ahorro != null, goalHeld: held, goalPending: L.DMby
  };
}

/** Lo gastado de cada meta (salidas de la bolsa de ahorro respaldadas por la meta). */
export function goalSpent(moves: Item<BagMove>[], me: string) {
  const out: Record<string, number> = {};
  for (const m of moves) if (m.owner === me && m.data.goalId && m.data.amount < 0) out[m.data.goalId] = (out[m.data.goalId] ?? 0) - m.data.amount;
  return out;
}

/** Patrimonio: (a) cuentas - deuda propia - por pagar; (b) (a) + por cobrar (sin dudosos). Memo: deuda con bancos y cuanto es ajena. */
export function patrimonio(accs: Item<Account>[], ctx: BudgetCtx, txns: Item<Txn>[], plans: Item<Plan>[], oweLeft = 0) {
  const cuentas = cashTotal(accs, txns, plans, oweLeft);
  const tarjetas = accs.filter(a => a.data.type === 'credit' && inTotal(a)).reduce((s, a) => s - accountBalance(a, txns, plans, oweLeft), 0);
  const pct = casaPct(ctx, ym(new Date()));
  const house = plans.filter(p => p.owner === null);
  const housePay = house.filter(p => p.data.paidBy === ctx.myKey).reduce((s, p) => s + planStatus(p.data).remainingAmount, 0);   // yo soy el titular
  const houseOwe = house.filter(p => p.data.paidBy !== ctx.myKey).reduce((s, p) => s + planStatus(p.data).remainingAmount, 0);  // el titular es otro
  const ajenaLedger = ctx.ledger.filter(l => l.data.dir === 'owed' && l.data.kind === 'installments' && !l.data.dudoso).reduce((s, l) => s + ledgerStatus(l.data).left, 0);
  const casaAjena = housePay * (1 - pct);
  const ajena = ajenaLedger + casaAjena;
  const deudaPropia = tarjetas - ajena;
  const porPagar = ctx.ledger.filter(l => l.data.dir === 'owe').reduce((s, l) => s + ledgerStatus(l.data).left, 0) + houseOwe * pct;
  const porCobrar = ctx.ledger.filter(l => l.data.dir === 'owed' && l.data.kind === 'lump' && !l.data.dudoso && !l.data.aside).reduce((s, l) => s + ledgerStatus(l.data).left, 0);
  const a = cuentas - deudaPropia - porPagar;
  return { cuentas, tarjetas, ajena, deudaPropia, porPagar, porCobrar, a, b: a + porCobrar };
}
