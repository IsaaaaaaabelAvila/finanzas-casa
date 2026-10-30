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
  auto?: 'owe';         // saldo = lo que debo en "Yo debo" (se calcula solo)
  feeNote?: string;
}
export type TxnType = 'income' | 'expense' | 'transfer' | 'adjust' | 'loan' | 'collect' | 'payout';  // loan: presto (cuenta -> por cobrar); collect: cobro (por cobrar -> cuenta); payout: pago a una persona (cuenta -> por pagar)
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
  payOf?: string;       // pago de una deuda (id:mes); no es consumo ni resta del libre
  goalId?: string;      // se paga con el dinero de esta meta; no resta del libre
  savePct?: number;     // ingreso adicional: % que va a la bolsa de ahorro
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
  goalId?: string;      // se paga con el dinero de esta meta; no resta del libre
  cardId?: string;      // tarjeta de la compra, solo para marcar mensualidades al pagarla (no afecta el saldo)
}
export interface Goal {
  name: string;
  target: number;
  saved: number;
  deadline?: string;
  linkTotal?: boolean;  // se llena con el dinero total, por orden de prioridad
  order?: number;       // prioridad (1 = primero)
  kind?: 'fund' | 'spend';  // fund: fondo que se repone siempre; spend: meta que se gasta y se cierra
  closed?: boolean;     // meta de gasto ya gastada (oculta; sus compras siguen pagadas con ella)
}
export type Kind = 'account' | 'txn' | 'plan' | 'goal' | 'setting' | 'people' | 'payroll' | 'settle' | 'ledger' | 'status' | 'bagmove';
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
  goalId?: string;                // se paga con el dinero de esta meta; no resta del libre
  dudoso?: boolean;               // por cobrar dudoso: no cuenta en el patrimonio (b)
}
export interface PlanCfg { from: string; mode: 'budget' | 'saving'; amount: number; income?: number }
export interface CarryCfg { from: string; pos: number; neg: number }  // % del sobrante / faltante que pasa al mes siguiente
export interface SplitCfg { from: string; ahorro: number; presupuesto: number; reserva: number }  // reparto de la nomina (YYYY-MM)
export interface BagStart { from: string; ahorro: number | null; gasto: number | null }  // arranque de las bolsas: ahorro = total de la bolsa de ahorro al arrancar (null = vista previa con el patrimonio de hoy)
export interface BagMove { date: string; amount: number; goalId?: string; note?: string; key?: string }  // movimiento de la bolsa de ahorro (+ entra, - sale)
export interface Setting { monthlyBudget?: number; includeReceivables?: boolean; startMonth?: string; plan?: PlanCfg[]; shareStatus?: boolean; incomeOverrides?: Record<string, number>; carry?: CarryCfg[]; carryDecisions?: Record<string, number>; split?: SplitCfg[]; bagStart?: BagStart; payPeriod?: 'month' | 'quincena' }
export interface Status { person: string; level: 'green' | 'amber' | 'red'; month: string; text: string }
export interface Item<T> { id: string; owner: string | null; data: T }

export const INCOME_CATS = ['Nomina', 'Rendimientos', 'Freelance', 'Reembolso', 'Regalo', 'Otro ingreso'];
export const EXPENSE_CATS = ['Vivienda', 'Automóvil', 'Salud', 'Super', 'Salidas', 'Compras', 'Otros'];
