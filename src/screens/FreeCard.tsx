import { budgetCtx } from '../budget';
import { addMonthsYm, budgetFor, budgetLevel, levelText, money, monthLabel, ym } from '../calc';
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
  const perDay = !preview && b.libre > 0 ? b.libre / (dim - day + 1) : 0;
  const projected = !preview && day > 0 ? g0 - (b.spent / day) * dim : null;
  const cfgNow = (st.plan ?? []).filter(c => c.from <= month).slice(-1)[0];

  // meses cerrados desde el inicio
  const closed: { m: string; libre: number }[] = [];
  if (!preview) for (let m = start; m < cur; m = addMonthsYm(m, 1)) { const x = budgetFor(ctx, m); if (x) closed.push({ m, libre: x.libre }); }

  return (
    <>
      <Card className="total" title={preview ? `Asi empieza ${monthLabel(start)}` : 'Libre para gastar'}>
        <small>{preview ? 'EL ARRASTRE EMPIEZA EN ESTE MES' : monthLabel(month).toUpperCase()}</small>
        <div className="big" style={{ color: !preview && b.libre <= 0 ? 'var(--bad)' : undefined }}>{money(b.libre)}</div>
        {!preview && <Bar pct={g0 > 0 ? (b.spent / g0) * 100 : 100} tone={level === 'red' ? 'bad' : level === 'amber' ? 'warn' : 'good'} />}
        <div className="row"><small>{cfgNow?.mode === 'saving' ? 'Nomina esperada − ahorro fijo' : 'Presupuesto'}</small><span>{money(b.base)}</span></div>
        <div className="row"><small>Arrastre del mes anterior</small><span className={b.carry < 0 ? 'neg' : b.carry > 0 ? 'pos' : ''}>{b.carry >= 0 ? '+' : '−'}{money(Math.abs(b.carry))}</span></div>
        <div className="row"><small>Comprometido (mensualidades, deudas, tu parte de la casa)</small><span>−{money(b.commit)}</span></div>
        <div className="row"><small>Gastado en el mes</small><span>−{money(b.spent)}</span></div>
        {!preview && perDay > 0 && <p className="hint">Puedes gastar ~<b>{money(perDay)}</b> al dia el resto del mes.</p>}
        {projected !== null && <p className="hint">Al ritmo de hoy terminarias el mes con {projected >= 0 ? <b>{money(projected)}</b> : <b className="neg">−{money(-projected)}</b>}.</p>}
        {!preview && cfgNow?.mode === 'saving' && <p className="hint">Ahorro fijo del mes: {money(cfgNow.amount)} (ya apartado de la nomina esperada).</p>}
        <p className="hint">El arrastre se calcula solo al cerrar cada mes: lo que sobra o falta pasa al siguiente.</p>
      </Card>

      {closed.length > 0 && (
        <Card title="Cierres de mes">
          {closed.slice(-6).reverse().map(c => (
            <div key={c.m} className="row" style={{ marginBottom: 6 }}>
              <span>{monthLabel(c.m)}</span>
              <b className={c.libre >= 0 ? 'pos' : 'neg'}>{c.libre >= 0 ? `sobro ${money(c.libre)}` : `falto ${money(-c.libre)}`}</b>
            </div>
          ))}
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
