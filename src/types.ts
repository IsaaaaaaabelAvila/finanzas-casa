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
}
export interface Goal {
  name: string;
  target: number;
  saved: number;
  deadline?: string;
  linkTotal?: boolean;  // el ahorro = total de las cuentas
}
export type Kind = 'account' | 'txn' | 'plan' | 'goal' | 'setting' | 'people' | 'payroll' | 'settle';
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
export interface Payroll { month: string; person: string; amount: number }
export interface Settle { month: string; from: string; to: string; amount: number; at: string }
export interface Setting { monthlyBudget?: number }
export interface Item<T> { id: string; owner: string | null; data: T }

export const INCOME_CATS = ['Nomina', 'Rendimientos', 'Freelance', 'Reembolso', 'Regalo', 'Otro ingreso'];
export const EXPENSE_CATS = ['Vivienda', 'Servicios', 'Super', 'Comida fuera', 'Transporte', 'Salud', 'Suscripciones', 'Compras', 'Ropa', 'Ocio', 'Regalos', 'Educacion', 'Comisiones', 'Mascotas', 'Otros'];
