import type { Data } from './ui';
import type { BudgetCtx } from './calc';

/** Datos que necesita el calculo del presupuesto rodante. */
export function budgetCtx(d: Data): BudgetCtx {
  return {
    me: d.me, myKey: d.myKey, txns: d.allTxns, plans: d.allPlans, ledger: d.ledger,
    people: d.people, payrolls: d.payrolls, setting: d.setting?.data ?? null
  };
}
