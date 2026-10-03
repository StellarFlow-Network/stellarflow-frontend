import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const meta = { title: "Design System/Primitives", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = { render: () => <div className="flex flex-wrap gap-3"><button className="rounded-lg bg-lime-400 px-4 py-2 font-semibold text-slate-950">Primary</button><button className="rounded-lg border border-slate-400 px-4 py-2">Secondary</button><button className="rounded-lg bg-red-500 px-4 py-2 text-white">Danger</button></div> };
export const Inputs: Story = { render: () => <div className="max-w-sm space-y-2"><label className="block text-sm font-medium">Asset amount</label><input className="w-full rounded-lg border border-slate-400 bg-transparent px-3 py-2" placeholder="0.00" /><select className="w-full rounded-lg border border-slate-400 bg-transparent px-3 py-2" defaultValue="xlm"><option value="xlm">XLM</option><option value="usdc">USDC</option></select></div> };
export const Modals: Story = { render: () => { const [open, setOpen] = useState(true); return <div><button className="rounded-lg bg-lime-400 px-4 py-2" onClick={() => setOpen(true)}>Open modal</button>{open && <div role="dialog" aria-modal="true" className="mt-4 max-w-sm rounded-xl border border-slate-400 bg-slate-900 p-5 text-white"><h2 className="font-bold">Confirm transaction</h2><p className="my-3 text-sm text-slate-300">Review the details before continuing.</p><button className="rounded-lg border px-3 py-1" onClick={() => setOpen(false)}>Close</button></div>}</div>; } };
export const Cards: Story = { render: () => <div className="max-w-sm rounded-xl border border-slate-400 p-5"><p className="text-sm opacity-70">Portfolio value</p><strong className="text-2xl">$12,480.00</strong><p className="mt-2 text-sm text-lime-500">+4.2% today</p></div> };
