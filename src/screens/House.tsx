import { useState } from 'react';
import { houseSummary, money, monthLabel, ym, addMonthsYm } from '../calc';
import { remove, save } from '../store';
import { Bar, Card, Data, Empty, Field, num } from '../ui';

const pctFmt = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function House({ d }: { d: Data }) {
  const [month, setMonth] = useState(ym(new Date()));
  const [edit, setEdit] = useState<Record<string, string>>({});
  const sum = houseSummary(month, d.people, d.payrolls, d.allTxns, d.allPlans, d.settles);

  function savePayroll(person: string) {
    const raw = edit[person];
    if (raw === undefined) return;
    const existing = d.payrolls.find(p => p.data.month === month && p.data.person === person);
    save('payroll', { month, person, amount: num(raw) }, null, existing?.id);
    setEdit(e => { const n = { ...e }; delete n[person]; return n; });
  }

  function settle() {
    if (!sum.debtor || !sum.creditor || sum.owes <= 0) return;
    save('settle', { month, from: sum.debtor.key, to: sum.creditor.key, amount: Math.round(sum.owes * 100) / 100, at: new Date().toISOString().slice(0, 10) }, null);
  }

  function link(key: string) {
    if (!d.peopleId) return;
    save('people', { people: d.people.map(p => p.userId === d.me ? { ...p, userId: null } : p.key === key ? { ...p, userId: d.me } : p) }, null, d.peopleId);
  }

  if (d.people.length === 0) {
    return <Card title="Casa"><Empty>Aun no hay personas configuradas para la casa.</Empty></Card>;
  }

  const settled = sum.settle;
  const nameOf = (k: string) => d.people.find(p => p.key === k)?.name ?? k;

  return (
    <>
      <div className="month-nav">
        <button onClick={() => setMonth(addMonthsYm(month, -1))}>‹</button>
        <b>{monthLabel(month)}</b>
        <button onClick={() => setMonth(addMonthsYm(month, 1))}>›</button>
      </div>

      {!d.myKey && (
        <Card title="¿Quien eres en la casa?">
          <p className="hint">Elige tu nombre para registrar a nombre tuyo los gastos de la casa.</p>
          <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
            {d.people.map(p => <button key={p.key} onClick={() => link(p.key)}>Soy {p.name}</button>)}
          </div>
        </Card>
      )}

      <Card title="Nomina del mes (para el porcentaje)">
        {d.people.map(p => {
          const current = d.payrolls.find(x => x.data.month === month && x.data.person === p.key);
          // en reposo se muestra como moneda; al tocar el campo pasa a numero para editarlo
          const val = edit[p.key] ?? (current ? money(current.data.amount) : '');
          const auto = Boolean(current?.data.auto);
          return (
            <div key={p.key} className="row" style={{ marginBottom: 8 }}>
              <span style={{ minWidth: 70 }}>{p.name}</span>
              <input inputMode="decimal" value={val} placeholder="$0.00" disabled={auto}
                onFocus={() => setEdit(s => (s[p.key] === undefined ? { ...s, [p.key]: current ? String(current.data.amount) : '' } : s))}
                onBlur={() => setEdit(s => { if (s[p.key] !== (current ? String(current.data.amount) : '')) return s; const n = { ...s }; delete n[p.key]; return n; })}
                onChange={e => setEdit(s => ({ ...s, [p.key]: e.target.value }))} />
              {auto ? <small>automatica</small> : <button onClick={() => savePayroll(p.key)} disabled={edit[p.key] === undefined}>Guardar</button>}
            </div>
          );
        })}
        <p className="hint">La nomina se toma sola de los ingresos con categoria "Nomina" que cada quien registra en su cuenta. Tambien puedes capturarla aqui a mano.</p>
        {sum.missing.length > 0 && sum.base !== month && <p className="hint">Falta la nomina de {sum.missing.join(' y ')} en {monthLabel(month)}{sum.base ? `; mientras tanto el porcentaje usa el de ${monthLabel(sum.base)}.` : '.'}</p>}
        {sum.missing.length > 0 && !sum.base && <p className="hint">Aun no hay un mes con la nomina de todos para calcular el porcentaje.</p>}
        {sum.totalIncome > 0 && (
          <>
            <Bar pct={sum.rows[0].pct * 100} />
            <div className="row"><small>{sum.rows[0].name} {pctFmt(sum.rows[0].pct)}</small><small>{sum.rows[1]?.name} {sum.rows[1] ? pctFmt(sum.rows[1].pct) : ''}</small></div>
          </>
        )}
      </Card>

      <Card title="Reparto de gastos de la casa">
        {sum.rows.map(r => (
          <div key={r.key} className="row-block">
            <div className="row"><b>{r.name}</b><span>{pctFmt(r.pct)} de la casa</span></div>
            <div className="row"><small>Pago de contado</small><span>{money(r.cash)}</span></div>
            <div className="row"><small>Pago mensualidades</small><span>{money(r.installments)}</span></div>
            <div className="row"><small>Total que pago</small><b>{money(r.paid)}</b></div>
            <div className="row"><small>Le correspondia pagar</small><span>{money(r.should)}</span></div>
          </div>
        ))}
        <div className="row"><small>Total de gastos de la casa</small><b>{money(sum.totalSpent)}</b></div>
        {sum.unassigned > 0 && <p className="error">Hay {money(sum.unassigned)} sin "quien pago" asignado; no entran al reparto.</p>}

        <div className="settle">
          {settled ? (
            <>
              <p><b>Liquidado:</b> {nameOf(settled.data.from)} le transfirio {money(settled.data.amount)} a {nameOf(settled.data.to)} ({settled.data.at}).</p>
              <button className="link danger" onClick={() => remove(settled.id)}>Deshacer liquidacion</button>
            </>
          ) : sum.owes > 0.005 && sum.debtor && sum.creditor ? (
            <>
              <p><b>{sum.debtor.name}</b> le debe <b>{money(sum.owes)}</b> a <b>{sum.creditor.name}</b>.</p>
              <p className="hint">A fin de mes se hace la transferencia y se marca como liquidado.</p>
              <button className="primary" onClick={settle}>Marcar como liquidado</button>
            </>
          ) : (
            <p><b>Estan a mano</b> este mes.</p>
          )}
        </div>
      </Card>

      {sum.duePlans.length > 0 && (
        <Card title={`Mensualidades de ${monthLabel(month)}`}>
          {sum.duePlans.map(p => {
            const monthly = p.data.total / p.data.months;
            const paid = (p.data.paid ?? []).includes(month);
            return (
              <div key={p.id} className="row" style={{ marginBottom: 6 }}>
                <div><b>{p.data.description}</b><small>{nameOf(p.data.paidBy ?? '')}</small></div>
                <div className="tx-r"><span>{money(monthly)}</span><span className={`chip ${paid ? 'ok' : 'behind'}`}>{paid ? 'pagada' : 'pendiente'}</span></div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
