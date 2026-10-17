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
  paidBy?: string;      // quien pago (gastos compartidos)
}
export interface Plan {
  accountId: string;
  description: string;
  total: number;
  months: number;
  startDate: string;
}
export interface Goal {
  name: string;
  target: number;
  saved: number;
  deadline?: string;
}
export type Kind = 'account' | 'txn' | 'plan' | 'goal' | 'setting';
export interface Rec<T = any> {
  id: string;
  kind: Kind;
  owner: string | null;  // null = compartido
  data: T;
  deleted: boolean;
  dirty: boolean;
}
export interface Setting { monthlyBudget?: number }
export interface Item<T> { id: string; owner: string | null; data: T }

export const INCOME_CATS = ['Nomina', 'Rendimientos', 'Freelance', 'Reembolso', 'Regalo', 'Otro ingreso'];
export const EXPENSE_CATS = ['Vivienda', 'Servicios', 'Super', 'Comida fuera', 'Transporte', 'Salud', 'Suscripciones', 'Compras', 'Ropa', 'Ocio', 'Regalos', 'Educacion', 'Comisiones', 'Mascotas', 'Otros'];
