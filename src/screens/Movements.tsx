import { useState } from 'react';
import { addMonthsYm, firstPaymentMonth, money, today, ym } from '../calc';
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
  // gasto que pago otra persona y yo le debo (se suma a mi cuenta de deudas y a "Yo debo")
  const [owedBy, setOwedBy] = useState(false);
  const [owedPerson, setOwedPerson] = useState('Iván');
  const [share, setShare] = useState('');
  const [owedMonths, setOwedMonths] = useState('1');
  const [owedFirst, setOwedFirst] = useState(addMonthsYm(ym(new Date()), 1));
  const [owedCard, setOwedCard] = useState('');

  // cuentas disponibles: las mias y las de la casa (sin importar el filtro)
  const accs = d.allAccounts.filter(a => a.owner === d.me || a.owner === null);
  const accName = (id?: string) => d.allAccounts.find(a => a.id === id)?.data.name ?? '—';
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const debtAcc = d.allAccounts.find(a => a.data.type === 'other' && /deuda/i.test(a.data.name) && (a.owner === d.me || a.owner === null)) ?? d.allAccounts.find(a => a.data.type === 'other' && a.owner === d.me);
  const knownPersons = [...new Set(d.ledger.map(l => l.data.person))];
  const useOwed = type === 'expense' && !shared && owedBy;

  const rows = d.txns.filter(t => t.data.date.startsWith(month)).sort((a, b) => b.data.date.localeCompare(a.data.date));

  function toPlan(t: (typeof rows)[number]) {
    const n = parseInt(prompt('¿A cuantos meses?') ?? '', 10);
    if (!n || n < 2) return;
    const acc = d.allAccounts.find(a => a.id === t.data.accountId);
    const firstMonth = acc?.data.cutDay && acc.data.payDay ? firstPaymentMonth(t.data.date, acc.data.cutDay, acc.data.payDay) : t.data.date.slice(0, 7);
    save('plan', { description: t.data.note || t.data.category, total: t.data.amount, months: n, startDate: t.data.date, firstMonth, paid: [], accountId: t.data.accountId, category: t.data.category, paidBy: t.data.paidBy }, t.owner);
    remove(t.id);
  }

  function submitOwed() {
    const total = num(amount);
    const mine = num(share) || total;
    if (!total || !debtAcc || !owedPerson.trim()) return;
    const concept = note.trim() || category || EXPENSE_CATS[EXPENSE_CATS.length - 1];
    const cat = category || EXPENSE_CATS[EXPENSE_CATS.length - 1];
    // el gasto cuenta como mio (mi parte) y aumenta mi deuda
    save('txn', { type: 'expense', amount: mine, date, accountId: debtAcc.id, category: cat, note: `${concept} (pago ${owedPerson.trim()})` } as Txn, d.me);
    const months = Math.max(1, Math.round(num(owedMonths)));
    if (months > 1) {
      save('ledger', { person: owedPerson.trim(), dir: 'owe', concept, card: owedCard.trim() || undefined, kind: 'installments', monthly: Math.round((mine / months) * 100) / 100, months, firstMonth: owedFirst, paid: [] }, d.me);
    } else {
      save('ledger', { person: owedPerson.trim(), dir: 'owe', concept, kind: 'lump', amount: mine, settled: 0 }, d.me);
    }
    setAmount(''); setNote(''); setShare(''); setOpen(false);
  }

  function submit() {
    if (useOwed) return submitOwed();
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
          {!useOwed && <Field label={type === 'transfer' ? 'Desde la cuenta' : 'Cuenta'}>
            <select value={accountId || accs[0]?.id || ''} onChange={e => setAccountId(e.target.value)}>
              {accs.map(a => <option key={a.id} value={a.id}>{a.data.name} ({ownerLabel(a.owner)})</option>)}
            </select>
          </Field>}
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
          {type === 'income' && (category || cats[cats.length - 1]) === 'Nomina' && !shared && <p className="hint">Esta nomina se refleja sola en Casa para calcular el porcentaje (solo se comparte el total del mes).</p>}
          <Field label="Nota"><input value={note} onChange={e => setNote(e.target.value)} /></Field>
          {type === 'expense' && !shared && (
            <label className="check"><input type="checkbox" checked={owedBy} onChange={e => setOwedBy(e.target.checked)} /> Lo pago otra persona y yo se lo debo (aparece en "Yo debo")</label>
          )}
          {useOwed && (
            <>
              {!debtAcc && <p className="error">Crea primero una cuenta de tipo "Prestamo / deuda" (por ejemplo "Deudas") para llevar lo que debes.</p>}
              {debtAcc && <p className="hint">El gasto se suma a tu cuenta "{debtAcc.data.name}" y se crea la deuda para pagarla por mensualidades.</p>}
              <Field label="Quien lo pago"><input list="personas-mov" value={owedPerson} onChange={e => setOwedPerson(e.target.value)} /></Field>
              <datalist id="personas-mov">{knownPersons.map(p => <option key={p} value={p} />)}</datalist>
              <Field label="Mi parte (lo que yo debo; vacio = todo el monto)">
                <input inputMode="decimal" value={share} onChange={e => setShare(e.target.value)} placeholder={amount || '0.00'} />
              </Field>
              <div className="row-actions" style={{ justifyContent: 'flex-start', marginTop: -6 }}>
                <button className="link" onClick={() => setShare('')}>Todo</button>
                <button className="link" onClick={() => setShare(String(Math.round((num(amount) / 2) * 100) / 100))}>Mitad</button>
              </div>
              <Field label="Meses para pagarlo (1 = un solo pago)"><input inputMode="numeric" value={owedMonths} onChange={e => setOwedMonths(e.target.value)} /></Field>
              {num(owedMonths) > 1 && (
                <>
                  <Field label="Mes de la primera mensualidad"><input type="month" value={owedFirst} onChange={e => setOwedFirst(e.target.value)} /></Field>
                  <Field label="Tarjeta (opcional)"><input value={owedCard} onChange={e => setOwedCard(e.target.value)} placeholder="Invex, BBVA…" /></Field>
                  <p className="hint">Mensualidad: {money((num(share) || num(amount)) / Math.max(1, Math.round(num(owedMonths))))}</p>
                </>
              )}
            </>
          )}
          <label className="check"><input type="checkbox" checked={shared} onChange={e => { setShared(e.target.checked); if (e.target.checked) setOwedBy(false); }} /> Es un movimiento comun de la casa (lo ven los dos)</label>
          {shared && d.people.length > 0 && (
            <Field label="Quien pago">
              <select value={payer || d.myKey || d.people[0].key} onChange={e => setPayer(e.target.value)}>
                {d.people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <button className="primary" onClick={submit} disabled={!num(amount) || accs.length === 0 || (useOwed && !debtAcc)}>Guardar</button>
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
              {t.data.type === 'expense' && <button className="link" title="Convertir en compra a meses" onClick={() => toPlan(t)}>A meses</button>}
              <button className="x" onClick={() => confirm('¿Borrar movimiento?') && remove(t.id)}>🗑</button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
