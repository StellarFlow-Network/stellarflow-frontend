export default function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#020817]/90 px-6 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/80">
          Operations
        </p>
        <h1 className="text-lg font-semibold text-white">StellarFlow Console</h1>
      </div>
      <div className="text-sm text-slate-300">User Menu</div>
    </header>
  )
}
