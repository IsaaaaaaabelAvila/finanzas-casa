import { Tab } from '../App';
import { goalPlan, minSpend, money, planStatus, spendCap, ym, today } from '../calc';
import { Bar, Card, Data, Empty, Scope } from '../ui';

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const STATUS_TEXT = {
  ok: 'Minimo cumplido',
  ontrack: 'Vas en camino',
  behind: 'Vas atrasado',
  urgent: 'Poco tiempo'
};

export default function Dashboard({ d, go, scope }: { d: Data; go: (t: Tab) => void; scope: Scope }) {
  const house = scope === 'shared'; // en la vista Casa no hay presupuesto, gasto minimo ni metas
  const now = new Date();
  const month = today().slice(0, 7);
  const monthTx = d.txns.filter(t => t.data.date.startsWith(month));
  const income = monthTx.filter(t => t.data.type === 'income').reduce((a, t) => a + t.data.amount, 0);
  const planBuys = d.plans.filter(p => p.owner === d.me && !p.data.txnId && p.data.startDate.startsWith(month));
  const expense = monthTx.filter(t => t.data.type === 'expense').reduce((a, t) => a + t.data.amount, 0) + planBuys.reduce((a, p) => a + p.data.total, 0);
  const commitments = d.plans.map(p => planStatus(p.data, ym(now))).filter(s => s.due && !s.finished).reduce((a, s) => a + s.monthly, 0);

  const byCat: Record<string, number> = {};
  monthTx.filter(t => t.data.type === 'expense').forEach(t => { byCat[t.data.category] = (byCat[t.data.category] || 0) + t.data.amount; });
  planBuys.forEach(p => { const c = p.data.category ?? 'Compras'; byCat[c] = (byCat[c] || 0) + p.data.total; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const wd = now.getDay(); // 5 vie, 6 sab, 0 dom, 1 lun
  const reminderDay = [5, 6, 0, 1].includes(wd);
  const loggedToday = d.allTxns.some(t => t.owner === d.me && t.data.date === today());

  const budget = d.setting?.data.monthlyBudget ?? 0;
  const spentAll = d.allTxns.filter(t => t.data.type === 'expense' && t.data.date.startsWith(month)).reduce((a, t) => a + t.data.amount, 0) + d.allPlans.filter(p => p.owner === d.me && !p.data.txnId && p.data.startDate.startsWith(month)).reduce((a, p) => a + p.data.total, 0);
  const caps = d.accounts.map(a => ({ a, c: spendCap(a, d.allTxns, d.allPlans, now) })).filter(x => x.c);
  const cards = d.accounts.map(a => ({ a, ms: minSpend(a, d.allTxns, d.allPlans, now) })).filter(x => x.ms);

  return (
    <>
      {reminderDay && !loggedToday && (
        <div className="banner" onClick={() => go('mov')}>
          Hoy es {DAYS[wd]}: no has registrado nada hoy. Toca para anotar tus ingresos y egresos.
        </div>
      )}

      <div className="stats">
        <div className="stat"><small>Ingresos del mes</small><b className="pos">{money(income)}</b></div>
        <div className="stat"><small>Egresos del mes</small><b className="neg">{money(expense)}</b></div>
        <div className="stat"><small>Balance</small><b className={income - expense >= 0 ? 'pos' : 'neg'}>{money(income - expense)}</b></div>
        <div className="stat"><small>Pagos a meses / mes</small><b>{money(commitments)}</b></div>
      </div>

      {!house && budget > 0 && (
        <Card title="Presupuesto del mes">
          <div className="row"><span>{money(spentAll)} de {money(budget)}</span><b className={budget - spentAll >= 0 ? 'pos' : 'neg'}>{budget - spentAll >= 0 ? `Quedan ${money(budget - spentAll)}` : `Excedido ${money(spentAll - budget)}`}</b></div>
          <Bar pct={(spentAll / budget) * 100} tone={spentAll > budget ? 'bad' : spentAll > budget * 0.8 ? 'warn' : 'good'} />
        </Card>
      )}

      {!house && caps.length > 0 && (
        <Card title="Tope de gasto de tarjetas">
          {caps.map(({ a, c }) => c && (
            <div key={a.id} className="row-block">
              <div className="row"><b>{a.data.name}</b><span>{money(c.spent)} / {money(c.max)}</span></div>
              <Bar pct={c.pct} tone={c.pct >= 100 ? 'bad' : c.pct >= 80 ? 'warn' : 'good'} />
              <small>Corte {c.end} ({c.daysLeft} dias) · {c.left >= 0 ? `disponible ${money(c.left)}` : `te pasaste por ${money(-c.left)}`}</small>
            </div>
          ))}
        </Card>
      )}

      {!house && <Card title="Gasto minimo de tarjetas">
        {cards.length === 0 ? <Empty>Agrega una tarjeta de credito con dia de corte y gasto minimo en Cuentas.</Empty> : cards.map(({ a, ms }) => ms && (
          <div key={a.id} className="row-block">
            <div className="row"><b>{a.data.name}</b><span className={`chip ${ms.status}`}>{STATUS_TEXT[ms.status]}</span></div>
            <Bar pct={(ms.spent / ms.min) * 100} tone={ms.status === 'urgent' || ms.status === 'behind' ? 'bad' : ms.status === 'ontrack' ? 'warn' : 'good'} />
            <small>
              {money(ms.spent)} de {money(ms.min)} · corte {ms.end} ({ms.daysLeft} dias)
              {ms.remaining > 0 && <> · faltan <b>{money(ms.remaining)}</b> (~{money(ms.perDay)}/dia)</>}
            </small>
          </div>
        ))}
      </Card>}

      {!house && <Card title="Metas" right={<button className="link" onClick={() => go('goals')}>Ver</button>}>
        {d.goals.length === 0 ? <Empty>Aun no tienes metas.</Empty> : d.goals.slice(0, 3).map(g => {
          const p = goalPlan(g.data.target, g.data.linkTotal ? d.total : g.data.saved, g.data.deadline, now);
          return (
            <div key={g.id} className="row-block">
              <div className="row"><b>{g.data.name}</b><span>{p.pct.toFixed(0)}%</span></div>
              <Bar pct={p.pct} />
              <small>Faltan {money(p.left)}{p.perMonth !== null && <> · ahorra {money(p.perMonth)}/mes</>}</small>
            </div>
          );
        })}
      </Card>}

      <Card title="Egresos por categoria (mes)">
        {cats.length === 0 ? <Empty>Sin egresos este mes.</Empty> : cats.map(([c, v]) => (
          <div key={c} className="row-block">
            <div className="row"><span>{c}</span><span>{money(v)}</span></div>
            <Bar pct={(v / (cats[0][1] || 1)) * 100} tone="warn" />
          </div>
        ))}
      </Card>
    </>
  );
}
