import { addMonthsYm, houseSummary, ledgerStatus, money, monthLabel, planStatus, ym } from '../calc';
import { Card, Data } from '../ui';

/** Lo que ya tienes comprometido cada mes: mis mensualidades, lo que debo a personas y mi parte de las mensualidades de la casa. */
export default function Commitments({ d }: { d: Data }) {
  const nowM = ym(new Date());

  const pctFor = (m: string) => houseSummary(m, d.people, d.payrolls, [], [], []).rows.find(r => r.key === d.myKey)?.pct ?? 0;

  const calc = (m: string) => {
    const own = d.allPlans.filter(p => p.owner === d.me).reduce((a, p) => { const s = planStatus(p.data, m); return a + (s.due ? s.monthly : 0); }, 0);
    const owe = d.ledger.filter(l => l.data.dir === 'owe').reduce((a, l) => { const s = ledgerStatus(l.data, m); return a + (s.due ? s.monthly : 0); }, 0);
    const casaTotal = d.allPlans.filter(p => p.owner === null).reduce((a, p) => { const s = planStatus(p.data, m); return a + (s.due ? s.monthly : 0); }, 0);
    const casa = casaTotal * pctFor(m);
    const advanced = d.ledger.filter(l => l.data.dir === 'owed').reduce((a, l) => { const s = ledgerStatus(l.data, m); return a + (s.due ? s.monthly : 0); }, 0);
    return { own, owe, casa, advanced, total: own + owe + casa };
  };

  const months = Array.from({ length: 12 }, (_, k) => addMonthsYm(nowM, k));
  let last: string | null = null;
  for (let k = 0; k < 60; k++) { const m = addMonthsYm(nowM, k); if (calc(m).total > 0.005) last = m; }

  return (
    <>
      <Card title="Cuando quedas libre de mensualidades">
        {last === null
          ? <p>No tienes mensualidades comprometidas.</p>
          : last === addMonthsYm(nowM, 59)
            ? <p>Todavia tienes mensualidades por mas de 5 años.</p>
            : <p>Terminas de pagar todo en <b>{monthLabel(last)}</b>; quedas libre desde <b>{monthLabel(addMonthsYm(last, 1))}</b>.</p>}
      </Card>

      <Card title="Comprometido por mes">
        {months.map(m => {
          const c = calc(m);
          return (
            <div key={m} className="tx">
              <div>
                <b style={m === nowM ? { color: 'var(--brand)' } : undefined}>{monthLabel(m)}</b>
                <small>
                  {[c.own > 0 && `mis compras ${money(c.own)}`, c.owe > 0 && `deudas a personas ${money(c.owe)}`, c.casa > 0 && `mi parte de la casa ${money(c.casa)}`].filter(Boolean).join(' · ') || 'sin compromisos'}
                  {c.advanced > 0 ? ` · adelantas por otros ${money(c.advanced)} (no cuenta)` : ''}
                </small>
              </div>
              <b>{money(c.total)}</b>
            </div>
          );
        })}
      </Card>
    </>
  );
}
