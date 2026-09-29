'use client';

import React, { useState, useCallback, useRef, ChangeEvent } from 'react';
import { Upload, Plus, X, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

export interface BatchRecipient {
  id: string;
  address: string;
  amount: string;
  asset: string;
  memo?: string;
  error?: string;
}

export interface BatchPaymentFormProps {
  publicKey: string;
  xlmBalance: string;
  onBatchSuccess?: (recipients: BatchRecipient[]) => void;
  onCancel?: () => void;
}

const MAX_RECIPIENTS = 100; // Stellar transaction operation limit

function createRecipient(): BatchRecipient {
  return {
    id: Math.random().toString(36).substr(2, 9),
    address: '',
    amount: '',
    asset: 'XLM',
  };
}

function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

function parseCSV(csvText: string): Array<Partial<BatchRecipient>> {
  const lines = csvText.trim().split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  // Check if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('address') || firstLine.includes('amount');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const parts = line.split(',').map(p => p.trim());
    
    // Expected format: address,amount,asset,memo (memo optional)
    const [address, amount, asset = 'XLM', memo] = parts;
    
    return {
      id: `csv-${index}`,
      address: address || '',
      amount: amount || '',
      asset: asset || 'XLM',
      memo: memo || undefined,
    };
  });
}

export default function BatchPaymentForm({
  publicKey,
  xlmBalance,
  onBatchSuccess,
  onCancel,
}: BatchPaymentFormProps) {
  const [recipients, setRecipients] = useState<BatchRecipient[]>([createRecipient()]);
  const [csvError, setCsvError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addRecipient = useCallback(() => {
    if (recipients.length >= MAX_RECIPIENTS) {
      return;
    }
    setRecipients(prev => [...prev, createRecipient()]);
  }, [recipients.length]);

  const removeRecipient = useCallback((id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateRecipient = useCallback((id: string, field: keyof BatchRecipient, value: string) => {
    setRecipients(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        
        const updated = { ...r, [field]: value };
        
        // Clear error when user starts fixing
        if (updated.error) {
          updated.error = undefined;
        }
        
        return updated;
      })
    );
  }, []);

  const validateRecipients = useCallback(() => {
    let hasErrors = false;
    
    const validated = recipients.map(recipient => {
      const errors: string[] = [];
      
      // Validate address
      if (!recipient.address) {
        errors.push('Address required');
      } else if (!isValidStellarAddress(recipient.address)) {
        errors.push('Invalid Stellar address');
      } else if (recipient.address === publicKey) {
        errors.push('Cannot send to yourself');
      }
      
      // Validate amount
      const amount = parseFloat(recipient.amount);
      if (!recipient.amount || isNaN(amount)) {
        errors.push('Amount required');
      } else if (amount <= 0) {
        errors.push('Amount must be positive');
      }
      
      if (errors.length > 0) {
        hasErrors = true;
        return { ...recipient, error: errors.join('; ') };
      }
      
      return { ...recipient, error: undefined };
    });
    
    setRecipients(validated);
    return !hasErrors;
  }, [recipients, publicKey]);

  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Clear previous messages
      setCsvError('');
      setImportSuccess('');

      // Validate file type
      if (!file.name.endsWith('.csv')) {
        setCsvError('Please upload a .csv file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = parseCSV(text);

          if (parsed.length === 0) {
            setCsvError('CSV file is empty');
            return;
          }

          if (parsed.length > MAX_RECIPIENTS) {
            setCsvError(
              `CSV contains ${parsed.length} rows. Maximum ${MAX_RECIPIENTS} recipients allowed. Only first ${MAX_RECIPIENTS} will be imported.`
            );
          }

          // Take only first MAX_RECIPIENTS
          const limited = parsed.slice(0, MAX_RECIPIENTS);

          // Validate and flag invalid rows
          const validated: BatchRecipient[] = limited.map((row, index) => {
            const errors: string[] = [];

            if (!row.address) {
              errors.push('Missing address');
            } else if (!isValidStellarAddress(row.address)) {
              errors.push('Invalid address format');
            } else if (row.address === publicKey) {
              errors.push('Cannot send to yourself');
            }

            const amount = parseFloat(row.amount || '');
            if (!row.amount || isNaN(amount)) {
              errors.push('Missing or invalid amount');
            } else if (amount <= 0) {
              errors.push('Amount must be positive');
            }

            return {
              id: row.id || `import-${index}`,
              address: row.address || '',
              amount: row.amount || '',
              asset: row.asset || 'XLM',
              memo: row.memo,
              error: errors.length > 0 ? errors.join('; ') : undefined,
            };
          });

          setRecipients(validated);

          const validCount = validated.filter(r => !r.error).length;
          const invalidCount = validated.filter(r => r.error).length;

          if (invalidCount > 0) {
            setImportSuccess(
              `Imported ${validCount} valid rows. ${invalidCount} rows have errors (highlighted in red). Please fix them before submitting.`
            );
          } else {
            setImportSuccess(`Successfully imported ${validCount} recipients from CSV`);
          }
        } catch (error) {
          setCsvError('Failed to parse CSV file. Please check the format.');
        }
      };

      reader.onerror = () => {
        setCsvError('Failed to read file');
      };

      reader.readAsText(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [publicKey]
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!validateRecipients()) {
      return;
    }

    const validRecipients = recipients.filter(r => !r.error);
    onBatchSuccess?.(validRecipients);
  }, [recipients, validateRecipients, onBatchSuccess]);

  const totalAmount = recipients.reduce((sum, r) => {
    const amount = parseFloat(r.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const hasValidRecipients = recipients.some(
    r => isValidStellarAddress(r.address) && parseFloat(r.amount) > 0
  );

  const exceedsBalance = parseFloat(xlmBalance) > 0 && totalAmount > parseFloat(xlmBalance);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Payment</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Send payments to multiple recipients at once
          </p>
        </div>
        <button
          type="button"
          onClick={handleImportClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Upload size={18} />
          Import CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Upload CSV file"
        />
      </div>

      {/* CSV Messages */}
      {csvError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <p>{csvError}</p>
        </div>
      )}

      {importSuccess && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
          <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
          <p>{importSuccess}</p>
        </div>
      )}

      {/* CSV Format Help */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase mb-1">
          CSV Format
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <code>address,amount,asset,memo</code> (memo optional)
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Example: <code>GXXX...,10.5,XLM,Payment for service</code>
        </p>
      </div>

      {/* Recipients List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {recipients.map((recipient, index) => (
          <div
            key={recipient.id}
            className={`p-4 rounded-lg border ${
              recipient.error
                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                {index + 1}
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={recipient.address}
                    onChange={(e) => updateRecipient(recipient.id, 'address', e.target.value)}
                    placeholder="G..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={recipient.amount}
                    onChange={(e) => updateRecipient(recipient.id, 'amount', e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Asset */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Asset
                  </label>
                  <input
                    type="text"
                    value={recipient.asset}
                    onChange={(e) => updateRecipient(recipient.id, 'asset', e.target.value)}
                    placeholder="XLM"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Remove Button */}
              {recipients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRecipient(recipient.id)}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Remove recipient"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Memo (optional) */}
            <div className="mt-3 ml-11">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Memo (optional)
              </label>
              <input
                type="text"
                value={recipient.memo || ''}
                onChange={(e) => updateRecipient(recipient.id, 'memo', e.target.value)}
                placeholder="Optional memo"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Error Message */}
            {recipient.error && (
              <div className="mt-3 ml-11 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p className="font-medium">Fix me: {recipient.error}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Recipient Button */}
      {recipients.length < MAX_RECIPIENTS && (
        <button
          type="button"
          onClick={addRecipient}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Plus size={18} />
          Add Recipient ({recipients.length}/{MAX_RECIPIENTS})
        </button>
      )}

      {/* Summary */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Amount:
          </span>
          <span className={`text-lg font-bold ${
            exceedsBalance ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
          }`}>
            {totalAmount.toFixed(7)} XLM
          </span>
        </div>
        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          <span>Your Balance:</span>
          <span>{parseFloat(xlmBalance).toFixed(7)} XLM</span>
        </div>
        {exceedsBalance && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
            ⚠️ Total exceeds available balance
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasValidRecipients || exceedsBalance}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          Send Batch ({recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'})
        </button>
      </div>
    </div>
  );
}
