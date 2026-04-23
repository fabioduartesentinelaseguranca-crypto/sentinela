import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { TYPE_META } from "@/lib/occurrenceMeta";
import { differenceInMinutes } from "date-fns";
import { Clock, Zap, Car, TrendingUp } from "lucide-react";
import PredictivePatrol from "@/components/admin/PredictivePatrol";

const COLORS = ["#38bdf8", "#ef4444", "#f59e0b", "#22c55e", "#a855f7"];

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default function ManagerDashboard({ occurrences = [], vehicles = [] }) {
  /* ─── Response time by type ─── */
  const responseByType = useMemo(() => {
    return Object.keys(TYPE_META).map((type) => {
      const occs = occurrences.filter(
        (o) => o.type === type && o.status === "resolved" && o.updated_date && o.created_date
      );
      const times = occs.map((o) =>
        differenceInMinutes(new Date(o.updated_date), new Date(o.created_date))
      ).filter((t) => t > 0 && t < 600);
      return { name: TYPE_META[type].label, avg: avg(times), count: occs.length };
    });
  }, [occurrences]);

  /* ─── Occurrences per hour (heatmap proxy as bar chart) ─── */
  const byHour = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}h`, count: 0 }));
    occurrences.forEach((o) => {
      const h = new Date(o.created_date).getHours();
      counts[h].count++;
    });
    return counts;
  }, [occurrences]);

  /* ─── Occurrences by type (pie) ─── */
  const byType = useMemo(() => {
    return Object.keys(TYPE_META)
      .map((type) => ({
        name: TYPE_META[type].label,
        value: occurrences.filter((o) => o.type === type).length,
      }))
      .filter((d) => d.value > 0);
  }, [occurrences]);

  /* ─── Fleet availability ─── */
  const fleetStats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === "available").length;
    const onPatrol = vehicles.filter((v) => v.status === "on_patrol").length;
    const maintenance = vehicles.filter((v) => v.status === "maintenance").length;
    return [
      { name: "Disponível", value: available, color: "#22c55e" },
      { name: "Em patrulha", value: onPatrol, color: "#38bdf8" },
      { name: "Manutenção", value: maintenance, color: "#f59e0b" },
    ].filter((d) => d.value > 0);
  }, [vehicles]);

  /* ─── KPI cards ─── */
  const totalOpen = occurrences.filter((o) => o.status === "open").length;
  const resolvedToday = occurrences.filter((o) => {
    if (o.status !== "resolved") return false;
    const d = new Date(o.updated_date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const allTimes = occurrences
    .filter((o) => o.status === "resolved" && o.updated_date && o.created_date)
    .map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date)))
    .filter((t) => t > 0 && t < 600);
  const avgResponse = avg(allTimes);
  const fleetAvail = vehicles.length
    ? Math.round((vehicles.filter((v) => v.status === "available" || v.status === "on_patrol").length / vehicles.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ocorrências abertas", value: totalOpen, icon: Zap, color: "text-warning" },
          { label: "Resolvidas hoje", value: resolvedToday, icon: TrendingUp, color: "text-success" },
          { label: "Tempo médio resposta", value: `${avgResponse} min`, icon: Clock, color: "text-primary" },
          { label: "Frota operacional", value: `${fleetAvail}%`, icon: Car, color: "text-primary" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="p-4 rounded-2xl border border-border/60 bg-card space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">{k.label}</div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <Icon className={`w-4 h-4 ${k.color}`} />
            </div>
          );
        })}
      </div>

      {/* Heatmap por hora */}
      <div className="p-5 rounded-2xl border border-border/60 bg-card">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Volume de Ocorrências por Hora
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byHour} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ocorrências" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Tempo médio por tipo */}
        <div className="p-5 rounded-2xl border border-border/60 bg-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Tempo Médio de Resposta por Tipo (min)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={responseByType} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={80} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v} min`, "Tempo médio"]}
              />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {responseByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Frota */}
        <div className="p-5 rounded-2xl border border-border/60 bg-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" /> Disponibilidade da Frota
          </h3>
          {fleetStats.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
              Nenhuma viatura cadastrada.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={fleetStats} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {fleetStats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Predictive patrol */}
      <div className="p-5 rounded-2xl border border-border/60 bg-card">
        <PredictivePatrol occurrences={occurrences} />
      </div>

      {/* Occurrences by type */}
      <div className="p-5 rounded-2xl border border-border/60 bg-card">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Ocorrências por Tipo
        </h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={byType} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="value" name="Total" radius={[4, 4, 0, 0]}>
              {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}