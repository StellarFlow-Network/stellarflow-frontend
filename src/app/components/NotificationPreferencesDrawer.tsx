import React, { useState, useEffect } from 'react';
import { X, BellRing, BellOff, Loader2, Search, Users, ShieldCheck, CheckCircle2, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '../hooks/useDebounce';

interface NotificationPreferencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Delegate {
  id: string;
  name: string;
  address: string;
  participationRate: number;
  statement: string;
}

const TOGGLE_STYLES = {
  enabled: {
    track: 'bg-blue-600',
    knob: 'right-1',
  },
  disabled: {
    track: 'bg-gray-700',
    knob: 'left-1',
  },
};

const MOCK_DELEGATES: Delegate[] = [
  {
    id: '1',
    name: 'StellarWhale',
    address: 'GABC1234DEF5678GHIJ9012KLMN3456OPQR7890STUV1234WXYZ',
    participationRate: 98,
    statement: 'Focused on protocol security and long-term ecosystem sustainability.',
  },
  {
    id: '2',
    name: 'LumenGuard',
    address: 'GDEF5678GHIJ9012KLMN3456OPQR7890STUV1234WXYZ5678ABCD',
    participationRate: 87,
    statement: 'Advocating for transparent treasury management and developer grants.',
  },
  {
    id: '3',
    name: 'NovaValidator',
    address: 'GHIJ9012KLMN3456OPQR7890STUV1234WXYZ5678ABCD9012EFGH',
    participationRate: 72,
    statement: 'Prioritizing decentralization and validator incentive alignment.',
  },
];

export function NotificationPreferencesDrawer({ isOpen, onClose }: NotificationPreferencesDrawerProps) {
  const [preferences, setPreferences] = useState({
    orderFills: true,
    priceSpikes: true,
    governance: false,
    vaultRisk: true,
  });
  
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'delegation'>('notifications');
  const [searchQuery, setSearchQuery] = useState('');
  const [delegatingId, setDelegatingId] = useState<string | null>(null);

  const filteredDelegates = MOCK_DELEGATES.filter((delegate) => {
    const query = searchQuery.toLowerCase();
    return (
      delegate.name.toLowerCase().includes(query) ||
      delegate.address.toLowerCase().includes(query)
    );
  });

  const handleDelegate = async (delegate: Delegate) => {
    setDelegatingId(delegate.id);
    try {
      // Simulating wallet signature prompt for governance delegation
      await new Promise((resolve) => setTimeout(resolve, 1200));
      console.log('Delegating votes to', delegate.address, 'with contract params:', {
        contract: 'governance',
        method: 'delegate',
        delegatee: delegate.address,
      });
    } catch (err) {
      console.error('Delegation failed', err);
    } finally {
      setDelegatingId(null);
    }
  };

  const debouncedPreferences = useDebounce(preferences, 1000);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (!initialLoaded) {
      setInitialLoaded(true);
      return;
    }
    const syncWithBackend = async () => {
      setIsSaving(true);
      try {
        // Simulating backend sync
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log('Synced push subscription preferences with backend:', debouncedPreferences);
      } catch (err) {
        console.error('Failed to sync', err);
      } finally {
        setIsSaving(false);
      }
    };
    syncWithBackend();
  }, [debouncedPreferences]);

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMute = async () => {
    setIsSaving(true);
    // Simulating backend sync for mute
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (mutedUntil && mutedUntil > Date.now()) {
      setMutedUntil(null);
    } else {
      setMutedUntil(Date.now() + 24 * 60 * 60 * 1000);
    }
    setIsSaving(false);
  };

  const sendTestNotification = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notification");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification("Test Alert", {
        body: "This is a test notification from StellarFlow.",
        icon: "/sf.webp"
      });
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("Test Alert", {
          body: "This is a test notification from StellarFlow.",
          icon: "/sf.webp"
        });
      }
    } else {
      alert("Push notifications are blocked by your browser settings.");
    }
  };

  const isMuted = mutedUntil && mutedUntil > Date.now();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#161b22] border-l border-gray-800 shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <BellRing className="text-blue-400" size={24} />
                <h2 className="text-xl font-bold text-gray-100">Push Preferences</h2>
              </div>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 text-gray-200">
              <div className="flex gap-2 p-1 bg-[#0d1117] rounded-xl border border-gray-800">
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Notifications
                </button>
                <button
                  onClick={() => setActiveTab('delegation')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'delegation' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Delegation
                </button>
              </div>

              {activeTab === 'notifications' && (
                <>
              <section className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-800/50">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Channels</h3>
                  {isSaving && <Loader2 size={16} className="animate-spin text-blue-500" />}
                </div>
                <div className="space-y-3">
                  <ToggleRow
                    title="Order Fills"
                    description="Get notified when your limit orders are executed."
                    enabled={preferences.orderFills}
                    onToggle={() => handleToggle('orderFills')}
                    disabled={!!isMuted}
                  />
                  <ToggleRow
                    title="Price Spikes"
                    description="Alerts for significant asset price volatility."
                    enabled={preferences.priceSpikes}
                    onToggle={() => handleToggle('priceSpikes')}
                    disabled={!!isMuted}
                  />
                  <ToggleRow
                    title="Governance"
                    description="Updates on DAO proposals and voting periods."
                    enabled={preferences.governance}
                    onToggle={() => handleToggle('governance')}
                    disabled={!!isMuted}
                  />
                  <ToggleRow
                    title="Vault Risk"
                    description="Critical alerts regarding vault liquidation risks."
                    enabled={preferences.vaultRisk}
                    onToggle={() => handleToggle('vaultRisk')}
                    disabled={!!isMuted}
                  />
                </div>
              </section>

              <section className="space-y-4 pt-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-800/50">Quiet Mode</h3>
                <div className="bg-[#0d1117] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mute for 24 Hours</p>
                    <p className="text-xs text-gray-500 mt-1">Temporarily pause all push notifications.</p>
                  </div>
                  <button
                    onClick={handleMute}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isMuted ? TOGGLE_STYLES.enabled.track : TOGGLE_STYLES.disabled.track}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isMuted ? TOGGLE_STYLES.enabled.knob : TOGGLE_STYLES.disabled.knob}`} />
                  </button>
                </div>
              </section>

              <section className="space-y-4 pt-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-800/50">Diagnostics</h3>
                <button
                  onClick={sendTestNotification}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-900/50 py-3 rounded-xl transition-colors font-medium text-sm"
                >
                  <BellRing size={16} />
                  Send Test Notification
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Verifies client delivery and browser permissions.
                </p>
              </section>
                </>
              )}

              {activeTab === 'delegation' && (
                <section className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-800/50">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Community Delegates</h3>
                    <Users size={16} className="text-blue-500" />
                  </div>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or address..."
                      className="w-full bg-[#0d1117] border border-gray-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600 transition-colors"
                    />
                  </div>
                  <div className="space-y-3">
                    {filteredDelegates.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-6">No delegates match your search.</p>
                    )}
                    {filteredDelegates.map((delegate) => (
                      <div
                        key={delegate.id}
                        className="bg-[#0d1117] p-4 rounded-xl border border-gray-800 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={18} className="text-blue-400" />
                            <div>
                              <p className="font-medium text-sm text-gray-100">{delegate.name}</p>
                              <p className="text-xs text-gray-500 font-mono truncate max-w-[180px]">
                                {delegate.address.slice(0, 6)}...{delegate.address.slice(-4)}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${delegate.participationRate >= 90 ? 'bg-green-900/40 text-green-400' : delegate.participationRate >= 75 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>
                            {delegate.participationRate}% participation
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{delegate.statement}</p>
                        <button
                          onClick={() => handleDelegate(delegate)}
                          disabled={delegatingId !== null}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-900/50 py-2.5 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                        >
                          {delegatingId === delegate.id ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Awaiting Signature...
                            </>
                          ) : (
                            <>
                              <Wallet size={16} />
                              Delegate Votes
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ToggleRow({ title, description, enabled, onToggle, disabled = false }: { title: string, description: string, enabled: boolean, onToggle: () => void, disabled?: boolean }) {
  const trackClasses = enabled ? TOGGLE_STYLES.enabled.track : TOGGLE_STYLES.disabled.track;
  const knobClasses = enabled ? TOGGLE_STYLES.enabled.knob : TOGGLE_STYLES.disabled.knob;

  return (
    <div className={`flex items-start justify-between py-2 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="pr-4">
        <p className="font-medium text-sm text-gray-200">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 mt-1 ${trackClasses}`}
      >
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${knobClasses}`} />
      </button>
    </div>
  );
}
