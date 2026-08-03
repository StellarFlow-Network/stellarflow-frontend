"use client";

import React, { useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";

export interface ProposalParameter {
  id: string;
  name: string;
  value: string;
}

export interface ProposalSubmission {
  title: string;
  description: string;
  rationale: string;
  parameters: ProposalParameter[];
}

export interface ProposalCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proposal: ProposalSubmission) => void;
  walletBalance?: number;
  minimumThreshold?: number;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  rationale: "",
  parameters: [] as ProposalParameter[],
};

function createParameter(): ProposalParameter {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    value: "",
  };
}

export default function ProposalCreationModal({
  isOpen,
  onClose,
  onSubmit,
  walletBalance = 0,
  minimumThreshold = 250000,
}: ProposalCreationModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }, [isOpen]);

  const thresholdStatus = useMemo(() => {
    if (walletBalance >= minimumThreshold) {
      return {
        label: "Eligible to submit",
        tone: "text-emerald-400",
      };
    }

    return {
      label: `Minimum proposal threshold: ${minimumThreshold.toLocaleString()} SF`,
      tone: "text-amber-400",
    };
  }, [minimumThreshold, walletBalance]);

  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const updateParameter = (id: string, field: "name" | "value", value: string) => {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.map((parameter) =>
        parameter.id === id ? { ...parameter, [field]: value } : parameter,
      ),
    }));
    setErrors((current) => ({ ...current, parameters: "" }));
  };

  const addParameter = () => {
    setForm((current) => ({
      ...current,
      parameters: [...current.parameters, createParameter()],
    }));
  };

  const removeParameter = (id: string) => {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.filter((parameter) => parameter.id !== id),
    }));
  };

  const validateAndSubmit = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.title.trim()) {
      nextErrors.title = "Proposal title is required";
    }

    if (!form.description.trim()) {
      nextErrors.description = "Proposal description is required";
    }

    if (!form.rationale.trim()) {
      nextErrors.rationale = "Proposal rationale is required";
    }

    if (walletBalance < minimumThreshold) {
      nextErrors.threshold = `You must hold at least ${minimumThreshold.toLocaleString()} SF to submit a proposal`;
    }

    const hasIncompleteParameters = form.parameters.some(
      (parameter) => !parameter.name.trim() || !parameter.value.trim(),
    );

    if (form.parameters.length > 0 && hasIncompleteParameters) {
      nextErrors.parameters = "Each parameter needs both a name and a value";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      rationale: form.rationale.trim(),
      parameters: form.parameters.map((parameter) => ({
        id: parameter.id,
        name: parameter.name.trim(),
        value: parameter.value.trim(),
      })),
    });
    onClose();
  };

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title="Create Governance Proposal" size="xl">
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-300">Eligibility</p>
              <p className={`text-sm font-semibold ${thresholdStatus.tone}`}>
                {walletBalance.toLocaleString()} SF available • {thresholdStatus.label}
              </p>
            </div>
          </div>
          {errors.threshold ? (
            <p className="mt-3 text-sm text-amber-400">{errors.threshold}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div>
            <label htmlFor="proposal-title" className="mb-2 block text-sm font-medium text-gray-300">
              Proposal title
            </label>
            <input
              id="proposal-title"
              type="text"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none ring-0"
              placeholder="Example: Upgrade oracle aggregator"
            />
            {errors.title ? <p className="mt-1 text-sm text-rose-400">{errors.title}</p> : null}
          </div>

          <div>
            <label htmlFor="proposal-description" className="mb-2 block text-sm font-medium text-gray-300">
              Proposal description
            </label>
            <textarea
              id="proposal-description"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={6}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none ring-0"
              placeholder="Describe the proposal and expected impact. Markdown is supported."
            />
            <p className="mt-1 text-xs text-gray-500">
              Supports Markdown headings, emphasis, and lists.
            </p>
            {errors.description ? <p className="mt-1 text-sm text-rose-400">{errors.description}</p> : null}
          </div>

          <div>
            <label htmlFor="proposal-rationale" className="mb-2 block text-sm font-medium text-gray-300">
              Proposal rationale
            </label>
            <textarea
              id="proposal-rationale"
              value={form.rationale}
              onChange={(event) => updateField("rationale", event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none ring-0"
              placeholder="Explain why this proposal should be approved."
            />
            <p className="mt-1 text-xs text-gray-500">
              Include the motivation, expected benefits, and governance context.
            </p>
            {errors.rationale ? <p className="mt-1 text-sm text-rose-400">{errors.rationale}</p> : null}
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">Upgrade parameters</h3>
                <p className="text-xs text-gray-500">
                  Add contract upgrade inputs that will be executed as part of the proposal.
                </p>
              </div>
              <button
                type="button"
                onClick={addParameter}
                className="rounded-lg border border-blue-500/40 bg-blue-600/10 px-3 py-2 text-sm font-medium text-blue-300"
              >
                Add parameter
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {form.parameters.map((parameter) => (
                <div key={parameter.id} className="grid gap-3 rounded-lg border border-gray-800 bg-[#161b22] p-3 md:grid-cols-[1fr,1fr,auto]">
                  <div>
                    <label htmlFor={`parameter-name-${parameter.id}`} className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                      Parameter name
                    </label>
                    <input
                      id={`parameter-name-${parameter.id}`}
                      type="text"
                      value={parameter.name}
                      onChange={(event) => updateParameter(parameter.id, "name", event.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none"
                      placeholder="feeCap"
                    />
                  </div>
                  <div>
                    <label htmlFor={`parameter-value-${parameter.id}`} className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                      Parameter value
                    </label>
                    <input
                      id={`parameter-value-${parameter.id}`}
                      type="text"
                      value={parameter.value}
                      onChange={(event) => updateParameter(parameter.id, "value", event.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none"
                      placeholder="250000"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeParameter(parameter.id)}
                    className="self-end rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {errors.parameters ? <p className="mt-3 text-sm text-rose-400">{errors.parameters}</p> : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={validateAndSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Submit Proposal
          </button>
        </div>
      </div>
    </OptimizedDialog>
  );
}
