import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[#0A1020] px-5 py-6 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/80">
          StellarFlow
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Dashboard</h2>
      </div>

      <nav className="flex flex-col gap-2 text-sm text-slate-300">
        <Link className="rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white" href="/">Home</Link>
        <Link className="rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white" href="/contracts">Contracts</Link>
        <Link className="rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white" href="/relayers">Relayers</Link>
        <Link className="rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white" href="/logs">Logs</Link>
        <Link className="rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white" href="/settings">Settings</Link>
      </nav>
    </aside>
  )
}
