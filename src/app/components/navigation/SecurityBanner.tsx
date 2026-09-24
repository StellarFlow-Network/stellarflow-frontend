import React, { useEffect, useState } from 'react';

const SecurityBanner: React.FC = () => {
  const [baseFee, setBaseFee] = useState<number>(0);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [showBanner, setShowBanner] = useState<boolean>(false);

  useEffect(() => {
    const fetchBaseFee = async () => {
      try {
        // Poll Horizon for the latest ledger base fee (in stroops)
        const response = await fetch('https://horizon.stellar.org/ledgers?order=desc&limit=1');
        const data = await response.json();
        const records = data._embedded?.records;
        if (records && records.length > 0) {
          const fee = records[0].base_fee;
          setBaseFee(fee);
          setShowBanner(fee > 1000);
        }
      } catch (error) {
        console.error('Failed to fetch network base fee:', error);
      }
    };

    fetchBaseFee();
    const intervalId = setInterval(fetchBaseFee, 30000); // Poll every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  const handlePriorityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPriority(event.target.value as 'low' | 'medium' | 'high');
    // In production, this would update the transaction fee priority configuration
  };

  if (!showBanner) return null;

  return (
    <div className="security-banner" style={bannerStyle}>
      <span>
        Network congestion detected! Base fee is {baseFee} stroops (&gt; 1000).
        Current priority: {priority}.
      </span>
      <select value={priority} onChange={handlePriorityChange}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  );
};

const bannerStyle: React.CSSProperties = {
  backgroundColor: '#ffcc00',
  padding: '10px 15px',
  color: '#000',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontWeight: 'bold',
};

export default SecurityBanner;
