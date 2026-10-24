import { budgetCtx } from '../budget';
import { addMonthsYm, budgetFor, budgetLevel, houseSummary, levelText, money, monthLabel, ym } from '../calc';
import { save } from '../store';
import { useState } from 'react';
import { Bar, Card, Data, num } from '../ui';

const COLOR = { green: 'var(--good)', amber: 'var(--warn)', red: 'var(--bad)' } as const;

/** Tarjeta "Libre para gastar": presupuesto + arrastre - comprometido - gastado. */
export default function FreeCard({ d }: { d: Data }) {
  const ctx = budgetCtx(d);
  const [inp, setInp] = useState<Record<string, string>>({});
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
  const setNext = (m: string, amount: number) => { save('setting', { ...(d.setting?.data ?? {}), carryDecisions: { ...(d.setting?.data.carryDecisions ?? {}), [m]: amount } }, d.me, d.setting?.id); setInp(p => { const n = { ...p }; delete n[m]; return n; }); };

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
          </div>
        )}
      </Card>

      {closed.length > 0 && (
        <Card title="Cierres de mes">
          <p className="hint">Escribe cuanto pasa al mes siguiente. Lo demas se queda en tu ahorro: tu dinero total, el que repartes en metas.</p>
          {closed.slice(-6).reverse().map(c => {
            const over = c.libre >= 0;
            const val = inp[c.month] ?? String(Math.round(Math.abs(c.next) * 100) / 100);
            const keep = c.libre - c.next;
            return (
              <div key={c.month} className="debt">
                <div className="row"><span>{monthLabel(c.month)}</span><b className={over ? 'pos' : 'neg'}>{over ? `sobro ${money(c.libre)}` : `falto ${money(-c.libre)}`}</b></div>
                <label className="field" style={{ margin: '8px 0 4px' }}><span>{over ? 'Pasa al mes siguiente para gastar' : 'Lo recuperas el mes siguiente'}</span>
                  <input inputMode="decimal" value={val} onChange={e => setInp(p => ({ ...p, [c.month]: e.target.value }))} />
                </label>
                <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                  <button disabled={inp[c.month] === undefined} onClick={() => setNext(c.month, over ? Math.abs(num(val)) : -Math.abs(num(val)))}>Aplicar</button>
                  <button className="link" onClick={() => setNext(c.month, c.libre)}>{over ? 'Todo al mes' : 'Recuperar todo'}</button>
                  <button className="link" onClick={() => setNext(c.month, 0)}>{over ? 'Todo a ahorro' : 'Quitarlo del ahorro'}</button>
                </div>
                <small>{over ? `A ahorro (queda en tu dinero total): ${money(keep)}` : `Se quita del ahorro: ${money(-keep)} (tu dinero total ya lo refleja)`}</small>
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
