// src/components/RemittanceContactsModal.tsx
import React, { useState, useEffect } from 'react';

interface Contact {
  id: string;
  name: string;
  address: string;
  memo?: string;
}

interface RemittanceContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
}

const STORAGE_KEY = 'stellarflow_saved_contacts';

export const RemittanceContactsModal: React.FC<RemittanceContactsModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setContacts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved contacts', e);
      }
    }
  }, []);

  const saveContacts = (updated: Contact[]) => {
    setContacts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !address.trim()) {
      setError('Name and public key / address are required');
      return;
    }

    const newContact: Contact = {
      id: Date.now().toString(),
      name: name.trim(),
      address: address.trim(),
      memo: memo.trim() || undefined,
    };

    saveContacts([...contacts, newContact]);
    setName('');
    setAddress('');
    setMemo('');
  };

  const handleDelete = (id: string) => {
    saveContacts(contacts.filter((c) => c.id !== id));
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contacts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "stellarflow_contacts_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            saveContacts(parsed);
          }
        } catch (err) {
          setError('Invalid backup file format');
        }
      };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Saved Contacts Directory</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleAddContact} className="mb-4 rounded-lg bg-slate-950 p-4 border border-slate-800">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-2">
            <input
              type="text"
              placeholder="Contact Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 border border-slate-800 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Public Key / G... or Domain"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 border border-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Default Memo (Optional)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 border border-slate-800 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow"
            >
              Add Contact
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-rose-400">❌ {error}</p>}
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
          {contacts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No saved contacts found.</p>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800 hover:border-slate-700 transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-200">{contact.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">{contact.address}</div>
                  {contact.memo && <div className="text-[10px] text-indigo-400">Memo: {contact.memo}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onSelectContact(contact);
                      onClose();
                    }}
                    className="rounded bg-emerald-950 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 border border-emerald-800 hover:bg-emerald-900"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="rounded bg-rose-950 px-2 py-1 text-[10px] font-semibold text-rose-400 border border-rose-800 hover:bg-rose-900"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Export Backup
            </button>
            <label className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors">
              Import Backup
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};