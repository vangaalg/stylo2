import React, { useState } from 'react';
import { User } from '../types';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (amount: number, transactionData?: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    amount: number;
    credits: number;
    package_name: string;
  }) => void;
  user?: User | null;
}

// REPLACE THIS WITH YOUR ACTUAL RAZORPAY KEY ID (From Razorpay Dashboard)
// @ts-ignore
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag"; 

export const PaymentModal: React.FC<PaymentModalProps> = ({ onClose, onSuccess, user }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<'starter' | 'pro' | 'mini' | 'single' | 'intro' | null>(null);

  // Helper function to calculate photo counts
  const getPhotoCounts = (credits: number) => {
    const fastPhotos = credits; // 1 credit = 1 photo in fast mode
    const qualityPhotos = Math.floor(credits / 2); // 2 credits = 1 photo in quality mode
    return `${credits} Credits (${fastPhotos} photos fast / ${qualityPhotos} photos quality)`;
  };

  const PACKAGES = {
    intro: {
      id: 'intro',
      name: 'Intro Pack',
      credits: 2,
      price: 9,
      description: getPhotoCounts(2),
      oneTimeOnly: true
    },
    single: {
      id: 'single',
      name: 'Single Pack',
      credits: 4,
      price: 99,
      description: getPhotoCounts(4)
    },
    mini: {
      id: 'mini',
      name: 'Trial Pack',
      credits: 8,
      price: 159,
      description: getPhotoCounts(8)
    },
    starter: {
      id: 'starter',
      name: 'Starter Pack',
      credits: 54,
      price: 999,
      description: getPhotoCounts(54)
    },
    pro: {
      id: 'pro',
      name: 'Pro Pack',
      credits: 102,
      price: 1500,
      description: getPhotoCounts(102)
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (pkgId: 'starter' | 'pro' | 'mini' | 'single' | 'intro') => {
    // Check if intro pack already purchased
    if (pkgId === 'intro' && user?.hasPurchasedIntroPack) {
      setError('You have already purchased the Intro Pack. This is a one-time offer.');
      return;
    }
    setError('');
    setIsProcessing(true);
    setSelectedPackage(pkgId);

    const pkg = PACKAGES[pkgId];

    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
      }

      // Create Order via API
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: pkg.price, currency: 'INR' })
      });

      const orderData = await response.json();

      if (!response.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      const options = {
        key: RAZORPAY_KEY_ID, 
        amount: orderData.amount,
        currency: orderData.currency,
        name: "StyleGenie AI",
        description: pkg.description,
        image: "https://cdn-icons-png.flaticon.com/512/3514/3514331.png",
        order_id: orderData.id,
        handler: async function (response: any) {
          // Payment Success - Verify signature on backend
          console.log("Payment ID: ", response.razorpay_payment_id);
          console.log("Order ID: ", response.razorpay_order_id);
          console.log("Signature: ", response.razorpay_signature);
          
          try {
            // Verify payment signature on backend
            const verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            console.log("Payment verified successfully:", verifyData);
            setIsProcessing(false);
            onSuccess(pkg.credits, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              amount: pkg.price,
              credits: pkg.credits,
              package_name: pkg.name
            });
          } catch (verifyError: any) {
            console.error("Payment verification error:", verifyError);
            setError("Payment completed but verification failed. Please contact support with Payment ID: " + response.razorpay_payment_id);
            setIsProcessing(false);
            setSelectedPackage(null);
          }
        },
        prefill: {
          name: "StyleGenie User", 
          email: "user@example.com",
          contact: ""
        },
        theme: {
          color: "#6366f1"
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false);
            setSelectedPackage(null);
          }
        }
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on('payment.failed', function (response: any){
        setError("Payment Failed: " + response.error.description);
        setIsProcessing(false);
        setSelectedPackage(null);
      });
      rzp1.open();

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong initializing payment.");
      setIsProcessing(false);
      setSelectedPackage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-2xl rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl relative animate-fade-in flex flex-col md:flex-row">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition z-20"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900 p-8 text-center relative overflow-hidden md:w-1/3 flex flex-col justify-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-4">Get More Styles</h2>
            <p className="text-indigo-200 text-sm mb-6">Choose a package to unlock high-definition AI fashion generations.</p>
            <div className="text-xs text-zinc-400">
              <p>✔ 4K Quality</p>
              <p>✔ Fast Generation</p>
              <p>✔ Priority Support</p>
            </div>
          </div>
        </div>

        {/* Pricing Content */}
        <div className="p-8 md:w-2/3 bg-zinc-950">
          <h3 className="text-xl font-bold text-white mb-6">Select Package</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
            {/* Intro Pack - One Time Only */}
            {(!user?.hasPurchasedIntroPack) ? (
              <div 
                onClick={() => !isProcessing && handlePayment('intro')}
                className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'intro' ? 'border-yellow-500 bg-yellow-900/10' : 'border-zinc-800 hover:border-yellow-600 bg-zinc-900'}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">One-Time Only</span>
                    <h4 className="text-base font-bold text-white mt-1">2 Credits</h4>
                    <p className="text-zinc-400 text-[10px]">{PACKAGES.intro.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">₹9</p>
                    {isProcessing && selectedPackage === 'intro' ? (
                      <span className="text-[10px] text-yellow-400 animate-pulse">Processing...</span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border-2 border-zinc-800 bg-zinc-900/50 opacity-60">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="bg-zinc-500/20 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Already Purchased</span>
                    <h4 className="text-base font-bold text-zinc-500 mt-1">2 Credits</h4>
                    <p className="text-zinc-600 text-[10px]">{PACKAGES.intro.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-zinc-600">₹9</p>
                    <span className="text-[10px] text-zinc-600">✓ Purchased</span>
                  </div>
                </div>
              </div>
            )}

            {/* Single Pack */}
            <div 
              onClick={() => !isProcessing && handlePayment('single')}
              className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'single' ? 'border-zinc-500 bg-zinc-800/50' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-zinc-500/20 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Standard</span>
                  <h4 className="text-base font-bold text-white mt-1">4 Credits</h4>
                  <p className="text-zinc-400 text-[10px]">{PACKAGES.single.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">₹99</p>
                  {isProcessing && selectedPackage === 'single' ? (
                    <span className="text-[10px] text-zinc-400 animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                  )}
                </div>
              </div>
            </div>

            {/* Mini Trial Pack */}
            <div 
              onClick={() => !isProcessing && handlePayment('mini')}
              className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'mini' ? 'border-emerald-500 bg-emerald-900/10' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Trial</span>
                  <h4 className="text-base font-bold text-white mt-1">8 Credits</h4>
                  <p className="text-zinc-400 text-[10px]">{PACKAGES.mini.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">₹159</p>
                  {isProcessing && selectedPackage === 'mini' ? (
                    <span className="text-[10px] text-emerald-400 animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                  )}
                </div>
              </div>
            </div>

            {/* Starter Pack */}
            <div 
              onClick={() => !isProcessing && handlePayment('starter')}
              className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'starter' ? 'border-indigo-500 bg-indigo-900/10' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Starter</span>
                  <h4 className="text-base font-bold text-white mt-1">54 Credits</h4>
                  <p className="text-zinc-400 text-[10px]">{PACKAGES.starter.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">₹999</p>
                  {isProcessing && selectedPackage === 'starter' ? (
                    <span className="text-[10px] text-indigo-400 animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                  )}
                </div>
              </div>
            </div>

            {/* Pro Pack */}
            <div 
              onClick={() => !isProcessing && handlePayment('pro')}
              className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'pro' ? 'border-purple-500 bg-purple-900/10' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
            >
              <div className="absolute -top-2 right-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                BEST VALUE
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pro</span>
                  <h4 className="text-base font-bold text-white mt-1">102 Credits</h4>
                  <p className="text-zinc-400 text-[10px]">{PACKAGES.pro.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">₹1500</p>
                  {isProcessing && selectedPackage === 'pro' ? (
                    <span className="text-[10px] text-purple-400 animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Credit Consumption Table */}
          <div className="mt-6 bg-zinc-900/50 rounded-lg border border-zinc-800 p-3">
            <h4 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Credit Usage Guide</h4>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-300">
              <div className="col-span-1 font-semibold text-zinc-500 border-b border-zinc-800 pb-1">Action</div>
              <div className="col-span-1 font-semibold text-zinc-500 border-b border-zinc-800 pb-1 text-center">Fast Mode</div>
              <div className="col-span-1 font-semibold text-zinc-500 border-b border-zinc-800 pb-1 text-center">Quality Mode</div>
              
              <div className="col-span-1 py-1">Start Generation (2 Photos)</div>
              <div className="col-span-1 py-1 text-center">2 Credits</div>
              <div className="col-span-1 py-1 text-center">4 Credits</div>
              
              <div className="col-span-1 py-1 bg-zinc-800/30">Generate 1 Photo</div>
              <div className="col-span-1 py-1 text-center bg-zinc-800/30">1 Credit</div>
              <div className="col-span-1 py-1 text-center bg-zinc-800/30">2 Credits</div>
            </div>
          </div>
          
          <p className="text-center text-zinc-600 text-[10px] mt-6">
            Secured by Razorpay. Supports UPI, Cards & Netbanking.
          </p>
        </div>
      </div>
    </div>
  );
};