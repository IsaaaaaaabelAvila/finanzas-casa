export type AccountType = 'debit' | 'credit' | 'cash';
export interface Account {
  name: string;
  type: AccountType;
  initial: number;      // saldo inicial (debito/efectivo) o deuda inicial (credito)
  cutDay?: number;      // dia de corte (credito)
  payDay?: number;      // dia limite de pago (credito)
  limit?: number;       // limite de credito
  minSpend?: number;    // gasto minimo por periodo para evitar cobro por inactividad
  feeNote?: string;
}
export type TxnType = 'income' | 'expense' | 'transfer';
export interface Txn {
  type: TxnType;
  amount: number;
  date: string;         // YYYY-MM-DD
  accountId: string;    // origen
  toAccountId?: string; // destino (transferencia / pago de tarjeta)
  category: string;
  note: string;
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
export type Kind = 'account' | 'txn' | 'plan' | 'goal';
export interface Rec<T = any> {
  id: string;
  kind: Kind;
  owner: string | null;  // null = compartido
  data: T;
  deleted: boolean;
  dirty: boolean;
}
export interface Item<T> { id: string; owner: string | null; data: T }

export const INCOME_CATS = ['Sueldo', 'Freelance', 'Regalo', 'Reembolso', 'Otro ingreso'];
export const EXPENSE_CATS = ['Casa/Renta', 'Servicios', 'Super', 'Comida fuera', 'Transporte', 'Salud', 'Ocio', 'Ropa', 'Suscripciones', 'Educacion', 'Otro'];
