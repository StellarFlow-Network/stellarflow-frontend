import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowRight, CheckCircle, ChevronLeft } from 'lucide-react';

type Step = 'source' | 'asset' | 'target' | 'review';

const steps: { id: Step; label: string }[] = [
  { id: 'source', label: 'Source' },
  { id: 'asset', label: 'Asset & Amount' },
  { id: 'target', label: 'Target' },
  { id: 'review', label: 'Review' }
];

const networks = [
  { id: 'stellar', name: 'Stellar', icon: '🚀' },
  { id: 'ethereum', name: 'Ethereum', icon: '⟠' },
  { id: 'polygon', name: 'Polygon', icon: '🟣' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔵' },
];

const assets = [
  { id: 'usdc', name: 'USDC', balance: '1,234.56' },
  { id: 'xlm', name: 'XLM', balance: '10,000.00' },
  { id: 'eth', name: 'ETH', balance: '0.5' },
];

export default function MobileBridgeWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

  const [sourceNetwork, setSourceNetwork] = useState<string | null>(null);
  const [targetNetwork, setTargetNetwork] = useState<string | null>(null);
  const [asset, setAsset] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setDirection(1);
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const currentStep = steps[currentStepIndex].id;

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const variants = {
    enter: (direction: number) => {
      return {
        x: direction > 0 ? 300 : -300,
        opacity: 0
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => {
      return {
        zIndex: 0,
        x: direction < 0 ? 300 : -300,
        opacity: 0
      };
    }
  };

  const handleDragEnd = (e: any, { offset, velocity }: any) => {
    const swipe = swipePower(offset.x, velocity.x);
    if (swipe < -swipeConfidenceThreshold) {
      nextStep();
    } else if (swipe > swipeConfidenceThreshold) {
      prevStep();
    }
  };

  const isStepValid = () => {
    if (currentStep === 'source') return !!sourceNetwork;
    if (currentStep === 'asset') return !!asset && !!amount && Number(amount) > 0;
    if (currentStep === 'target') return !!targetNetwork && targetNetwork !== sourceNetwork;
    return true;
  };

  return (
    <div className="flex flex-col h-full max-h-[100dvh] bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
      {/* Header & Progress */}
      <div className="pt-6 pb-4 px-4 bg-white dark:bg-gray-800 shadow-sm z-10 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={prevStep} 
            disabled={currentStepIndex === 0}
            className="p-2 -ml-2 rounded-full disabled:opacity-30 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">Bridge Assets</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        {/* Progress Indicators */}
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-300 ${
                    isCompleted ? 'bg-blue-600 border-blue-600 text-white' :
                    isCurrent ? 'bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400' :
                    'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-center mt-2 text-sm font-medium text-gray-600 dark:text-gray-400 h-5">
          {steps[currentStepIndex].label}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentStepIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 w-full h-full p-4 overflow-y-auto pb-24"
          >
            {/* SOURCE STEP */}
            {currentStep === 'source' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold mb-4">Select Source Network</h2>
                <div className="grid grid-cols-1 gap-3">
                  {networks.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setSourceNetwork(n.id)}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                        sourceNetwork === n.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-transparent bg-white dark:bg-gray-800 shadow-sm hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      <span className="text-3xl mr-4">{n.icon}</span>
                      <span className="text-lg font-semibold flex-1 text-left">{n.name}</span>
                      {sourceNetwork === n.id && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ASSET STEP */}
            {currentStep === 'asset' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-4">Select Asset</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {assets.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setAsset(a.id)}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                          asset === a.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-transparent bg-white dark:bg-gray-800 shadow-sm hover:border-gray-200 dark:hover:border-gray-700'
                        }`}
                      >
                        <div className="flex-1 text-left">
                          <div className="text-lg font-semibold">{a.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Balance: {a.balance}</div>
                        </div>
                        {asset === a.id && (
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <h2 className="text-xl font-bold mb-4">Amount</h2>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-3xl font-bold bg-transparent outline-none"
                      />
                      <span className="text-xl font-medium text-gray-500 ml-2 uppercase">
                        {asset || 'Select'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TARGET STEP */}
            {currentStep === 'target' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold mb-4">Select Target Network</h2>
                <div className="grid grid-cols-1 gap-3">
                  {networks.map(n => {
                    const isDisabled = n.id === sourceNetwork;
                    return (
                      <button
                        key={n.id}
                        onClick={() => setTargetNetwork(n.id)}
                        disabled={isDisabled}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all ${
                          isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900 border-transparent' :
                          'active:scale-[0.98]'
                        } ${
                          targetNetwork === n.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : !isDisabled ? 'border-transparent bg-white dark:bg-gray-800 shadow-sm hover:border-gray-200 dark:hover:border-gray-700' : ''
                        }`}
                      >
                        <span className="text-3xl mr-4">{n.icon}</span>
                        <div className="flex-1 text-left flex flex-col">
                          <span className="text-lg font-semibold">{n.name}</span>
                          {isDisabled && <span className="text-xs text-red-500 font-medium">Source network</span>}
                        </div>
                        {targetNetwork === n.id && (
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* REVIEW STEP */}
            {currentStep === 'review' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold mb-2">Review Transaction</h2>
                
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm space-y-6">
                  {/* Amount big display */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">You are sending</div>
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                      {amount} <span className="text-2xl text-gray-600 dark:text-gray-300 uppercase">{asset}</span>
                    </div>
                  </div>

                  {/* Path */}
                  <div className="flex items-center justify-between px-4 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl mb-1">{networks.find(n => n.id === sourceNetwork)?.icon}</span>
                      <span className="text-sm font-semibold">{networks.find(n => n.id === sourceNetwork)?.name}</span>
                    </div>
                    <ArrowRight className="text-gray-400" />
                    <div className="flex flex-col items-center">
                      <span className="text-3xl mb-1">{networks.find(n => n.id === targetNetwork)?.icon}</span>
                      <span className="text-sm font-semibold">{networks.find(n => n.id === targetNetwork)?.name}</span>
                    </div>
                  </div>

                  {/* Summary details */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Bridge Fee</span>
                      <span className="font-medium">~0.1 {asset?.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Estimated Time</span>
                      <span className="font-medium">2-5 minutes</span>
                    </div>
                    <div className="flex justify-between text-sm pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span className="font-semibold">You will receive</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {Math.max(0, Number(amount) - 0.1).toFixed(2)} {asset?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 z-10 shrink-0">
        <button
          onClick={currentStepIndex === steps.length - 1 ? () => alert('Confirming Transaction!') : nextStep}
          disabled={!isStepValid()}
          className="w-full py-4 px-6 rounded-2xl bg-blue-600 text-white font-bold text-lg flex justify-center items-center active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-600/20"
        >
          {currentStepIndex === steps.length - 1 ? 'Confirm Bridge' : 'Continue'}
          {currentStepIndex < steps.length - 1 && <ChevronRight className="ml-2 w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
