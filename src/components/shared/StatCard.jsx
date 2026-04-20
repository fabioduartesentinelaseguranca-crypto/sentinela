export default function StatCard({ label, value, icon: Icon, accent = "primary", hint }) {
  const accents = {
    primary: "from-primary/20 to-primary/5 text-primary",
    emergency: "from-emergency/25 to-emergency/5 text-emergency",
    success: "from-success/20 to-success/5 text-success",
    warning: "from-warning/25 to-warning/5 text-warning",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover:border-border transition-colors">
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${accents[accent]} opacity-40 blur-2xl`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
          {Icon && <Icon className={`w-4 h-4 ${accents[accent].split(" ").pop()}`} />}
        </div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
    </div>
  );
}