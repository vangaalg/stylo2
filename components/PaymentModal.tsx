import React, { useState } from 'react';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// REPLACE THIS WITH YOUR ACTUAL RAZORPAY KEY ID (From Razorpay Dashboard)
const RAZORPAY_KEY_ID = "rzp_test_1DP5mmOlF5G5ag"; // Example Test Key

export const PaymentModal: React.FC<PaymentModalProps> = ({ onClose, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = () => {
    setError('');
    setIsProcessing(true);

    const options = {
      key: RAZORPAY_KEY_ID, 
      amount: 99900, // Amount is in paise (999 INR = 99900 paise)
      currency: "INR",
      name: "StyleGenie AI",
      description: "100 Photo Credits Pack",
      image: "https://cdn-icons-png.flaticon.com/512/3514/3514331.png", // Generic fashion icon
      handler: function (response: any) {
        // Payment Success
        console.log("Payment ID: ", response.razorpay_payment_id);
        setIsProcessing(false);
        onSuccess();
      },
      prefill: {
        name: "StyleGenie User", 
        email: "user@example.com",
        contact: "9999999999"
      },
      theme: {
        color: "#6366f1" // Indigo-500 matching app theme
      },
      modal: {
        ondismiss: function() {
          setIsProcessing(false);
        }
      }
    };

    try {
      if (!window.Razorpay) {
        throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
      }
      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: any){
        setError("Payment Failed: " + response.error.description);
        setIsProcessing(false);
      });
      rzp1.open();
    } catch (err: any) {
      setError(err.message || "Something went wrong initializing payment.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl relative animate-fade-in">
        
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
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">Out of Credits</h2>
            <p className="text-indigo-200 text-sm">You've used your free allowance.</p>
          </div>
        </div>

        {/* Pricing Content */}
        <div className="p-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-zinc-400 text-sm font-medium uppercase tracking-wide">Pro Pack</p>
              <h3 className="text-3xl font-bold text-white">100 Photos</h3>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 line-through text-sm">₹2,499</p>
              <p className="text-3xl font-bold text-indigo-400">₹999</p>
            </div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex items-center text-zinc-300">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              High Definition 4K Generation
            </li>
            <li className="flex items-center text-zinc-300">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Generate 3 Styles at once
            </li>
            <li className="flex items-center text-zinc-300">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Instant Access
            </li>
          </ul>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-xs">
              {error}
            </div>
          )}

          <button
            id="pay-btn"
            onClick={handlePayment}
            disabled={isProcessing}
            className={`w-full font-bold py-4 rounded-xl transition transform active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
              isProcessing 
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
              : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Pay ₹999 via Razorpay'
            )}
          </button>
          
          <p className="text-center text-zinc-600 text-xs mt-4">
            Supports UPI (GPay, BHIM), Cards & Netbanking.
          </p>
        </div>
      </div>
    </div>
  );
};