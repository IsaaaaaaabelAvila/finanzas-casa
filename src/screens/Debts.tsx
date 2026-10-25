import { useState } from 'react';
import { addMonthsYm, ledgerStatus, money, monthLabel, today, ym } from '../calc';
import { remove, save } from '../store';
import type { LedgerItem } from '../types';
import { Bar, Card, Data, Empty, Field, num } from '../ui';

type Dir = 'owed' | 'owe';

export default function Debts({ d }: { d: Data }) {
  const nowM = ym(new Date());
  const [month, setMonth] = useState(nowM);
  const [dir, setDir] = useState<Dir>('owed');
  const [open, setOpen] = useState(false);
  const [stmt, setStmt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [f, setF] = useState({ person: '', concept: '', card: '', kind: 'installments' as LedgerItem['kind'], monthly: '', months: '12', firstMonth: nowM, done: '0', amount: '', settled: '', aside: false });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));

  // pago de una deuda: eliges de que cuenta salio el dinero (se registra en Movimientos sin contar como gasto)
  const accs = d.allAccounts.filter(a => (a.owner === d.me || a.owner === null) && a.data.auto !== 'owe');
  const [payFor, setPayFor] = useState<null | { id: string; it: LedgerItem; month?: string; amount: string }>(null);
  const [payAcc, setPayAcc] = useState('');

  const items = d.ledger.filter(i => i.data.dir === dir);
  const persons = [...new Set(items.map(i => i.data.person))].sort();
  const allPersons = [...new Set(d.ledger.map(i => i.data.person))];
  // las deudas liquidadas solo se ven en los meses de su calendario
  const rows = items.map(i => ({ i, st: ledgerStatus(i.data, month) })).filter(r => !r.st.finished || r.st.schedule.includes(month));

  const active = rows.filter(r => !r.i.data.aside && !r.st.finished);
  const pending = active.reduce((a, r) => a + r.st.left, 0);
  const aside = rows.filter(r => r.i.data.aside && !r.st.finished).reduce((a, r) => a + r.st.left, 0);
  const dueMonth = rows.filter(r => r.st.due).reduce((a, r) => a + r.st.monthly, 0);
  const dueMonthPaid = rows.filter(r => r.st.due && r.st.paidThisMonth).reduce((a, r) => a + r.st.monthly, 0);

  function submit() {
    if (!f.person.trim() || !f.concept.trim()) return;
    const base = { person: f.person.trim(), dir, concept: f.concept.trim(), card: f.card.trim() || undefined, kind: f.kind, goalId: dir === 'owe' && goalId ? goalId : undefined } as LedgerItem;
    if (f.kind === 'installments') {
      const months = Math.max(1, Math.round(num(f.months)));
      const done = Math.min(months, Math.max(0, Math.round(num(f.done))));
      save('ledger', { ...base, monthly: num(f.monthly), months, firstMonth: f.firstMonth, paid: Array.from({ length: done }, (_, k) => addMonthsYm(f.firstMonth, k)) }, d.me);
    } else {
      save('ledger', { ...base, amount: num(f.amount), settled: num(f.settled), aside: f.aside || undefined }, d.me);
    }
    setF(p => ({ ...p, concept: '', card: '', monthly: '', amount: '', settled: '', done: '0' }));
    setOpen(false);
  }

  function toggle(id: string, it: LedgerItem, m: string) {
    const paid = (it.paid ?? []).includes(m);
    if (dir === 'owe' && !paid) { setPayFor({ id, it, month: m, amount: String(Math.round((it.monthly ?? 0) * 100) / 100) }); return; }
    if (paid) { const tx = d.allTxns.find(t => t.data.payOf === `${id}:${m}`); if (tx) remove(tx.id); }  // desmarcar borra su movimiento de pago
    const s = new Set(it.paid ?? []);
    if (s.has(m)) s.delete(m); else s.add(m);
    save('ledger', { ...it, paid: [...s].sort() }, d.me, id);
  }
  function settle(id: string, it: LedgerItem) {
    if (dir === 'owe') { setPayFor({ id, it, amount: '' }); return; }
    const v = num(prompt('Monto cobrado (usa negativo para aumentar la deuda)') || '0');
    if (!v) return;
    save('ledger', { ...it, settled: Math.max(0, (it.settled ?? 0) + v) }, d.me, id);
  }
  function confirmPay(register: boolean) {
    if (!payFor) return;
    const { id, it, month: m } = payFor;
    const acc = payAcc || accs[0]?.id;
    const v = num(payFor.amount);
    if (m) {
      save('ledger', { ...it, paid: [...new Set([...(it.paid ?? []), m])].sort() }, d.me, id);
      if (register && acc && v > 0) save('txn', { type: 'expense', amount: v, date: today(), accountId: acc, category: 'Pago de deuda', note: `${it.concept} · ${it.person} (${monthLabel(m)})`, payOf: `${id}:${m}` }, d.me);
    } else if (v > 0) {
      save('ledger', { ...it, settled: Math.max(0, (it.settled ?? 0) + v) }, d.me, id);
      if (register && acc) save('txn', { type: 'expense', amount: v, date: today(), accountId: acc, category: 'Pago de deuda', note: `${it.concept} · ${it.person}`, payOf: `${id}:lump:${Date.now()}` }, d.me);
    }
    setPayFor(null);
  }

  if (stmt) {
    const mine = rows.filter(r => r.i.data.person === stmt);
    const lines = mine.filter(r => r.st.due).map(r => ({
      concept: r.i.data.concept, card: r.i.data.card ?? '', amount: r.st.monthly,
      n: r.st.schedule.indexOf(month) + 1, total: r.i.data.months ?? 0, paid: r.st.paidThisMonth
    }));
    const lumps = mine.filter(r => r.i.data.kind === 'lump' && !r.i.data.aside && !r.st.finished);
    const toPay = lines.filter(l => !l.paid).reduce((a, l) => a + l.amount, 0) + lumps.reduce((a, r) => a + r.st.left, 0);
    const paidAmt = lines.filter(l => l.paid).reduce((a, l) => a + l.amount, 0);
    const text = [`Estado de cuenta - ${monthLabel(month)} - ${stmt}`, ...lines.map(l => `• ${l.concept}${l.card ? ` (${l.card})` : ''}: ${money(l.amount)} - pago ${l.n} de ${l.total}${l.paid ? ' (pagado)' : ''}`), ...lumps.map(r => `• ${r.i.data.concept}: ${money(r.st.left)} pendiente`), `Total por pagar: ${money(toPay)}`].join('\n');
    const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { alert(text); } };
    return (
      <>
        <div className="month-nav">
          <button onClick={() => setMonth(addMonthsYm(month, -1))}>‹</button><b>{monthLabel(month)}</b><button onClick={() => setMonth(addMonthsYm(month, 1))}>›</button>
          <button onClick={() => setStmt(null)}>Cerrar</button>
        </div>
        <div className="statement">
          <h3>Estado de cuenta</h3>
          <p className="who">{stmt} · {monthLabel(month)}</p>
          <table>
            <thead><tr><th>Concepto</th><th>TDC</th><th className="r">Cantidad</th><th className="r">Pago</th></tr></thead>
            <tbody>
              {lines.map((l, k) => (
                <tr key={k} className={l.paid ? 'done' : ''}><td>{l.concept}</td><td>{l.card}</td><td className="r">{money(l.amount)}</td><td className="r">{l.n} de {l.total}</td></tr>
              ))}
              {lumps.map(r => (
                <tr key={r.i.id}><td>{r.i.data.concept}</td><td></td><td className="r">{money(r.st.left)}</td><td className="r">saldo</td></tr>
              ))}
            </tbody>
            <tfoot>
              {paidAmt > 0 && <tr><td colSpan={2}>Ya pagado</td><td className="r" colSpan={2}>{money(paidAmt)}</td></tr>}
              <tr className="total"><td colSpan={2}>Total por pagar</td><td className="r" colSpan={2}>{money(toPay)}</td></tr>
            </tfoot>
          </table>
        </div>
        <div className="row-actions" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={copy}>{copied ? 'Copiado' : 'Copiar como mensaje'}</button>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>Toma captura de esta pantalla o copia el mensaje para enviarlo.</p>
      </>
    );
  }

  return (
    <>
      <div className="seg">
        <button className={dir === 'owed' ? 'on' : ''} onClick={() => setDir('owed')}>Me deben</button>
        <button className={dir === 'owe' ? 'on' : ''} onClick={() => setDir('owe')}>Yo debo</button>
      </div>

      <div className="month-nav">
        <button onClick={() => setMonth(addMonthsYm(month, -1))}>‹</button>
        <b>{monthLabel(month)}</b>
        <button onClick={() => setMonth(addMonthsYm(month, 1))}>›</button>
        <button className="primary" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : '+ Nueva'}</button>
      </div>

      <div className="stats">
        <div className="stat"><small>{dir === 'owed' ? 'Por cobrar' : 'Por pagar'}</small><b className={dir === 'owed' ? 'pos' : 'neg'}>{money(pending)}</b></div>
        <div className="stat"><small>Mensualidades de {monthLabel(month)}</small><b>{money(dueMonth)}</b></div>
        <div className="stat"><small>Ya cubierto este mes</small><b className="pos">{money(dueMonthPaid)}</b></div>
        {aside > 0 && <div className="stat"><small>Aparte (antigua)</small><b>{money(aside)}</b></div>}
      </div>

      {open && (
        <Card title={dir === 'owed' ? 'Nueva deuda: alguien me debe' : 'Nueva deuda: yo debo'}>
          <Field label="Persona"><input list="personas" value={f.person} onChange={e => set('person', e.target.value)} /></Field>
          <datalist id="personas">{allPersons.map(p => <option key={p} value={p} />)}</datalist>
          <Field label="Concepto"><input value={f.concept} onChange={e => set('concept', e.target.value)} placeholder="Laptop, curso, super…" /></Field>
          <div className="seg">
            <button className={f.kind === 'installments' ? 'on' : ''} onClick={() => set('kind', 'installments')}>A meses</button>
            <button className={f.kind === 'lump' ? 'on' : ''} onClick={() => set('kind', 'lump')}>Monto unico</button>
          </div>
          {f.kind === 'installments' ? (
            <>
              <Field label="Tarjeta (opcional)"><input value={f.card} onChange={e => set('card', e.target.value)} placeholder="Invex, BBVA…" /></Field>
              <Field label="Mensualidad (lo que corresponde a esta persona)"><input inputMode="decimal" value={f.monthly} onChange={e => set('monthly', e.target.value)} /></Field>
              <Field label="Numero de meses"><input inputMode="numeric" value={f.months} onChange={e => set('months', e.target.value)} /></Field>
              <Field label="Mes de la primera mensualidad"><input type="month" value={f.firstMonth} onChange={e => set('firstMonth', e.target.value)} /></Field>
              <Field label="Mensualidades ya pagadas"><input inputMode="numeric" value={f.done} onChange={e => set('done', e.target.value)} /></Field>
            </>
          ) : (
            <>
              <Field label="Monto"><input inputMode="decimal" value={f.amount} onChange={e => set('amount', e.target.value)} /></Field>
              <Field label="Ya cobrado / pagado"><input inputMode="decimal" value={f.settled} onChange={e => set('settled', e.target.value)} /></Field>
              <label className="check"><input type="checkbox" checked={f.aside} onChange={e => set('aside', e.target.checked)} /> Deuda aparte (antigua; no entra en lo que cobro activamente)</label>
            </>
          )}
          {dir === 'owe' && d.goals.length > 0 && (
            <>
              <label className="check"><input type="checkbox" checked={goalId !== ''} onChange={e => setGoalId(e.target.checked ? d.goals[0].id : '')} /> Pagar con una meta (no resta de mi libre)</label>
              {goalId !== '' && (
                <Field label="Meta">
                  <select value={goalId} onChange={e => setGoalId(e.target.value)}>
                    {d.goals.map(g => <option key={g.id} value={g.id}>{g.data.name}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}
          <button className="primary" onClick={submit}>Guardar</button>
        </Card>
      )}

      {payFor && (
        <Card title="Registrar pago">
          <p>{payFor.it.concept} · {payFor.it.person}{payFor.month ? ` · ${monthLabel(payFor.month)}` : ''}</p>
          <Field label="Monto"><input inputMode="decimal" value={payFor.amount} onChange={e => setPayFor({ ...payFor, amount: e.target.value })} /></Field>
          <Field label="¿De que cuenta salio el dinero?">
            <select value={payAcc || accs[0]?.id || ''} onChange={e => setPayAcc(e.target.value)}>
              {accs.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
            </select>
          </Field>
          <div className="row-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button className="primary" onClick={() => confirmPay(true)} disabled={!num(payFor.amount)}>Registrar pago</button>
            <button onClick={() => confirmPay(false)} disabled={!payFor.month && !num(payFor.amount)}>Solo marcar, sin movimiento</button>
            <button className="link" onClick={() => setPayFor(null)}>Cancelar</button>
          </div>
        </Card>
      )}

      {persons.length === 0 && <Card><Empty>No hay deudas en esta lista.</Empty></Card>}
      {persons.map(person => {
        const mine = rows.filter(r => r.i.data.person === person);
        const left = mine.filter(r => !r.i.data.aside && !r.st.finished).reduce((a, r) => a + r.st.left, 0);
        const side = mine.filter(r => r.i.data.aside && !r.st.finished).reduce((a, r) => a + r.st.left, 0);
        const monthSum = mine.filter(r => r.st.due).reduce((a, r) => a + r.st.monthly, 0);
        return (
          <Card key={person}>
            <div className="row"><b style={{ fontSize: 17 }}>{person}</b><b className={dir === 'owed' ? 'pos' : 'neg'}>{money(left)}</b></div>
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}><button className="link" onClick={() => setStmt(person)}>Ver estado de cuenta</button></div>
            <small>
              {monthSum > 0 ? `${monthLabel(month)}: ${money(monthSum)}` : `Sin mensualidades en ${monthLabel(month)}`}
              {side > 0 ? ` · aparte ${money(side)}` : ''}
            </small>

            {mine.map(({ i, st }) => (
              <div key={i.id} className="debt">
                <div className="row">
                  <div><b>{i.data.concept}</b><small>{i.data.kind === 'installments' ? (i.data.card ? `${i.data.card} · ` : '') + `${st.paidCount} de ${i.data.months} pagadas` : i.data.aside ? 'Deuda aparte' : 'Monto unico'}</small></div>
                  <div className="tx-r">
                    {i.data.kind === 'installments' ? <b>{money(st.monthly)}</b> : <b>{money(st.left)}</b>}
                  </div>
                </div>
                {i.data.kind === 'installments' ? (
                  <>
                    <Bar pct={(st.paidCount / (i.data.months || 1)) * 100} />
                    <div className="chips">
                      {st.schedule.map(m => {
                        const paid = (i.data.paid ?? []).includes(m);
                        return <button key={m} className={`chip-m ${paid ? 'paid' : ''} ${m === nowM ? 'now' : ''}`} onClick={() => toggle(i.id, i.data, m)}>{monthLabel(m)}</button>;
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <Bar pct={((i.data.settled ?? 0) / ((i.data.amount ?? 1) || 1)) * 100} />
                    <small>{money(i.data.settled ?? 0)} de {money(i.data.amount ?? 0)}</small>
                    <div className="row-actions"><button className="link" onClick={() => settle(i.id, i.data)}>{dir === 'owed' ? 'Registrar cobro' : 'Registrar pago'}</button></div>
                  </>
                )}
                {dir === 'owe' && i.data.goalId && (
                  <small>Se paga con la meta {d.allGoals.find(g => g.id === i.data.goalId)?.data.name ?? '—'} · <button className="link" style={{ padding: 0 }} onClick={() => save('ledger', { ...i.data, goalId: undefined }, d.me, i.id)}>Quitar</button></small>
                )}
                <div className="row-actions"><button className="link danger" onClick={() => confirm('¿Borrar esta deuda?') && remove(i.id)}>Borrar</button></div>
              </div>
            ))}
          </Card>
        );
      })}
    </>
  );
}
