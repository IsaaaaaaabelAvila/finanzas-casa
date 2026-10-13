import { useState } from 'react';
import { money, planProgress, today } from '../calc';
import { remove, save } from '../store';
import { Bar, Card, Data, Empty, Field, num, ownerLabel } from '../ui';

export default function Plans({ d }: { d: Data }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [total, setTotal] = useState('');
  const [months, setMonths] = useState('6');
  const [start, setStart] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [shared, setShared] = useState(false);

  const cards = d.allAccounts.filter(a => a.data.type === 'credit' && (a.owner === d.me || a.owner === null));
  const accName = (id: string) => d.allAccounts.find(a => a.id === id)?.data.name ?? '—';
  const active = d.plans.map(p => ({ p, pr: planProgress(p.data) }));
  const monthly = active.filter(x => !x.pr.finished).reduce((a, x) => a + x.pr.monthly, 0);
  const pending = active.filter(x => !x.pr.finished).reduce((a, x) => a + x.pr.remainingAmount, 0);

  function submit() {
    const acc = accountId || cards[0]?.id;
    if (!desc.trim() || !num(total) || !acc) return;
    save('plan', { accountId: acc, description: desc.trim(), total: num(total), months: Math.max(1, Math.round(num(months))), startDate: start }, shared ? null : d.me);
    setDesc(''); setTotal(''); setOpen(false);
  }

  return (
    <>
      <div className="month-nav"><b>Pagos a meses</b><button className="primary" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : '+ Nuevo'}</button></div>
      <div className="stats">
        <div className="stat"><small>Pagas al mes</small><b>{money(monthly)}</b></div>
        <div className="stat"><small>Total pendiente</small><b className="neg">{money(pending)}</b></div>
      </div>

      {open && (
        <Card title="Nueva compra a meses">
          {cards.length === 0 && <p className="error">Primero crea una tarjeta de credito en Cuentas.</p>}
          <p className="hint">Registra aqui la compra completa (no la anotes ademas como egreso, para no duplicarla).</p>
          <Field label="Descripcion"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Refrigerador, celular…" /></Field>
          <Field label="Monto total"><input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></Field>
          <Field label="Numero de meses"><input inputMode="numeric" value={months} onChange={e => setMonths(e.target.value)} /></Field>
          <Field label="Fecha de compra"><input type="date" value={start} onChange={e => setStart(e.target.value)} /></Field>
          <Field label="Tarjeta">
            <select value={accountId || cards[0]?.id || ''} onChange={e => setAccountId(e.target.value)}>
              {cards.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Compra comun de la casa</label>
          <button className="primary" onClick={submit} disabled={cards.length === 0}>Guardar</button>
        </Card>
      )}

      {active.length === 0 && <Card><Empty>No hay pagos a meses.</Empty></Card>}
      {active.map(({ p, pr }) => (
        <Card key={p.id}>
          <div className="row"><b>{p.data.description}</b><span>{money(pr.monthly)}/mes</span></div>
          <Bar pct={(pr.paid / p.data.months) * 100} />
          <small>
            {pr.finished ? 'Liquidado' : `Pago ${pr.paid} de ${p.data.months} · faltan ${pr.remainingMonths} meses (${money(pr.remainingAmount)})`}
            {' · '}{accName(p.data.accountId)} · {ownerLabel(p.owner)}
          </small>
          <div className="row-actions"><button className="link danger" onClick={() => confirm('¿Borrar?') && remove(p.id)}>Borrar</button></div>
        </Card>
      ))}
    </>
  );
}
