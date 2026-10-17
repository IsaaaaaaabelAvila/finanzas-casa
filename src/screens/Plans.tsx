import { useState } from 'react';
import { monthLabel, money, planStatus, today, ym } from '../calc';
import { remove, save } from '../store';
import type { Plan } from '../types';
import { Bar, Card, Data, Empty, Field, num, ownerLabel } from '../ui';

export default function Plans({ d }: { d: Data }) {
  const nowM = ym(new Date());
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [total, setTotal] = useState('');
  const [months, setMonths] = useState('6');
  const [start, setStart] = useState(today());
  const [first, setFirst] = useState(nowM);
  const [accountId, setAccountId] = useState('');
  const [shared, setShared] = useState(false);
  const [payer, setPayer] = useState('');

  const cards = d.allAccounts.filter(a => a.data.type === 'credit' && (a.owner === d.me || a.owner === null));
  const accName = (id?: string) => d.allAccounts.find(a => a.id === id)?.data.name;
  const personName = (k?: string) => d.people.find(p => p.key === k)?.name;
  const items = d.plans.map(p => ({ p, st: planStatus(p.data, nowM) })).sort((a, b) => Number(a.st.finished) - Number(b.st.finished));
  const monthly = items.filter(x => x.st.due && !x.st.finished).reduce((a, x) => a + x.st.monthly, 0);
  const pendingMonth = items.filter(x => x.st.due && !x.st.paidThisMonth).reduce((a, x) => a + x.st.monthly, 0);
  const pending = items.reduce((a, x) => a + x.st.remainingAmount, 0);

  function submit() {
    if (!desc.trim() || !num(total)) return;
    const plan: Plan = {
      description: desc.trim(), total: num(total), months: Math.max(1, Math.round(num(months))),
      startDate: start, firstMonth: first, paid: [],
      accountId: accountId || (shared ? undefined : cards[0]?.id) || undefined,
      paidBy: shared ? (payer || d.myKey || d.people[0]?.key) : undefined
    };
    save('plan', plan, shared ? null : d.me);
    setDesc(''); setTotal(''); setOpen(false);
  }

  function toggle(id: string, owner: string | null, p: Plan, m: string) {
    const set = new Set(p.paid ?? []);
    if (set.has(m)) set.delete(m); else set.add(m);
    save('plan', { ...p, paid: [...set].sort() }, owner, id);
  }

  return (
    <>
      <div className="month-nav"><b>Pagos a meses</b><button className="primary" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : '+ Nuevo'}</button></div>
      <div className="stats">
        <div className="stat"><small>Mensualidades de {monthLabel(nowM)}</small><b>{money(monthly)}</b></div>
        <div className="stat"><small>Falta marcar este mes</small><b className={pendingMonth > 0 ? 'neg' : 'pos'}>{money(pendingMonth)}</b></div>
        <div className="stat"><small>Total pendiente</small><b className="neg">{money(pending)}</b></div>
      </div>

      {open && (
        <Card title="Nueva compra a meses">
          <p className="hint">Registra aqui la compra completa (no la anotes ademas como egreso, para no duplicarla).</p>
          <Field label="Descripcion"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Refrigerador, celular…" /></Field>
          <Field label="Monto total"><input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></Field>
          <Field label="Numero de meses"><input inputMode="numeric" value={months} onChange={e => setMonths(e.target.value)} /></Field>
          <Field label="Fecha de compra"><input type="date" value={start} onChange={e => setStart(e.target.value)} /></Field>
          <Field label="Mes de la primera mensualidad"><input type="month" value={first} onChange={e => setFirst(e.target.value)} /></Field>
          <Field label="Tarjeta (opcional en compras de la casa)">
            <select value={accountId || (shared ? '' : cards[0]?.id) || ''} onChange={e => setAccountId(e.target.value)}>
              <option value="">— ninguna —</option>
              {cards.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Compra comun de la casa</label>
          {shared && d.people.length > 0 && (
            <Field label="Quien la paga">
              <select value={payer || d.myKey || d.people[0].key} onChange={e => setPayer(e.target.value)}>
                {d.people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <button className="primary" onClick={submit}>Guardar</button>
        </Card>
      )}

      {items.length === 0 && <Card><Empty>No hay pagos a meses en esta vista.</Empty></Card>}
      {items.map(({ p, st }) => (
        <Card key={p.id}>
          <div className="row"><b>{p.data.description}</b><span>{money(st.monthly)}/mes</span></div>
          <Bar pct={(st.paidCount / p.data.months) * 100} />
          <small>
            {st.finished ? 'Liquidado' : `${st.paidCount} de ${p.data.months} pagadas · faltan ${st.remainingMonths} (${money(st.remainingAmount)})`}
            {' · '}{ownerLabel(p.owner)}{personName(p.data.paidBy) ? ` · paga ${personName(p.data.paidBy)}` : ''}{accName(p.data.accountId) ? ` · ${accName(p.data.accountId)}` : ''}
          </small>
          <div className="chips">
            {st.schedule.map(m => {
              const paid = (p.data.paid ?? []).includes(m);
              return (
                <button key={m} className={`chip-m ${paid ? 'paid' : ''} ${m === nowM ? 'now' : ''}`} onClick={() => toggle(p.id, p.owner, p.data, m)} title={paid ? 'Pagada (toca para desmarcar)' : 'Toca para marcar como pagada'}>
                  {monthLabel(m)}
                </button>
              );
            })}
          </div>
          <div className="row-actions"><button className="link danger" onClick={() => confirm('¿Borrar?') && remove(p.id)}>Borrar</button></div>
        </Card>
      ))}
    </>
  );
}
