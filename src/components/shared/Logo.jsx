export default function Logo({ size = "md", showText = true }) {
  const sizes = {
    sm: { img: "w-7 h-7", text: "text-sm", wrap: "gap-2" },
    md: { img: "w-9 h-9", text: "text-lg", wrap: "gap-2.5" },
    lg: { img: "w-10 h-10", text: "text-lg", wrap: "gap-3" },
  };
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.wrap}`}>
      <img
        src="https://media.base44.com/images/public/69e62ccdaa7616a3be110b50/e55154b87_image.png"
        alt="Sentinela logo"
        className={`${s.img} object-contain rounded-lg`}
      />
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