import { useState } from 'react';
import { budgetCtx } from '../budget';
import { casaPct, firstPaymentMonth, ledgerStatus, monthLabel, money, planAjenaLeft, planOtherPct, planStatus, today, ym } from '../calc';
import { remove, save } from '../store';
import { CAT_ICON, EXPENSE_CATS, Plan } from '../types';
import { Bar, Card, Data, Empty, Field, num, ownerLabel } from '../ui';
import Debts from './Debts';
import { releaseFromGoal, unrelease } from '../bag';
import Commitments from './Commitments';

type Who = 'all' | 'mine' | 'house' | 'others';
const r2 = (x: number) => Math.round(x * 100) / 100;

function PlansList({ d, goDebts }: { d: Data; goDebts: () => void }) {
  const nowM = ym(new Date());
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [total, setTotal] = useState('');
  const [months, setMonths] = useState('6');
  const [start, setStart] = useState(today());
  const [first, setFirst] = useState(nowM);
  const [firstTouched, setFirstTouched] = useState(false);
  const [category, setCategory] = useState('');
  const [catErr, setCatErr] = useState(false);
  const [who, setWho] = useState<Who>('all');
  const [accountId, setAccountId] = useState('');
  const [shared, setShared] = useState(false);
  const [payer, setPayer] = useState('');
  const [goalId, setGoalId] = useState('');
  const [partKey, setPartKey] = useState('');
  const [partPct, setPartPct] = useState('');
  const [cardF, setCardF] = useState('');

  const cards = d.allAccounts.filter(a => a.data.type === 'credit' && (a.owner === d.me || a.owner === null));
  const accName = (id?: string) => d.allAccounts.find(a => a.id === id)?.data.name;
  const personName = (k?: string) => d.people.find(p => p.key === k)?.name;
  const others = d.people.filter(p => p.key !== d.myKey);
  const bctx = budgetCtx(d);
  const mineAt = (m: string) => casaPct(bctx, m);
  // una compra liquidada cuyo calendario ya termino deja de mostrarse
  const cardOf = (p: Plan) => p.cardId ?? p.accountId ?? '';
  type Row = { k: 'plan'; id: string; grp: 'mine' | 'house'; p: (typeof d.plans)[number]; st: ReturnType<typeof planStatus>; card: string; monthly: number; rem: number; yours: number; yoursRem: number }
    | { k: 'led'; id: string; grp: 'others'; l: (typeof d.ledger)[number]; st: ReturnType<typeof ledgerStatus>; card: string; monthly: number; rem: number; yours: number; yoursRem: number };
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const planRows: Row[] = d.plans.map(p => {
    const st = planStatus(p.data, nowM);
    const mine = p.owner === d.me;
    const rem = r2(st.remainingAmount), monthly = r2(st.monthly);
    // mi parte: en mis compras lo que no es de otro responsable; en las de la casa mi % de lo que reparte la casa
    const yours = mine ? r2(st.monthly * (1 - planOtherPct(p.data, mineAt(nowM)))) : r2(st.shareMonthly * d.pat.housePct);
    const yoursRem = mine ? r2(rem - planAjenaLeft(p.data, mineAt)) : r2(st.shareRemaining * d.pat.housePct);
    return { k: 'plan' as const, id: p.id, grp: mine ? 'mine' as const : 'house' as const, p, st, card: cardOf(p.data), monthly, rem, yours, yoursRem };
  });
  const ledRows: Row[] = d.ledger.filter(l => l.data.dir === 'owed' && l.data.kind === 'installments').map(l => {
    const st = ledgerStatus(l.data, nowM);
    const card = d.allAccounts.find(a => l.data.card && norm(a.data.name) === norm(l.data.card))?.id ?? '';
    return { k: 'led' as const, id: l.id, grp: 'others' as const, l, st, card, monthly: r2(st.monthly), rem: r2(st.monthly * st.remainingMonths), yours: 0, yoursRem: 0 };
  });
  const lastM = (r: Row) => r.st.schedule[r.st.schedule.length - 1];
  const allItems = [...planRows, ...ledRows].filter(r => !(r.st.finished && lastM(r) < nowM)).sort((a, b) => Number(a.st.finished) - Number(b.st.finished));
  const inWho = (r: Row) => who === 'all' || r.grp === who;
  // tarjetas que aparecen en la lista, para filtrar
  const cardIds = [...new Set(allItems.filter(inWho).map(r => r.card))].sort((a, b) => (accName(a) ?? 'zzz').localeCompare(accName(b) ?? 'zzz'));
  const cardLabel = (id: string) => (id ? accName(id) ?? 'Tarjeta de la casa' : 'Sin tarjeta');
  const items = allItems.filter(inWho).filter(r => cardF === '' || r.card === (cardF === '__none' ? '' : cardF));
  // cada mensualidad y cada saldo se redondea a centavos antes de sumar: Todo = Mio + Casa + De otros
  const tot = (rows: Row[]) => {
    const act = rows.filter(r => r.st.due && !r.st.finished);
    return {
      monthly: act.reduce((a, r) => a + r.monthly, 0),
      pendingMonth: act.filter(r => !r.st.paidThisMonth).reduce((a, r) => a + r.monthly, 0),
      pending: rows.reduce((a, r) => a + r.rem, 0),
      yours: act.reduce((a, r) => a + r.yours, 0),
      yoursRem: rows.reduce((a, r) => a + r.yoursRem, 0)
    };
  };
  const T = tot(items);
  const Tu = tot(items.filter(r => r.grp !== 'others'));
  const To = tot(items.filter(r => r.grp === 'others'));
  const monthly = T.monthly, pendingMonth = T.pendingMonth, pending = T.pending;
  const whoLabel = who === 'all' ? 'Todo' : who === 'mine' ? 'Mio' : who === 'house' ? 'Casa' : 'De otros';

  // resumen neto de todo lo que falta a meses (solo vista Todo)
  const rem = (p: { data: Plan }) => planStatus(p.data, nowM).remainingAmount;
  const remShare = (p: { data: Plan }) => planStatus(p.data, nowM).shareRemaining;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const own = d.plans.filter(p => p.owner === d.me);
  const house = d.plans.filter(p => p.owner === null);
  const pctMe = d.pat.housePct;
  const ownTotal = sum(own.map(rem));
  const ownMine = ownTotal - d.pat.ajenaPlanes;
  const byOthers = d.pat.ajenaLedger + d.pat.ajenaPlanes;
  const houseTotal = sum(house.map(remShare));   // lo que reparte la casa
  const houseCard = sum(house.map(rem));         // lo que aun cobra la tarjeta
  const houseCovered = houseCard - houseTotal;   // ya cubierto aparte (reembolso a la tarjeta u otra persona)
  const housePay = sum(house.filter(p => p.data.paidBy === d.myKey).map(remShare));
  const houseOwe = houseTotal - housePay;
  const grossAll = ownTotal + d.pat.ajenaLedger + houseCard;
  const netAll = ownMine + houseTotal * pctMe;
  const otherName = others[0]?.name ?? 'Los demas';

  const chosen = cards.find(a => a.id === (accountId || (shared ? '' : cards[0]?.id)));
  const auto = chosen?.data.cutDay && chosen.data.payDay ? firstPaymentMonth(start, chosen.data.cutDay, chosen.data.payDay) : null;
  const firstMonth = firstTouched || !auto ? first : auto;

  function submit() {
    if (!desc.trim() || !num(total)) return;
    if (!category) { setCatErr(true); return; }
    const plan: Plan = {
      description: desc.trim(), total: num(total), months: Math.max(1, Math.round(num(months))),
      startDate: start, firstMonth, paid: [], category, goalId: goalId || undefined,
      accountId: accountId || (shared ? undefined : cards[0]?.id) || undefined,
      paidBy: shared ? (payer || d.myKey || d.people[0]?.key) : undefined,
      partes: !shared && partKey ? [{ key: partKey, pct: num(partPct) > 0 ? Math.min(100, num(partPct)) : undefined }] : undefined
    };
    save('plan', plan, shared ? null : d.me);
    setDesc(''); setTotal(''); setCategory(''); setCatErr(false); setOpen(false);
  }

  function toggle(id: string, owner: string | null, p: Plan, m: string) {
    const set = new Set(p.paid ?? []);
    if (set.has(m)) set.delete(m); else set.add(m);
    save('plan', { ...p, paid: [...set].sort() }, owner, id);
    if (p.goalId) { if (set.has(m)) releaseFromGoal(d, `${id}:${m}`, p.goalId, p.total / p.months, p.description); else unrelease(d, `${id}:${m}`); }
  }

  return (
    <>
      <div className="month-nav"><b>Compras a meses</b><button className="primary" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : '+ Nuevo'}</button></div>
      <div className="chips" style={{ margin: '4px 0 8px' }}>
        {([['all', 'Todo'], ['mine', 'Mio'], ['house', 'Casa'], ['others', 'De otros']] as [Who, string][]).map(([k, l]) => <button key={k} className={`chip-m ${who === k ? 'paid' : ''}`} onClick={() => { setWho(k); setCardF(''); }}>{l}</button>)}
      </div>
      {cardIds.length > 1 && (
        <div className="chips" style={{ margin: '4px 0 8px' }}>
          <button className={`chip-m ${cardF === '' ? 'paid' : ''}`} onClick={() => setCardF('')}>Todas</button>
          {cardIds.map(id => <button key={id || '__none'} className={`chip-m ${cardF === (id || '__none') ? 'paid' : ''}`} onClick={() => setCardF(id || '__none')}>{cardLabel(id)}</button>)}
        </div>
      )}
      <div className="stats">
        <div className="stat"><small>Mensualidades de {monthLabel(nowM)}</small><b>{money(monthly)}</b></div>
        <div className="stat"><small>{who === 'others' ? 'Falta que te reembolsen' : 'Falta marcar este mes'}</small><b className={pendingMonth > 0 ? 'neg' : 'pos'}>{money(pendingMonth)}</b></div>
        <div className="stat"><small>Total pendiente</small><b className="neg">{money(pending)}</b></div>
      </div>
      {who === 'all' && (
        <Card>
          <div className="row"><b>Tu parte (Mio + Casa)</b><span>{money(Tu.monthly)}/mes · pendiente {money(Tu.pending)}</span></div>
          <div className="row"><b>Por reembolsar (De otros)</b><span>{money(To.monthly)}/mes · pendiente {money(To.pending)}</span></div>
          <small>Total del mes = {money(Tu.monthly)} + {money(To.monthly)} = {money(Tu.monthly + To.monthly)}. Solo lo que es tuyo de verdad (despues de lo que reembolsan otros y tu % de la casa): {money(Tu.yours)}/mes · pendiente {money(Tu.yoursRem)}.</small>
        </Card>
      )}
      {who !== 'all' && who !== 'others' && (
        <small style={{ display: 'block', margin: '0 0 8px' }}>De {whoLabel}, solo tu parte: {money(T.yours)}/mes · pendiente {money(T.yoursRem)}.</small>
      )}

      {who === 'all' && cardF === '' && (
        <Card title="Todo lo que se debe aun a meses (neto)">
          <small>TOTAL PENDIENTE (BRUTO)</small>
          <div className="big neg" style={{ fontSize: 34, lineHeight: 1.1 }}>{money(grossAll)}</div>
          <div className="row"><small>Mis compras a meses (solo mi parte)</small><span>{money(ownMine)}</span></div>
          <div className="row"><small>Pago por otras personas (me lo reembolsan)</small><span>{money(byOthers)}</span></div>
          {d.pat.ajenaPlanes > 0.5 && <div className="row"><small>· Parte ajena de mis compras con otros responsables</small><small>{money(d.pat.ajenaPlanes)}</small></div>}
          <div className="row"><small>Casa (completa, como la cobra la tarjeta)</small><span>{money(houseCard)}</span></div>
          {houseCovered > 0.5 && <div className="row"><small>· Ya cubierto aparte (reembolso a la tarjeta u otra persona)</small><small>{money(houseCovered)}</small></div>}
          {houseTotal > 0.5 && (
            <>
              <div className="row"><small>· Lo que reparte la casa</small><small>{money(houseTotal)}</small></div>
              <div className="row"><small>· Las pago yo (soy el titular; los demas me reembolsan su parte)</small><small>{money(housePay)}</small></div>
              <div className="row"><small>· Las paga otro titular (me toca mi parte)</small><small>{money(houseOwe)}</small></div>
              <div className="row"><small>Porcentaje de la casa este mes</small><small>{(pctMe * 100).toFixed(1)}% yo · {((1 - pctMe) * 100).toFixed(1)}% {otherName}</small></div>
              <div className="row"><small>Mi parte neta de la casa ({(pctMe * 100).toFixed(1)}% de {money(houseTotal)})</small><span>{money(houseTotal * pctMe)}</span></div>
              <div className="row"><small>Parte de {otherName} en la casa</small><small>{money(houseTotal * (1 - pctMe))}</small></div>
            </>
          )}
          <div className="row"><b>Lo que realmente es mio</b><b className="neg">{money(netAll)}</b></div>
          <small>Neto = mis compras ({money(ownMine)}) + mi parte de la casa ({money(houseTotal * pctMe)}). Bruto − neto = {money(grossAll - netAll)}, que es lo que otros me reembolsan o ya esta cubierto aparte.</small>
        </Card>
      )}

      {open && (
        <Card title="Nueva compra a meses">
          <p className="hint">Registra aqui la compra completa (no la anotes ademas como egreso, para no duplicarla).</p>
          <Field label="Descripcion"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Refrigerador, celular…" /></Field>
          <Field label="Monto total"><input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></Field>
          <Field label="Numero de meses"><input inputMode="numeric" value={months} onChange={e => setMonths(e.target.value)} /></Field>
          <Field label="Fecha de compra"><input type="date" value={start} onChange={e => { setStart(e.target.value); setFirstTouched(false); }} /></Field>
          <Field label="Tarjeta (opcional en compras de la casa)">
            <select value={accountId || (shared ? '' : cards[0]?.id) || ''} onChange={e => { setAccountId(e.target.value); setFirstTouched(false); }}>
              <option value="">— ninguna —</option>
              {cards.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
            </select>
          </Field>
          <Field label="Mes de la primera mensualidad"><input type="month" value={firstMonth} onChange={e => { setFirst(e.target.value); setFirstTouched(true); }} /></Field>
          {auto && !firstTouched && chosen && <p className="hint">Calculado con el corte (dia {chosen.data.cutDay}) y el pago (dia {chosen.data.payDay}) de {chosen.data.name}: la compra del {start} entra al corte de ese mes y se paga en {monthLabel(auto)}.</p>}
          <Field label="Categoria (obligatoria)"><select value={category} onChange={e => { setCategory(e.target.value); setCatErr(false); }}><option value="" disabled>— elegir categoria —</option>{EXPENSE_CATS.map(c => <option key={c} value={c}>{CAT_ICON[c] ? `${CAT_ICON[c]} ${c}` : c}</option>)}</select>{catErr && !category && <small className="error">Elige una categoria para guardar.</small>}</Field>
          {d.goals.length > 0 && !shared && (
            <>
              <label className="check"><input type="checkbox" checked={goalId !== ''} onChange={e => setGoalId(e.target.checked ? d.goals[0].id : '')} /> Pagar con una meta (las mensualidades no restan de mi libre)</label>
              {goalId !== '' && (
                <Field label="Meta">
                  <select value={goalId} onChange={e => setGoalId(e.target.value)}>
                    {d.goals.map(g => <option key={g.id} value={g.id}>{g.data.name}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}
          {!shared && others.length > 0 && (
            <>
              <Field label="Responsable de una parte (opcional)">
                <select value={partKey} onChange={e => setPartKey(e.target.value)}>
                  <option value="">— solo yo —</option>
                  {others.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </Field>
              {partKey && <Field label="% de la compra que le toca (vacio = segun ingresos de cada mes; 50 = mitad y mitad)"><input inputMode="decimal" value={partPct} onChange={e => setPartPct(e.target.value)} placeholder="Segun ingresos" /></Field>}
            </>
          )}
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

      {items.length === 0 && <Card><Empty>No hay compras a meses en esta vista.</Empty></Card>}
      {items.map(r => r.k === 'led' ? (
        <Card key={r.id}>
          <div className="row"><b>{r.l.data.concept} · {r.l.data.person}</b><span>{money(r.st.monthly)}/mes</span></div>
          <Bar pct={((r.st.paidCount) / Math.max(1, r.l.data.months ?? 1)) * 100} />
          <small>
            {r.st.finished ? 'Liquidado' : `${r.st.paidCount} de ${r.l.data.months} reembolsadas · faltan ${r.st.remainingMonths} (${money(r.rem)})`}
            {' · De otros'}{r.l.data.card ? ` · ${r.l.data.card}` : ''}
          </small>
          <div className="chips">
            {r.st.schedule.map(m => <span key={m} className={`chip-m ${(r.l.data.paid ?? []).includes(m) ? 'paid' : ''} ${m === nowM ? 'now' : ''}`}>{monthLabel(m)}</span>)}
          </div>
          <small>Es lo que te deben (no es tu gasto). El reembolso se marca en <button className="link" style={{ padding: 0 }} onClick={goDebts}>Deudas con personas</button>.</small>
        </Card>
      ) : (() => { const { p, st } = r; return (
        <Card key={p.id}>
          <div className="row"><b>{p.data.description}</b><span>{money(st.monthly)}/mes</span></div>
          <Bar pct={(st.paidCount / p.data.months) * 100} />
          <small>
            {st.finished ? 'Liquidado' : `${st.paidCount} de ${p.data.months} pagadas · faltan ${st.remainingMonths} (${money(st.remainingAmount)})`}
            {' · '}{ownerLabel(p.owner)}{personName(p.data.paidBy) ? ` · paga ${personName(p.data.paidBy)}` : ''}{accName(cardOf(p.data)) ? ` · ${accName(cardOf(p.data))}` : ''}
          </small>
          {p.owner === d.me && (
            (p.data.partes ?? []).length > 0 ? (
              <div style={{ marginTop: 6 }}>
                <small>
                  Titular: yo · {(p.data.partes ?? []).map(x => `${personName(x.key) ?? '—'} ${x.pct != null ? x.pct + '%' : 'segun ingresos'}`).join(', ')} · mi parte {money(st.monthly * (1 - planOtherPct(p.data, mineAt(nowM))))}/mes · por reembolsar {money(planAjenaLeft(p.data, mineAt))}
                  {' · '}<button className="link" style={{ padding: 0 }} onClick={() => save('plan', { ...p.data, partes: undefined, reimb: undefined }, p.owner, p.id)}>Quitar</button>
                </small>
                <div className="chips">
                  {st.schedule.map(m => {
                    const r = (p.data.reimb ?? []).includes(m);
                    return <button key={m} className={`chip-m ${r ? 'paid' : ''}`} title={r ? 'Reembolsado (toca para desmarcar)' : 'Toca cuando te reembolsen esta mensualidad'} onClick={() => save('plan', { ...p.data, reimb: r ? (p.data.reimb ?? []).filter(x => x !== m) : [...(p.data.reimb ?? []), m].sort() }, p.owner, p.id)}>{monthLabel(m)}</button>;
                  })}
                </div>
              </div>
            ) : others.length > 0 && (
              <label className="field mini"><span>¿Alguien mas es responsable de una parte?</span>
                <select value="" onChange={e => { const k = e.target.value; if (!k) return; const r = prompt('¿Que % de la compra le toca? (vacio = segun ingresos de cada mes)', ''); if (r === null) return; const v = num(r); save('plan', { ...p.data, partes: [{ key: k, pct: v > 0 ? Math.min(100, v) : undefined }] }, p.owner, p.id); }}>
                  <option value="">elegir…</option>
                  {others.map(x => <option key={x.key} value={x.key}>{x.name}</option>)}
                </select>
              </label>
            )
          )}
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
          {(p.owner === d.me || (p.owner === null && p.data.paidBy === d.myKey)) && cards.length > 0 && (
            (p.data.cardId ?? p.data.accountId)
              ? <small>Tarjeta: {accName(p.data.cardId ?? p.data.accountId) ?? '—'}{p.data.cardId && <> · <button className="link" style={{ padding: 0 }} onClick={() => save('plan', { ...p.data, cardId: undefined }, p.owner, p.id)}>Cambiar</button></>}</small>
              : (
                <label className="field mini"><span>¿De que tarjeta es? (se marcan solas al pagarla)</span>
                  <select value="" onChange={e => e.target.value && save('plan', { ...p.data, cardId: e.target.value }, p.owner, p.id)}>
                    <option value="">elegir…</option>
                    {cards.map(a => <option key={a.id} value={a.id}>{a.data.name}</option>)}
                  </select>
                </label>
              )
          )}
          {p.owner === null && (
            <small>
              {p.data.covered ? `Cubierto aparte ${money(p.data.covered)} · la casa reparte ${money(st.shareMonthly)}/mes` : 'Sin cubierto aparte'}
              {' · '}<button className="link" style={{ padding: 0 }} onClick={() => { const r = prompt('¿Cuanto del total ya cubrio otra persona o un reembolso a la tarjeta? (0 = nada)', String(p.data.covered ?? 0)); if (r === null) return; const v = Math.max(0, num(r)); save('plan', { ...p.data, covered: v > 0 ? v : undefined }, p.owner, p.id); }}>{p.data.covered ? 'Cambiar' : 'Agregar'}</button>
            </small>
          )}
          {p.data.goalId && (
            <small>Se paga con la meta {d.allGoals.find(g => g.id === p.data.goalId)?.data.name ?? '—'} · <button className="link" style={{ padding: 0 }} onClick={() => save('plan', { ...p.data, goalId: undefined }, p.owner, p.id)}>Quitar</button></small>
          )}
          <div className="row-actions"><button className="link danger" onClick={() => confirm('¿Borrar?') && remove(p.id)}>Borrar</button></div>
        </Card>
      ); })())}
    </>
  );
}

export default function Plans({ d }: { d: Data }) {
  const [view, setView] = useState<'plans' | 'debts' | 'commit'>('plans');
  return (
    <>
      <div className="month-nav"><b>Pagos y deudas</b></div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={view === 'plans' ? 'on' : ''} onClick={() => setView('plans')}>Compras a meses</button>
        <button className={view === 'debts' ? 'on' : ''} onClick={() => setView('debts')}>Deudas con personas</button>
        <button className={view === 'commit' ? 'on' : ''} onClick={() => setView('commit')}>Compromisos</button>
      </div>
      {view === 'plans' ? <PlansList d={d} goDebts={() => setView('debts')} /> : view === 'debts' ? <Debts d={d} /> : <Commitments d={d} />}
    </>
  );
}
