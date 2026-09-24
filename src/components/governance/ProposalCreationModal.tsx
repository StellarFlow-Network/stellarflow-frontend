"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";

export interface ProposalParameter { id: string; name: string; value: string; }
export interface ProposalAction { contractId: string; action: string; payload: string; }
export interface ProposalSubmission {
  title: string;
  description: string;
  rationale: string;
  parameters: ProposalParameter[];
  action: ProposalAction;
}
export interface ProposalCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proposal: ProposalSubmission) => void;
  walletBalance?: number;
  minimumThreshold?: number;
}

const STEPS = ["Proposal Details", "Select Target Contract", "Action Payload", "Preview"];
const CONTRACTS = [
  { id: "governance-core", name: "Governance Core", address: "C...GOV" },
  { id: "treasury-vault", name: "Treasury Vault", address: "C...VAULT" },
  { id: "oracle-aggregator", name: "Oracle Aggregator", address: "C...ORACLE" },
];
const EMPTY_FORM = {
  title: "", description: "", rationale: "", parameters: [] as ProposalParameter[],
  action: { contractId: "", action: "", payload: "{}" } as ProposalAction,
};
const inputClass = "w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none";

function newParameter(): ProposalParameter {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "", value: "" };
}

export default function ProposalCreationModal({ isOpen, onClose, onSubmit, walletBalance = 0, minimumThreshold = 250000 }: ProposalCreationModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const eligible = walletBalance >= minimumThreshold;

  useEffect(() => {
    if (!isOpen) { setForm(EMPTY_FORM); setErrors({}); setStep(0); }
  }, [isOpen]);

  const thresholdStatus = useMemo(() => eligible ? "Eligible to submit" : `Minimum proposal threshold: ${minimumThreshold.toLocaleString()} SF`, [eligible, minimumThreshold]);
  const updateField = (field: "title" | "description" | "rationale", value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };
  const updateAction = (field: keyof ProposalAction, value: string) => {
    setForm((current) => ({ ...current, action: { ...current.action, [field]: value } }));
    setErrors((current) => ({ ...current, action: "", payload: "" }));
  };
  const validateDetails = () => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "Proposal title is required";
    if (!form.description.trim()) next.description = "Proposal description is required";
    if (!form.rationale.trim()) next.rationale = "Proposal rationale is required";
    if (form.parameters.some((parameter) => !parameter.name.trim() || !parameter.value.trim())) next.parameters = "Each parameter needs both a name and a value";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const validateAction = () => {
    const next: Record<string, string> = {};
    if (!form.action.contractId) next.action = "Select a target contract";
    if (!form.action.action.trim()) next.action = "Action name is required";
    try { JSON.parse(form.action.payload); } catch { next.payload = "Payload must be valid JSON"; }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const nextStep = () => {
    if (step === 0 && validateDetails()) setStep(1);
    else if (step === 1 && form.action.contractId) setStep(2);
    else if (step === 1) setErrors({ action: "Select a target contract" });
    else if (step === 2 && validateAction()) setStep(3);
  };
  const submit = () => {
    if (!eligible) { setErrors((current) => ({ ...current, threshold: `You must hold at least ${minimumThreshold.toLocaleString()} SF to submit a proposal` })); return; }
    if (!validateDetails() || !validateAction()) return;
    onSubmit({
      title: form.title.trim(), description: form.description.trim(), rationale: form.rationale.trim(),
      parameters: form.parameters.map((parameter) => ({ ...parameter, name: parameter.name.trim(), value: parameter.value.trim() })),
      action: { ...form.action, action: form.action.action.trim(), payload: form.action.payload.trim() },
    });
    onClose();
  };
  const selectedContract = CONTRACTS.find((contract) => contract.id === form.action.contractId);

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title="Create Governance Proposal" size="xl">
      <div className="space-y-6">
        <nav aria-label="Proposal creation steps" className="grid grid-cols-4 gap-2">
          {STEPS.map((label, index) => <div key={label} className={`border-b-2 pb-2 text-xs font-medium ${index === step ? "border-blue-500 text-blue-300" : index < step ? "border-emerald-500 text-emerald-400" : "border-gray-800 text-gray-500"}`}><span className="mr-1">{index + 1}.</span>{label}</div>)}
        </nav>
        <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4">
          <p className="text-sm font-medium text-gray-300">Eligibility</p>
          <p className={`text-sm font-semibold ${eligible ? "text-emerald-400" : "text-amber-400"}`}>{walletBalance.toLocaleString()} SF available • {thresholdStatus}</p>
          {errors.threshold ? <p className="mt-3 text-sm text-amber-400">{errors.threshold}</p> : null}
        </div>
        {step === 0 ? <Details form={form} errors={errors} updateField={updateField} setForm={setForm} /> : null}
        {step === 1 ? <ContractPicker selected={form.action.contractId} error={errors.action} onSelect={(contractId) => updateAction("contractId", contractId)} /> : null}
        {step === 2 ? <ActionPayload action={form.action} errors={errors} updateAction={updateAction} /> : null}
        {step === 3 ? <Preview form={form} contractName={selectedContract?.name} /> : null}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300">Cancel</button>
          {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300">Back</button> : null}
          {step < 3 ? <button type="button" onClick={nextStep} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Continue</button> : <button type="button" onClick={submit} disabled={!eligible} aria-disabled={!eligible} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Submit Proposal</button>}
        </div>
      </div>
    </OptimizedDialog>
  );
}

function Details({ form, errors, updateField, setForm }: { form: typeof EMPTY_FORM; errors: Record<string, string>; updateField: (field: "title" | "description" | "rationale", value: string) => void; setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>> }) {
  const updateParameter = (id: string, field: "name" | "value", value: string) => setForm((current) => ({ ...current, parameters: current.parameters.map((parameter) => parameter.id === id ? { ...parameter, [field]: value } : parameter) }));
  return <div className="grid gap-4">
    <Field id="proposal-title" label="Proposal title" value={form.title} onChange={(value) => updateField("title", value)} error={errors.title} placeholder="Example: Upgrade oracle aggregator" />
    <div><label htmlFor="proposal-description" className="mb-2 block text-sm font-medium text-gray-300">Proposal description</label><MarkdownEditor value={form.description} onChange={(value) => updateField("description", value)} />{errors.description ? <p className="mt-1 text-sm text-rose-400">{errors.description}</p> : null}</div>
    <Field id="proposal-rationale" label="Proposal rationale" value={form.rationale} onChange={(value) => updateField("rationale", value)} error={errors.rationale} placeholder="Explain why this proposal should be approved." textarea />
    <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-gray-200">Upgrade parameters</h3><p className="text-xs text-gray-500">Optional contract inputs.</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, parameters: [...current.parameters, newParameter()] }))} className="rounded-lg border border-blue-500/40 px-3 py-2 text-sm text-blue-300">Add parameter</button></div><div className="mt-4 space-y-3">{form.parameters.map((parameter) => <div key={parameter.id} className="grid gap-3 md:grid-cols-2"><input aria-label="Parameter name" className={inputClass} value={parameter.name} onChange={(event) => updateParameter(parameter.id, "name", event.target.value)} placeholder="feeCap" /><input aria-label="Parameter value" className={inputClass} value={parameter.value} onChange={(event) => updateParameter(parameter.id, "value", event.target.value)} placeholder="250000" /></div>)}</div>{errors.parameters ? <p className="mt-3 text-sm text-rose-400">{errors.parameters}</p> : null}</div>
  </div>;
}

function Field({ id, label, value, onChange, error, placeholder, textarea = false }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; placeholder: string; textarea?: boolean }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-300">{label}</label>{textarea ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} className={inputClass} placeholder={placeholder} /> : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} placeholder={placeholder} />}{error ? <p className="mt-1 text-sm text-rose-400">{error}</p> : null}</div>;
}

