import React, { useState } from 'react';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (amount: number) => void; // Updated to pass amount/credits
}

// REPLACE THIS WITH YOUR ACTUAL RAZORPAY KEY ID (From Razorpay Dashboard)
// @ts-ignore
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag"; 

export const PaymentModal: React.FC<PaymentModalProps> = ({ onClose, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<'starter' | 'pro' | null>(null);

  const PACKAGES = {
    starter: {
      id: 'starter',
      name: 'Starter Pack',
      credits: 54,
      price: 999,
      description: '54 Photos (~18 Lookbooks)'
    },
    pro: {
      id: 'pro',
      name: 'Pro Pack',
      credits: 102,
      price: 1500,
      description: '102 Photos (~34 Lookbooks)'
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

  const handlePayment = async (pkgId: 'starter' | 'pro') => {
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
        handler: function (response: any) {
          // Payment Success
          console.log("Payment ID: ", response.razorpay_payment_id);
          console.log("Order ID: ", response.razorpay_order_id);
          console.log("Signature: ", response.razorpay_signature);
          
          // TODO: Verify signature on backend for security
          
          setIsProcessing(false);
          onSuccess(pkg.credits);
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

          <div className="space-y-4">
            {/* Starter Pack */}
            <div 
              onClick={() => !isProcessing && handlePayment('starter')}
              className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'starter' ? 'border-indigo-500 bg-indigo-900/10' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full uppercase">Starter</span>
                  <h4 className="text-lg font-bold text-white mt-1">54 Photos</h4>
                  <p className="text-zinc-400 text-xs">~18 Lookbooks</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">₹999</p>
                  {isProcessing && selectedPackage === 'starter' ? (
                    <span className="text-xs text-indigo-400 animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-xs text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                  )}
                </div>
              </div>
            </div>

            {/* Pro Pack */}
            <div 
              onClick={() => !isProcessing && handlePayment('pro')}
              className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPackage === 'pro' ? 'border-purple-500 bg-purple-900/10' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
            >
              <div className="absolute -top-3 right-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                MOST POPULAR
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-2 py-1 rounded-full uppercase">Pro Value</span>
                  <h4 className="text-lg font-bold text-white mt-1">102 Photos</h4>
                  <p className="text-zinc-400 text-xs">~34 Lookbooks</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">₹1500</p>
                  {isProcessing && selectedPackage === 'pro' ? (
                    <span className="text-xs text-purple-400 animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-xs text-zinc-500 group-hover:text-white transition-colors">Buy Now →</span>
                  )}
                </div>
              </div>
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