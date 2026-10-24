export type AccountType = 'debit' | 'credit' | 'cash' | 'investment' | 'other';
export interface Account {
  name: string;
  type: AccountType;
  initial: number;      // saldo inicial (debito/efectivo) o deuda inicial (credito)
  cutDay?: number;      // dia de corte (credito)
  payDay?: number;      // dia limite de pago (credito)
  limit?: number;       // limite de credito
  minSpend?: number;    // gasto minimo por periodo para evitar cobro por inactividad
  maxSpend?: number;    // tope de gasto por periodo (credito)
  inTotal?: boolean;    // cuenta dentro del total de dinero (por defecto: debito, efectivo y credito)
  feeNote?: string;
}
export type TxnType = 'income' | 'expense' | 'transfer' | 'adjust';
export interface Txn {
  type: TxnType;
  amount: number;
  date: string;         // YYYY-MM-DD
  accountId: string;    // origen
  toAccountId?: string; // destino (transferencia / pago de tarjeta)
  category: string;
  note: string;
  paidBy?: string;      // clave de la persona que pago (gastos de la casa)
  ledgerId?: string;    // deuda a personas que creo este gasto (se cuenta por mensualidades)
}
export interface Plan {
  accountId?: string;
  description: string;
  total: number;
  months: number;
  startDate: string;    // fecha de compra
  firstMonth?: string;  // YYYY-MM de la primera mensualidad
  paid?: string[];      // meses (YYYY-MM) marcados como pagados
  paidBy?: string;      // clave de la persona que paga (compras de la casa)
  category?: string;    // categoria del gasto
  txnId?: string;       // movimiento del que viene (ya cuenta como gasto; la compra no se suma otra vez)
}
export interface Goal {
  name: string;
  target: number;
  saved: number;
  deadline?: string;
  linkTotal?: boolean;  // se llena con el dinero total, por orden de prioridad
  order?: number;       // prioridad (1 = primero)
}
export type Kind = 'account' | 'txn' | 'plan' | 'goal' | 'setting' | 'people' | 'payroll' | 'settle' | 'ledger' | 'status';
export interface Rec<T = any> {
  id: string;
  kind: Kind;
  owner: string | null;  // null = compartido
  data: T;
  deleted: boolean;
  dirty: boolean;
}
export interface Person { key: string; name: string; userId?: string | null }
export interface People { people: Person[] }
export interface Payroll { month: string; person: string; amount: number; auto?: boolean }
export interface Settle { month: string; from: string; to: string; amount: number; at: string }
export interface LedgerItem {
  person: string;                 // persona (texto libre)
  dir: 'owed' | 'owe';            // owed = me deben, owe = yo debo
  concept: string;
  card?: string;                  // tarjeta con la que se compro
  kind: 'installments' | 'lump';  // a meses o monto unico
  monthly?: number; months?: number; firstMonth?: string; paid?: string[];
  amount?: number; settled?: number;  // monto unico y lo ya cobrado/pagado
  aside?: boolean;                // deuda aparte (no se cobra activamente)
}
export interface PlanCfg { from: string; mode: 'budget' | 'saving'; amount: number; income?: number }
export interface CarryCfg { from: string; pos: number; neg: number }  // % del sobrante / faltante que pasa al mes siguiente
export interface Setting { monthlyBudget?: number; includeReceivables?: boolean; startMonth?: string; plan?: PlanCfg[]; shareStatus?: boolean; incomeOverrides?: Record<string, number>; carry?: CarryCfg[]; carryDecisions?: Record<string, number> }
export interface Status { person: string; level: 'green' | 'amber' | 'red'; month: string; text: string }
export interface Item<T> { id: string; owner: string | null; data: T }

export const INCOME_CATS = ['Nomina', 'Rendimientos', 'Freelance', 'Reembolso', 'Regalo', 'Otro ingreso'];
export const EXPENSE_CATS = ['Vivienda', 'Automóvil', 'Salud', 'Super', 'Salidas', 'Compras', 'Otros'];