function ContractPicker({ selected, error, onSelect }: { selected: string; error?: string; onSelect: (id: string) => void }) {
  return <div className="space-y-4"><div><h2 className="text-lg font-semibold text-gray-100">Select target contract</h2><p className="text-sm text-gray-500">Choose the contract that will receive this proposal action.</p></div>{CONTRACTS.map((contract) => <button type="button" key={contract.id} onClick={() => onSelect(contract.id)} className={`block w-full rounded-xl border p-4 text-left ${selected === contract.id ? "border-blue-500 bg-blue-500/10" : "border-gray-800 bg-[#0d1117]"}`}><span className="font-medium text-gray-100">{contract.name}</span><span className="float-right font-mono text-xs text-gray-500">{contract.address}</span></button>)}{error ? <p className="text-sm text-rose-400">{error}</p> : null}</div>;
}

function ActionPayload({ action, errors, updateAction }: { action: ProposalAction; errors: Record<string, string>; updateAction: (field: keyof ProposalAction, value: string) => void }) {
  return <div className="space-y-4"><div><h2 className="text-lg font-semibold text-gray-100">Action payload</h2><p className="text-sm text-gray-500">Define the contract method and its JSON arguments.</p></div><Field id="proposal-action" label="Action name" value={action.action} onChange={(value) => updateAction("action", value)} error={errors.action} placeholder="setFeeCap" /><div><label htmlFor="proposal-payload" className="mb-2 block text-sm font-medium text-gray-300">JSON payload</label><textarea id="proposal-payload" rows={8} className={`${inputClass} font-mono`} value={action.payload} onChange={(event) => updateAction("payload", event.target.value)} />{errors.payload ? <p className="mt-1 text-sm text-rose-400">{errors.payload}</p> : null}</div></div>;
}

