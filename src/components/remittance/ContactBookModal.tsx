import React, { useState, useEffect } from 'react';
import { X, Search, Download, Upload, Plus, Trash2, Send } from 'lucide-react';

export interface Contact {
  id: string;
  alias: string;
  address: string;
  bankAccount: string;
  memo: string;
}

interface ContactBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
}

export function ContactBookModal({ isOpen, onClose, onSelectContact }: ContactBookModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({});

  useEffect(() => {
    const saved = localStorage.getItem('stellarflow-contacts');
    if (saved) {
      try {
        setContacts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse contacts', e);
      }
    }
  }, []);

  const saveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem('stellarflow-contacts', JSON.stringify(newContacts));
  };

  const handleAdd = () => {
    if (!newContact.alias || !newContact.address) return;
    const contact: Contact = {
      id: crypto.randomUUID(),
      alias: newContact.alias,
      address: newContact.address,
      bankAccount: newContact.bankAccount || '',
      memo: newContact.memo || '',
    };
    saveContacts([...contacts, contact]);
    setIsAdding(false);
    setNewContact({});
  };

  const handleDelete = (id: string) => {
    saveContacts(contacts.filter(c => c.id !== id));
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contacts));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "stellarflow-contacts.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          saveContacts(imported);
        }
      } catch (error) {
        console.error("Error importing contacts", error);
      }
    };
    reader.readAsText(file);
  };

  const filteredContacts = contacts.filter(c => 
    c.alias.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Book</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col h-[60vh]">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Search by alias or address..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
              />
            </div>
            <button onClick={() => setIsAdding(!isAdding)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 font-medium transition-colors">
              <Plus size={20} /> New Contact
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={handleExport} className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700">
              <Download size={16} /> Export
            </button>
            <label className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700">
              <Upload size={16} /> Import
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>

          {isAdding && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Add New Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Alias (e.g. Family - Lagos)"
                  className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  value={newContact.alias || ''}
                  onChange={(e) => setNewContact({...newContact, alias: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Recipient Address"
                  className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  value={newContact.address || ''}
                  onChange={(e) => setNewContact({...newContact, address: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Bank Account (Optional)"
                  className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  value={newContact.bankAccount || ''}
                  onChange={(e) => setNewContact({...newContact, bankAccount: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Memo (Optional)"
                  className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  value={newContact.memo || ''}
                  onChange={(e) => setNewContact({...newContact, memo: e.target.value})}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
                <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Save Contact</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {filteredContacts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 space-y-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                  <Search size={32} className="opacity-50" />
                </div>
                <p>No contacts found.</p>
              </div>
            ) : (
              filteredContacts.map(contact => (
                <div key={contact.id} className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-blue-500/50 transition-colors group flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                      {contact.alias}
                    </h4>
                    <p className="text-sm text-gray-500 font-mono mt-1 break-all pr-4">{contact.address}</p>
                    {(contact.bankAccount || contact.memo) && (
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {contact.bankAccount && <span>Bank: <span className="text-gray-700 dark:text-gray-300">{contact.bankAccount}</span></span>}
                        {contact.memo && <span>Memo: <span className="text-gray-700 dark:text-gray-300">{contact.memo}</span></span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onSelectContact(contact)} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2 font-medium transition-colors">
                      <Send size={16} /> Send
                    </button>
                    <button onClick={() => handleDelete(contact.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
