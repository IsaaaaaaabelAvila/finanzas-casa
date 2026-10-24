import { budgetCtx } from '../budget';
import { addMonthsYm, budgetFor, budgetLevel, houseSummary, levelText, money, monthLabel, ym } from '../calc';
import { save } from '../store';
import { Bar, Card, Data } from '../ui';

const COLOR = { green: 'var(--good)', amber: 'var(--warn)', red: 'var(--bad)' } as const;

/** Tarjeta "Libre para gastar": presupuesto + arrastre - comprometido - gastado. */
export default function FreeCard({ d }: { d: Data }) {
  const ctx = budgetCtx(d);
  const st = d.setting!.data;
  const now = new Date();
  const cur = ym(now);
  const start = st.startMonth ?? '2026-11';
  const preview = cur < start;
  const month = preview ? start : cur;
  const b = budgetFor(ctx, month);
  if (!b) return null;

  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const g0 = b.base + b.carry - b.commit; // lo que se puede gastar libremente en el mes
  const level = budgetLevel(b, now);
  const projected = !preview && day > 0 ? g0 - (b.spent / day) * dim : null;
  const cfgNow = (st.plan ?? []).filter(c => c.from <= month).slice(-1)[0];

  // estimado de como cerraria la casa este mes (con el porcentaje del ultimo mes cerrado)
  const hs = preview ? null : houseSummary(month, d.people, d.payrolls, d.allTxns, d.allPlans, d.settles, addMonthsYm(month, -1));
  const mine = hs?.rows.find(r => r.key === d.myKey);
  const partner = hs?.rows.find(r => r.key !== d.myKey);

  // meses cerrados desde el inicio
  const closed: NonNullable<ReturnType<typeof budgetFor>>[] = [];
  if (!preview) for (let m = start; m < cur; m = addMonthsYm(m, 1)) { const x = budgetFor(ctx, m); if (x) closed.push(x); }
  const setPct = (m: string, pct: number) => save('setting', { ...(d.setting?.data ?? {}), carryDecisions: { ...(d.setting?.data.carryDecisions ?? {}), [m]: pct } }, d.me, d.setting?.id);
  const askPct = (m: string, cur: number) => { const v = prompt('¿Que % pasa al mes siguiente? (0 a 100). El resto queda en tu ahorro.', String(cur)); if (v === null) return; const n = Math.max(0, Math.min(100, parseFloat(v.replace(',', '.')))); if (Number.isFinite(n)) setPct(m, n); };

  return (
    <>
      <Card className="total" title={preview ? `Asi empieza ${monthLabel(start)}` : 'Libre para gastar'}>
        <small>{preview ? 'EL ARRASTRE EMPIEZA EN ESTE MES' : monthLabel(month).toUpperCase()}</small>
        <div className="big" style={{ color: !preview && b.libre <= 0 ? 'var(--bad)' : undefined }}>{money(b.libre)}</div>
        {!preview && <Bar pct={g0 > 0 ? (b.spent / g0) * 100 : 100} tone={level === 'red' ? 'bad' : level === 'amber' ? 'warn' : 'good'} />}
        <div className="row"><small>{cfgNow?.mode === 'saving' ? `Ingresos de ${monthLabel(addMonthsYm(month, -1))} − ahorro fijo` : 'Presupuesto'}</small><span>{money(b.base)}</span></div>
        <div className="row"><small>Arrastre del mes anterior</small><span className={b.carry < 0 ? 'neg' : b.carry > 0 ? 'pos' : ''}>{b.carry >= 0 ? '+' : '−'}{money(Math.abs(b.carry))}</span></div>
        <div className="row"><small>Comprometido (mensualidades, deudas, tu parte de la casa)</small><span>−{money(b.commit)}</span></div>
        <div className="row"><small>Gastado en el mes</small><span>−{money(b.spent)}</span></div>
        {mine && hs && (mine.paid > 0 || mine.should > 0) && (
          <div className="settle">
            <small>CASA · ESTIMADO DEL MES</small>
            <div className="row"><small>Has pagado</small><span>{money(mine.paid)}</span></div>
            <div className="row"><small>Te tocan ({(mine.pct * 100).toFixed(1)}%)</small><span>{money(mine.should)}</span></div>
            {hs.settle
              ? <p className="hint">Este mes ya esta liquidado.</p>
              : mine.diff > 0.5
                ? <p className="hint">A fin de mes {partner?.name ?? 'tu pareja'} te regresaria ~<b>{money(mine.diff)}</b>. Ya esta contado en tu libre: solo se descuenta lo que te toca.</p>
                : mine.diff < -0.5
                  ? <p className="hint">A fin de mes le darias a {partner?.name ?? 'tu pareja'} ~<b>{money(-mine.diff)}</b>. Tu libre ya descuenta tu parte completa.</p>
                  : <p className="hint">Van a mano por ahora.</p>}
            <p className="hint">Se actualiza solo conforme se registran los gastos de la casa de los dos.</p>
          </div>
        )}
        {projected !== null && <p className="hint">Al ritmo de hoy terminarias el mes con {projected >= 0 ? <b>{money(projected)}</b> : <b className="neg">−{money(-projected)}</b>}.</p>}
        {!preview && cfgNow?.mode === 'saving' && <p className="hint">Ahorro fijo del mes: {money(cfgNow.amount)} (ya descontado de lo que recibiste el mes anterior).</p>}
        <p className="hint">El arrastre se calcula solo al cerrar cada mes: lo que sobra o falta pasa al siguiente.</p>
      </Card>

      {closed.length > 0 && (
        <Card title="Cierres de mes">
          <p className="hint">Decide que hacer con lo que sobro o falto: cuanto pasa al mes siguiente y el resto se queda en tu ahorro (tu dinero total, el que repartes en metas).</p>
          {closed.slice(-6).reverse().map(c => {
            const keep = c.libre - c.next;
            return (
              <div key={c.month} className="debt">
                <div className="row"><span>{monthLabel(c.month)}</span><b className={c.libre >= 0 ? 'pos' : 'neg'}>{c.libre >= 0 ? `sobro ${money(c.libre)}` : `falto ${money(-c.libre)}`}</b></div>
                <small>
                  {c.libre >= 0
                    ? `Al mes siguiente: ${money(c.next)} (${c.pct}%) · A ahorro: ${money(keep)}`
                    : `Recuperas el mes siguiente: ${money(-c.next)} (${c.pct}%) · Se quita del ahorro: ${money(-keep)}`}
                </small>
                <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                  <button className="link" onClick={() => setPct(c.month, 100)}>{c.libre >= 0 ? 'Todo al mes' : 'Recuperar todo'}</button>
                  <button className="link" onClick={() => setPct(c.month, 50)}>Mitad</button>
                  <button className="link" onClick={() => setPct(c.month, 0)}>{c.libre >= 0 ? 'Todo a ahorro' : 'Quitarlo del ahorro'}</button>
                  <button className="link" onClick={() => askPct(c.month, c.pct)}>Otro %</button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

/** Marcador de como va tu pareja (solo si lo comparte): sin numeros, solo el color. */
export function PartnerMarker({ d }: { d: Data }) {
  const other = d.statuses.find(s => s.data.person !== d.myKey);
  if (!other) return null;
  const name = d.people.find(p => p.key === other.data.person)?.name ?? 'Tu pareja';
  const lv = other.data.level;
  return (
    <Card title={`Como va ${name} este mes`}>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <span style={{ width: 18, height: 18, borderRadius: 99, background: COLOR[lv], display: 'inline-block' }} />
        <b>{lv === 'green' ? 'Verde' : lv === 'amber' ? 'Ambar' : 'Rojo'}</b>
        <span>{levelText(lv)}</span>
      </div>
    </Card>
  );
}