function Preview({ form, contractName }: { form: typeof EMPTY_FORM; contractName?: string }) {
  return <div className="space-y-4"><h2 className="text-lg font-semibold text-gray-100">Preview proposal</h2><div className="space-y-3 rounded-xl border border-gray-800 bg-[#0d1117] p-4"><div><span className="text-xs uppercase text-gray-500">Title</span><p>{form.title}</p></div><div><span className="text-xs uppercase text-gray-500">Description</span><MarkdownPreview value={form.description} /></div><div><span className="text-xs uppercase text-gray-500">Target</span><p>{contractName}</p></div><div><span className="text-xs uppercase text-gray-500">Action</span><p className="font-mono text-sm">{form.action.action}</p><pre className="mt-2 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-gray-400">{form.action.payload}</pre></div></div></div>;
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const insert = (prefix: string, suffix = prefix) => { const editor = editorRef.current; if (!editor) return; const start = editor.selectionStart; const end = editor.selectionEnd; onChange(`${value.slice(0, start)}${prefix}${value.slice(start, end) || "text"}${suffix}${value.slice(end)}`); };
  return <div className="overflow-hidden rounded-lg border border-gray-700 bg-[#0d1117]"><div className="flex items-center gap-2 border-b border-gray-800 p-2"><button type="button" onClick={() => setMode("write")} className="px-2 py-1 text-xs text-blue-300">Write</button><button type="button" onClick={() => setMode("preview")} className="px-2 py-1 text-xs text-blue-300">Preview</button>{mode === "write" ? <><button type="button" aria-label="Bold" onClick={() => insert("**")} className="px-2 py-1 text-xs font-bold text-gray-400">B</button><button type="button" aria-label="Italic" onClick={() => insert("*")} className="px-2 py-1 text-xs italic text-gray-400">I</button><button type="button" aria-label="Heading" onClick={() => insert("## ", "")} className="px-2 py-1 text-xs text-gray-400">H</button></> : null}</div>{mode === "write" ? <textarea ref={editorRef} id="proposal-description" aria-label="Proposal description" value={value} onChange={(event) => onChange(event.target.value)} rows={7} className="w-full resize-y bg-transparent px-3 py-2 text-sm text-gray-100 outline-none" placeholder="Describe the proposal using Markdown." /> : <div className="min-h-[168px] p-3"><MarkdownPreview value={value} /></div>}</div>;
}

function MarkdownPreview({ value }: { value: string }) {
  return <div className="space-y-1 text-sm text-gray-300">{value.split("\n").map((line, index) => <p key={`${line}-${index}`} className={line.startsWith("#") ? "font-semibold text-gray-100" : ""}>{line.replace(/^#{1,2} /, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1") || " "}</p>)}</div>;
}
