import { useState } from 'react';
import { money, today } from '../calc';
import { remove, save } from '../store';
import { EXPENSE_CATS, INCOME_CATS, Txn, TxnType } from '../types';
import { Card, Data, Empty, Field, num, ownerLabel } from '../ui';

const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Movements({ d }: { d: Data }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [shared, setShared] = useState(false);
  const [payer, setPayer] = useState('');

  // cuentas disponibles: las mias y las de la casa (sin importar el filtro)
  const accs = d.allAccounts.filter(a => a.owner === d.me || a.owner === null);
  const accName = (id?: string) => d.allAccounts.find(a => a.id === id)?.data.name ?? '—';
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const rows = d.txns.filter(t => t.data.date.startsWith(month)).sort((a, b) => b.data.date.localeCompare(a.data.date));

  function submit() {
    const amt = num(amount);
    const acc = accountId || accs[0]?.id;
    if (!amt || !acc) return;
    const t: Txn = {
      type, amount: amt, date, accountId: acc,
      toAccountId: type === 'transfer' ? (toAccountId || accs.find(a => a.id !== acc)?.id) : undefined,
      category: type === 'transfer' ? 'Transferencia' : type === 'adjust' ? 'Ajuste' : (category || cats[cats.length - 1]),
      note: note.trim(),
      paidBy: shared ? (payer || d.myKey || d.people[0]?.key || d.me) : undefined
    };
    save('txn', t, shared ? null : d.me);
    setAmount(''); setNote(''); setOpen(false);
  }

  return (
    <>
      <div className="month-nav">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <b>{month}</b>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        <button className="primary" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : '+ Nuevo'}</button>
      </div>

      {open && (
        <Card title="Nuevo movimiento">
          {accs.length === 0 && <p className="error">Primero crea una cuenta en la pestana Cuentas.</p>}
          <div className="seg">
            {(['expense', 'income', 'transfer', 'adjust'] as TxnType[]).map(k => (
              <button key={k} className={type === k ? 'on' : ''} onClick={() => { setType(k); setCategory(''); }}>
                {k === 'expense' ? 'Egreso' : k === 'income' ? 'Ingreso' : k === 'transfer' ? 'Transfer. / pago tarjeta' : 'Ajuste'}
              </button>
            ))}
          </div>
          <Field label={type === 'adjust' ? 'Monto del ajuste (+ suma, - resta al saldo)' : 'Monto'}><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label={type === 'transfer' ? 'Desde la cuenta' : 'Cuenta'}>
            <select value={accountId || accs[0]?.id || ''} onChange={e => setAccountId(e.target.value)}>
              {accs.map(a => <option key={a.id} value={a.id}>{a.data.name} ({ownerLabel(a.owner)})</option>)}
            </select>
          </Field>
          {type === 'transfer' && (
            <Field label="Hacia la cuenta (para pagar una tarjeta, elige la tarjeta)">
              <select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                <option value="">— elegir —</option>
                {accs.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
              </select>
            </Field>
          )}
          {type !== 'transfer' && type !== 'adjust' && (
            <Field label="Categoria">
              <select value={category || cats[cats.length - 1]} onChange={e => setCategory(e.target.value)}>
                {cats.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          )}
          <Field label="Nota"><input value={note} onChange={e => setNote(e.target.value)} /></Field>
          <label className="check"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Es un movimiento comun de la casa (lo ven los dos)</label>
          {shared && d.people.length > 0 && (
            <Field label="Quien pago">
              <select value={payer || d.myKey || d.people[0].key} onChange={e => setPayer(e.target.value)}>
                {d.people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <button className="primary" onClick={submit} disabled={!num(amount) || accs.length === 0}>Guardar</button>
        </Card>
      )}

      <Card>
        {rows.length === 0 ? <Empty>Sin movimientos este mes.</Empty> : rows.map(t => (
          <div key={t.id} className="tx">
            <div>
              <b>{t.data.note || t.data.category}</b>
              <small>{t.data.date} · {t.data.category} · {accName(t.data.accountId)}{t.data.toAccountId ? ` → ${accName(t.data.toAccountId)}` : ''} · {ownerLabel(t.owner)}{t.owner === null && t.data.paidBy ? ` · pago ${d.people.find(p => p.key === t.data.paidBy)?.name ?? ''}` : ''}</small>
            </div>
            <div className="tx-r">
              <b className={t.data.type === 'income' || (t.data.type === 'adjust' && t.data.amount > 0) ? 'pos' : t.data.type === 'expense' || t.data.type === 'adjust' ? 'neg' : ''}>
                {t.data.type === 'income' || (t.data.type === 'adjust' && t.data.amount > 0) ? '+' : t.data.type === 'expense' ? '−' : ''}{money(t.data.amount)}
              </b>
              <button className="x" onClick={() => confirm('¿Borrar movimiento?') && remove(t.id)}>🗑</button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
