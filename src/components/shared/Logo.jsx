import { Shield } from "lucide-react";

export default function Logo({ size = "md", showText = true }) {
  const sizes = {
    sm: { icon: "w-5 h-5", text: "text-sm", wrap: "gap-2" },
    md: { icon: "w-7 h-7", text: "text-lg", wrap: "gap-2.5" },
    lg: { icon: "w-10 h-10", text: "text-2xl", wrap: "gap-3" },
  };
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.wrap}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
        <div className="relative bg-gradient-to-br from-primary to-primary/70 p-2 rounded-xl">
          <Shield className={`${s.icon} text-primary-foreground`} strokeWidth={2.5} />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${s.text} font-bold tracking-tight`}>Sentinela</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
            Segurança Cidadã
          </span>
        </div>
      )}
    </div>
  );
}