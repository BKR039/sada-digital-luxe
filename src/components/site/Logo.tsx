import logo from "@/assets/sada-mark.png";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logo} alt="SADA" className="h-8 w-auto" />
      <span className="font-display text-xl font-bold tracking-widest">SADA</span>
    </div>
  );
}
