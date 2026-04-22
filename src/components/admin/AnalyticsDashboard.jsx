import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, LineChart, Line,
  PieChart, Pie, CartesianGrid,
} from "recharts";
import { TYPE_META } from "@/lib/occurrenceMeta";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TYPE_COLORS = {
  crime: "#ef4444",
  panic: "#f97316",
  health: "#22c55e",
  civil_defense: "#8b5cf6",
  traffic: "#eab308",
};

// ── Heat-map: occurrences per hour-of-day per type ──────────────────────────
function HourlyHeatmap({ occurrences }) {
  const data = useMemo(() => {
    return HOURS.map((h) => {
      const row = { hour: `${String(h).padStart(2, "0")}h` };
      Object.keys(TYPE_META).forEach((t) => {
        row[t] = occurrences.filter((o) => {
          return o.type === t && new Date(o.created_date).getHours() === h;
        }).length;
      });
      return row;
    });
  }, [occurrences]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="font-semibold text-sm mb-4">🔥 Volume por Hora do Dia</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {Object.entries(TYPE_META).map(([t, m]) => (
            <Bar key={t} dataKey={t} name={m.label} fill={TYPE_COLORS[t]} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Avg response time per type ───────────────────────────────────────────────
function AvgResponseChart({ occurrences }) {
  const data = useMemo(() => {
    return Object.entries(TYPE_META).map(([t, m]) => {
      const resolved = occurrences.filter(
        (o) => o.type === t && o.status === "resolved" && o.created_date && o.updated_date
      );
      const avgMin =
        resolved.length === 0
          ? 0
          : Math.round(
              resolved.reduce((sum, o) => {
                const diff = (new Date(o.updated_date) - new Date(o.created_date)) / 60000;
                return sum + diff;
              }, 0) / resolved.length
            );
      return { label: m.label, avg: avgMin, count: resolved.length };
    });
  }, [occurrences]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="font-semibold text-sm mb-4">⏱ Tempo Médio de Resposta (min) por Tipo</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis dataKey="label" type="category" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            formatter={(v, n, p) => [`${v} min (${p.payload.count} resolvidas)`, "Tempo médio"]}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
          />
          <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={Object.values(TYPE_COLORS)[i % 5]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── False vs confirmed reports ───────────────────────────────────────────────
function TrustPieChart({ occurrences }) {
  const data = useMemo(() => {
    const confirmed = occurrences.filter((o) => o.status === "resolved").length;
    const canceled = occurrences.filter((o) => o.status === "canceled").length;
    const open = occurrences.filter((o) => o.status === "open" || o.status === "in_progress").length;
    return [
      { name: "Confirmadas", value: confirmed, fill: "#22c55e" },
      { name: "Falsas / Canceladas", value: canceled, fill: "#ef4444" },
      { name: "Em aberto", value: open, fill: "#eab308" },
    ];
  }, [occurrences]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="font-semibold text-sm mb-4">✅ Denúncias Confirmadas vs Falsas</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <Tooltip
            formatter={(v) => [`${v} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`, ""]}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function AnalyticsDashboard({ occurrences }) {
  if (!occurrences?.length) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-2xl">
        Dados insuficientes para exibir gráficos analíticos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HourlyHeatmap occurrences={occurrences} />
      <div className="grid md:grid-cols-2 gap-4">
        <AvgResponseChart occurrences={occurrences} />
        <TrustPieChart occurrences={occurrences} />
      </div>
    </div>
  );
}