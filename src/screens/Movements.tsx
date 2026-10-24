import { useState } from 'react';
import { accountBalance, addMonthsYm, firstPaymentMonth, money, planStatus, today, ym } from '../calc';
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
  const [editId, setEditId] = useState<string | null>(null);
  const [filterAcc, setFilterAcc] = useState('');
  // al elegir una cuenta de deudas, el egreso es algo que pago otra persona y yo le debo (aparece en "Yo debo")
  const [owedPerson, setOwedPerson] = useState('Iván');
  const [owedMonths, setOwedMonths] = useState('1');
  const [owedFirst, setOwedFirst] = useState(addMonthsYm(ym(new Date()), 1));
  const [owedCard, setOwedCard] = useState('');

  // cuentas disponibles: las mias y las de la casa (sin importar el filtro)
  const accs = d.allAccounts.filter(a => a.owner === d.me || a.owner === null);
  const accName = (id?: string) => d.allAccounts.find(a => a.id === id)?.data.name ?? '—';
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const selectedAcc = accs.find(a => a.id === (accountId || accs[0]?.id));
  const isDebtAcc = (a?: (typeof accs)[number]) => !!a && a.data.type === 'other' && (/deuda/i.test(a.data.name) || a.data.initial < 0);
  const debtAcc = isDebtAcc(selectedAcc) ? selectedAcc : undefined;
  const knownPersons = [...new Set(d.ledger.map(l => l.data.person))];
  const useOwed = !editId && type === 'expense' && !shared && !!debtAcc;

  const rows = d.txns
    .filter(t => t.data.date.startsWith(month))
    .filter(t => !filterAcc || t.data.accountId === filterAcc || t.data.toAccountId === filterAcc)
    .sort((a, b) => b.data.date.localeCompare(a.data.date));

  // resumen de la cuenta filtrada, para conciliar contra la app del banco
  const fAcc = filterAcc ? d.allAccounts.find(a => a.id === filterAcc) : undefined;
  const fSum = fAcc ? (() => {
    let inn = 0, out = 0, adj = 0;
    for (const t of rows) {
      const x = t.data;
      if (x.type === 'income' && x.accountId === fAcc.id) inn += x.amount;
      if (x.type === 'expense' && x.accountId === fAcc.id) out += x.amount;
      if (x.type === 'adjust' && x.accountId === fAcc.id) adj += x.amount;
      if (x.type === 'transfer') { if (x.accountId === fAcc.id) out += x.amount; if (x.toAccountId === fAcc.id) inn += x.amount; }
    }
    return { inn, out, adj, balance: accountBalance(fAcc, d.allTxns, d.allPlans) };
  })() : null;

  function resetForm() {
    setEditId(null); setOpen(false); setAmount(''); setNote(''); setCategory(''); setToAccountId(''); setAccountId('');
    setShared(false); setPayer(''); setDate(today()); setType('expense');
  }

  function startEdit(t: (typeof rows)[number]) {
    setEditId(t.id); setOpen(true);
    setType(t.data.type); setAmount(String(t.data.amount)); setDate(t.data.date);
    setAccountId(t.data.accountId); setToAccountId(t.data.toAccountId ?? '');
    setCategory(t.data.type === 'transfer' || t.data.type === 'adjust' ? '' : t.data.category);
    setNote(t.data.note); setShared(t.owner === null); setPayer(t.data.paidBy ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toPlan(t: (typeof rows)[number]) {
    const n = parseInt(prompt('¿A cuantos meses?') ?? '', 10);
    if (!n || n < 2) return;
    const acc = d.allAccounts.find(a => a.id === t.data.accountId);
    const firstMonth = acc?.data.cutDay && acc.data.payDay ? firstPaymentMonth(t.data.date, acc.data.cutDay, acc.data.payDay) : t.data.date.slice(0, 7);
    save('plan', { description: t.data.note || t.data.category, total: t.data.amount, months: n, startDate: t.data.date, firstMonth, paid: [], accountId: t.data.accountId, category: t.data.category, paidBy: t.data.paidBy, txnId: t.id }, t.owner);
  }

  const planOf = (txnId: string) => d.allPlans.find(p => p.data.txnId === txnId);

  function submitOwed() {
    const mine = num(amount);
    if (!mine || !debtAcc || !owedPerson.trim()) return;
    const concept = note.trim() || category || EXPENSE_CATS[EXPENSE_CATS.length - 1];
    const cat = category || EXPENSE_CATS[EXPENSE_CATS.length - 1];
    // el gasto cuenta como mio (mi parte) y aumenta mi deuda
    const months = Math.max(1, Math.round(num(owedMonths)));
    let lid = '';
    if (months > 1) {
      lid = save('ledger', { person: owedPerson.trim(), dir: 'owe', concept, card: owedCard.trim() || undefined, kind: 'installments', monthly: Math.round((mine / months) * 100) / 100, months, firstMonth: owedFirst, paid: [] }, d.me);
    } else {
      lid = save('ledger', { person: owedPerson.trim(), dir: 'owe', concept, kind: 'lump', amount: mine, settled: 0 }, d.me);
    }
    // el gasto cuenta como mio (mi parte) y aumenta mi deuda; su pago se cuenta por mensualidades
    save('txn', { type: 'expense', amount: mine, date, accountId: debtAcc.id, category: cat, note: `${concept} (pago ${owedPerson.trim()})`, ledgerId: lid } as Txn, d.me);
    setAmount(''); setNote(''); setOpen(false);
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
    save('txn', t, shared ? null : d.me, editId ?? undefined);
    const linked = editId ? planOf(editId) : undefined;
    if (linked) save('plan', { ...linked.data, total: amt, startDate: date, description: t.note || t.category, category: t.category, accountId: acc }, linked.owner, linked.id);
    resetForm();
  }

  return (
    <>
      <div className="month-nav">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <b>{month}</b>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        <button className="primary" onClick={() => (open ? resetForm() : setOpen(true))}>{open ? 'Cerrar' : '+ Nuevo'}</button>
      </div>

      <div className="filterbar">
        <select value={filterAcc} onChange={e => setFilterAcc(e.target.value)}>
          <option value="">Todas las cuentas</option>
          {accs.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
        </select>
      </div>

      {fAcc && fSum && (
        <Card title={`${fAcc.data.name} · conciliacion`}>
          <div className="row"><small>{fAcc.data.type === 'credit' ? 'Deuda segun la app' : 'Saldo segun la app'} (hoy)</small><b className={fSum.balance < 0 ? 'neg' : ''}>{fAcc.data.type === 'credit' && fSum.balance < 0 ? money(-fSum.balance) : money(fSum.balance)}</b></div>
          <div className="row"><small>Entradas del mes</small><span className="pos">{money(fSum.inn)}</span></div>
          <div className="row"><small>Salidas del mes</small><span className="neg">{money(fSum.out)}</span></div>
          {fSum.adj !== 0 && <div className="row"><small>Ajustes del mes</small><span>{money(fSum.adj)}</span></div>}
          <p className="hint">Compara con tu app del banco. Si no coincide, revisa que la lista tenga todo lo que aparece en el estado de cuenta; lo que falte, lo registras aqui.</p>
        </Card>
      )}

      {open && (
        <Card title={editId ? 'Editar movimiento' : 'Nuevo movimiento'}>
          {accs.length === 0 && <p className="error">Primero crea una cuenta en la pestana Cuentas.</p>}
          <div className="seg">
            {(['expense', 'income', 'transfer', 'adjust'] as TxnType[]).map(k => (
              <button key={k} className={type === k ? 'on' : ''} onClick={() => { setType(k); setCategory(''); }}>
                {k === 'expense' ? 'Egreso' : k === 'income' ? 'Ingreso' : k === 'transfer' ? 'Transfer. / pago tarjeta' : 'Ajuste'}
              </button>
            ))}
          </div>
          <Field label="Concepto (que fue: tacos, uber, renta…)"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Concepto" /></Field>
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
          {type === 'income' && (category || cats[cats.length - 1]) === 'Nomina' && !shared && <p className="hint">Esta nomina se refleja sola en Casa para calcular el porcentaje (solo se comparte el total del mes).</p>}
          {useOwed && (
            <>
              <p className="hint">Como la cuenta es "{debtAcc?.data.name}", este egreso es algo que pago otra persona y tu le debes: se suma a esa cuenta y se crea la deuda en "Yo debo". El monto es lo que tu debes.</p>
              <Field label="Quien lo pago"><input list="personas-mov" value={owedPerson} onChange={e => setOwedPerson(e.target.value)} /></Field>
              <datalist id="personas-mov">{knownPersons.map(p => <option key={p} value={p} />)}</datalist>
              <Field label="Meses para pagarlo (1 = un solo pago)"><input inputMode="numeric" value={owedMonths} onChange={e => setOwedMonths(e.target.value)} /></Field>
              {num(owedMonths) > 1 && (
                <>
                  <Field label="Mes de la primera mensualidad"><input type="month" value={owedFirst} onChange={e => setOwedFirst(e.target.value)} /></Field>
                  <Field label="Tarjeta (opcional)"><input value={owedCard} onChange={e => setOwedCard(e.target.value)} placeholder="Invex, BBVA…" /></Field>
                  <p className="hint">Mensualidad: {money(num(amount) / Math.max(1, Math.round(num(owedMonths))))}</p>
                </>
              )}
            </>
          )}
          <label className="check"><input type="checkbox" checked={shared} disabled={Boolean(editId)} onChange={e => setShared(e.target.checked)} /> Es un movimiento comun de la casa (lo ven los dos){editId ? ' — no se puede cambiar al editar' : ''}</label>
          {shared && d.people.length > 0 && (
            <Field label="Quien pago">
              <select value={payer || d.myKey || d.people[0].key} onChange={e => setPayer(e.target.value)}>
                {d.people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <button className="primary" onClick={submit} disabled={!num(amount) || accs.length === 0}>{editId ? 'Guardar cambios' : 'Guardar'}</button>
        </Card>
      )}

      <Card>
        {rows.length === 0 ? <Empty>{filterAcc ? 'Sin movimientos de esta cuenta este mes.' : 'Sin movimientos este mes.'}</Empty> : rows.map(t => (
          <div key={t.id} className="tx">
            <div>
              <b>{t.data.note || <span style={{ opacity: 0.6 }}>{t.data.category} (sin concepto)</span>}</b>
              <small>{t.data.date} · {t.data.category} · {accName(t.data.accountId)}{t.data.toAccountId ? ` → ${accName(t.data.toAccountId)}` : ''} · {ownerLabel(t.owner)}{t.owner === null && t.data.paidBy ? ` · pago ${d.people.find(p => p.key === t.data.paidBy)?.name ?? ''}` : ''}</small>
              {(() => { const pl = planOf(t.id); if (pl) { const st = planStatus(pl.data); return <span className="chip ontrack" style={{ marginTop: 4, display: 'inline-block' }}>A {pl.data.months} meses · {st.paidCount} de {pl.data.months} pagadas · {money(st.monthly)}/mes</span>; } return t.data.type === 'expense' ? <button className="link" style={{ padding: 0, marginTop: 2 }} onClick={() => toPlan(t)}>Pasar este gasto a meses</button> : null; })()}
            </div>
            <div className="tx-r">
              <b className={t.data.type === 'income' || (t.data.type === 'adjust' && t.data.amount > 0) ? 'pos' : t.data.type === 'expense' || t.data.type === 'adjust' ? 'neg' : ''}>
                {t.data.type === 'income' || (t.data.type === 'adjust' && t.data.amount > 0) ? '+' : t.data.type === 'expense' ? '−' : ''}{money(t.data.amount)}
              </b>
              <button className="link" onClick={() => startEdit(t)}>Editar</button>
              <button className="x" onClick={() => { const pl = planOf(t.id); if (confirm(pl ? '¿Borrar movimiento? Tambien se borra su compra a meses.' : '¿Borrar movimiento?')) { remove(t.id); if (pl) remove(pl.id); } }}>🗑</button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
