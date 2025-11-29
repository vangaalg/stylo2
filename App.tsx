import React, { useState, useRef, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PaymentModal } from './components/PaymentModal';
import { 
  analyzeUserFace, 
  analyzeClothItem, 
  generateTryOnImage,
  removeFaceFromClothingImage
} from './services/geminiService';
import { deductCredits, addCredits } from './services/userService';
import { 
  AppStep, 
  UserAnalysis, 
  ClothAnalysis, 
  STYLES, 
  GenerationStyle,
  User
} from './types';

const App: React.FC = () => {
  // --- MOCK AUTH FOR TESTING PHASE ---
  // We initialize with a dummy user so you can test features without Supabase
  const [user, setUser] = useState<User | null>({
    id: 'test-guest-id',
    email: 'guest@stylegenie.com',
    credits: 50,
    isAdmin: false 
  });
  
  const [showPayment, setShowPayment] = useState(false);

  // --- App Logic State ---
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD_USER);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [userImage, setUserImage] = useState<string | null>(null);
  const [userAnalysis, setUserAnalysis] = useState<UserAnalysis | null>(null);
  
  const [clothImage, setClothImage] = useState<string | null>(null);
  const [clothAnalysis, setClothAnalysis] = useState<ClothAnalysis | null>(null);
  
  // Manual overrides
  const [manualClothType, setManualClothType] = useState<string>('');
  const [manualColor, setManualColor] = useState<string>('');
  
  // User details
  const [userAge, setUserAge] = useState<string>('');
  const [userHeight, setUserHeight] = useState<string>('');

  const [generatedImages, setGeneratedImages] = useState<{style: string, url: string}[]>([]);
  
  // UI State
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Wake Lock for preventing device sleep during generation
  const wakeLockRef = useRef<any>(null);

  // Request notification permission on mount and cleanup on unmount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current !== null && isLoading) {
        await requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup wake lock on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [isLoading]);

  // Wake Lock functions
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock activated - device will stay awake during generation');
      }
    } catch (err) {
      console.warn('Wake Lock not supported or failed:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock released');
      } catch (err) {
        console.warn('Failed to release wake lock:', err);
      }
    }
  };

  // Send notification when generation is complete
  const sendCompletionNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('StyleGenie - Generation Complete! 🎉', {
        body: 'Your lookbook is ready! Click to view your 3 amazing styles.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'generation-complete',
        requireInteraction: true
      });
    }
  };

  // --- Handlers ---

  const handlePaymentSuccess = async () => {
    if (!user) return;
    try {
      // Mock DB update for test user
      if (user.id === 'test-guest-id') {
         setUser({ ...user, credits: user.credits + 100 });
      } else {
         // Real DB update (won't run in test mode)
         const newBalance = await addCredits(user.id, user.credits, 100);
         setUser({ ...user, credits: newBalance });
      }
      setShowPayment(false);
    } catch (e) {
      console.error("Failed to update credits", e);
    }
  };

  const handleLogout = async () => {
    // Just reload in test mode to reset
    window.location.reload();
  };

  const handleUserUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUserImage(base64);
      processUserImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processUserImage = async (base64: string) => {
    setIsLoading(true);
    setLoadingMessage("Analyzing face...");
    setError(null);
    try {
      const analysis = await analyzeUserFace(base64);
      if (!analysis.isFace) {
        setError("❌ No clear face detected! Please upload a photo showing your face clearly. Make sure your face is well-lit and visible in the photo.");
        setUserImage(null);
      } else {
        setUserAnalysis(analysis);
        setStep(AppStep.UPLOAD_CLOTH);
      }
    } catch (err) {
      setError("⚠️ Failed to analyze image. Please try again with a clear face photo.");
      console.error(err);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleClothUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setClothImage(base64);
      processClothImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processClothImage = async (base64: string) => {
    setIsLoading(true);
    setLoadingMessage("Analyzing clothing...");
    setError(null);
    try {
      const analysis = await analyzeClothItem(base64);
      if (!analysis.isClothing) {
        setError("❌ This doesn't look like clothing! Please upload a photo of a dress, shirt, pants, or any clothing item you want to try on.");
        setClothImage(null);
      } else {
        setClothAnalysis(analysis);
        setManualClothType(analysis.clothingType);
        setManualColor(analysis.color);
        
        // If face detected in clothing image, clean it
        if (analysis.hasFaceInImage) {
          setLoadingMessage("Detected face in clothing image. Cleaning...");
          const cleanedImage = await removeFaceFromClothingImage(base64);
          setClothImage(cleanedImage);
          // Show info message to user
          setError("ℹ️ We detected a face in the clothing image and cleaned it. Only your face from the first photo will be used.");
        }
        
        setStep(AppStep.CONFIRMATION);
      }
    } catch (err) {
      setError("⚠️ Failed to analyze clothing. Please try again with a clear clothing photo.");
      console.error(err);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleGenerate = async () => {
    if (!userImage || !clothImage || !userAnalysis || !user) return;

    const COST = 3;
    if (!user.isAdmin && user.credits < COST) {
      setShowPayment(true);
      return;
    }
    
    setStep(AppStep.GENERATING);
    setIsLoading(true);
    setLoadingMessage("Initializing Stylist...");
    setError(null);

    // Activate wake lock to prevent device from sleeping
    await requestWakeLock();

    const finalClothType = manualClothType || clothAnalysis?.clothingType || "clothing";
    const finalColor = manualColor || clothAnalysis?.color || "multi-colored";
    
    // Build user description with age and height if provided
    let userDesc = `${userAnalysis.gender} person, ${userAnalysis.description}`;
    if (userAge) userDesc += `, age ${userAge}`;
    if (userHeight) userDesc += `, height ${userHeight}`;
    
    const clothDesc = `${finalClothType}, ${finalColor}, ${clothAnalysis?.pattern}`;

    try {
      // Show results screen immediately to display progress
      setStep(AppStep.RESULTS);
      
      // Deduct credits upfront
      if (!user.isAdmin) {
         if (user.id === 'test-guest-id') {
           // Mock deduction for testing
           setUser({ ...user, credits: user.credits - COST });
         } else {
           // Real DB deduction
           const newBalance = await deductCredits(user.id, user.credits, COST);
           setUser({ ...user, credits: newBalance });
         }
      }
      
      // Sequential generation - show each image as it completes
      for (let index = 0; index < STYLES.length; index++) {
        const style = STYLES[index];
        try {
          setLoadingMessage(`Generating ${style.name} (${index + 1}/${STYLES.length})...`);
          const url = await generateTryOnImage(
            userImage, 
            clothImage, 
            userDesc, 
            clothDesc, 
            style.promptSuffix,
            (msg) => setLoadingMessage(`${style.name}: ${msg}`),
            clothAnalysis?.hasFaceInImage || false
          );
          
          // Add this image to the results as soon as it's ready
          setGeneratedImages(prev => [...prev, { style: style.name, url }]);
        } catch (err) {
          console.error(`Failed to generate ${style.name}:`, err);
          // Add placeholder for failed image
          setGeneratedImages(prev => [...prev, { style: style.name, url: '' }]);
        }
      }
      
      // Send notification when all images are complete
      sendCompletionNotification();
      
    } catch (err) {
      setError("Generation failed. The model might be busy or the request invalid. Try again.");
      setStep(AppStep.CONFIRMATION);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
      
      // Release wake lock when generation is complete
      await releaseWakeLock();
    }
  };

  const handleReset = () => {
    setStep(AppStep.UPLOAD_USER);
    setUserImage(null);
    setClothImage(null);
    setUserAnalysis(null);
    setClothAnalysis(null);
    setGeneratedImages([]);
    setError(null);
    setManualClothType('');
    setManualColor('');
    setUserAge('');
    setUserHeight('');
  };

  // --- Render Steps ---

  const renderUploadUser = () => (
    <div className="space-y-6 text-center animate-fade-in">
      <div className="bg-zinc-800/50 p-8 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-indigo-500 transition-colors">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">Upload Your Photo</h3>
        <p className="text-zinc-400 mb-6 text-sm">Clear face photo, good lighting.</p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-xl font-semibold hover:bg-white transition shadow-lg hover:shadow-indigo-500/20"
          >
            Upload Photo
          </button>
          <button 
            onClick={() => setShowCamera(true)}
            className="bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition border border-zinc-600"
          >
            Use Camera
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleUserUpload} 
          className="hidden" 
        />
      </div>
    </div>
  );

  const renderUploadCloth = () => (
    <div className="space-y-6 text-center animate-fade-in">
      <div className="flex justify-center mb-6">
        <img src={userImage!} alt="User" className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-xl" />
      </div>
      
      <div className="bg-zinc-800/50 p-8 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-pink-500 transition-colors">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">Upload Clothing</h3>
        <p className="text-zinc-400 mb-6 text-sm">Shirt, dress, trousers, blazer, etc.</p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-xl font-semibold hover:bg-white transition shadow-lg hover:shadow-pink-500/20"
          >
            Select Cloth Image
          </button>
          <button 
            onClick={() => setShowCamera(true)}
            className="bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition border border-zinc-600"
          >
            Use Camera
          </button>
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleClothUpload} 
          className="hidden" 
        />
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Model</span>
            <span className="text-xs text-indigo-400 font-medium">{userAnalysis?.gender}</span>
          </div>
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-700 group bg-zinc-900">
             <img src={userImage!} alt="User" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center p-4">
               <p className="text-sm text-center text-zinc-200">{userAnalysis?.description}</p>
             </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Apparel</span>
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-700 group bg-zinc-900">
             <img src={clothImage!} alt="Cloth" className="w-full h-full object-contain p-2" />
          </div>
          
          <div className="space-y-3 bg-zinc-800/50 p-4 rounded-xl border border-zinc-700">
             <div className="space-y-1">
               <label className="text-xs text-zinc-400 block">Type</label>
               <input 
                  type="text" 
                  value={manualClothType}
                  onChange={(e) => setManualClothType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 transition text-white placeholder-zinc-600"
                  placeholder="e.g. Shirt, Dress"
               />
             </div>
             <div className="space-y-1">
               <label className="text-xs text-zinc-400 block">Color</label>
               <input 
                  type="text" 
                  value={manualColor}
                  onChange={(e) => setManualColor(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 transition text-white placeholder-zinc-600"
                  placeholder="e.g. Navy Blue, Emerald Green"
               />
             </div>
          </div>
        </div>
      </div>

      {/* User Details Section */}
      <div className="bg-zinc-800/30 p-6 rounded-xl border border-zinc-700 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Additional Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 block">Age</label>
            <input 
              type="text" 
              value={userAge}
              onChange={(e) => setUserAge(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition text-white placeholder-zinc-600"
              placeholder="e.g. 25"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 block">Height</label>
            <input 
              type="text" 
              value={userHeight}
              onChange={(e) => setUserHeight(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition text-white placeholder-zinc-600"
              placeholder="e.g. 5'8&quot; or 173cm"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 space-y-3">
        {(!user?.isAdmin && user!.credits < 3) && (
            <div className="text-center text-yellow-500 text-sm mb-2">
                ⚠️ Insufficient credits for 3 styles. Please top up.
            </div>
        )}
        
        {/* Background processing info */}
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3 text-xs text-indigo-300">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium mb-1">Background Generation Enabled</p>
              <p className="text-indigo-400/80">Your device will stay awake during generation. You'll receive a notification when all 3 styles are ready, even if your screen is locked.</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleGenerate}
          className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-900/20 transform transition hover:-translate-y-1 flex justify-center items-center gap-2"
        >
          <span>Generate Lookbook</span>
          {!user?.isAdmin && (
             <span className="bg-black/20 text-xs px-2 py-1 rounded-full">Cost: 3 Credits</span>
          )}
        </button>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center h-64 animate-fade-in text-center">
      <LoadingSpinner message={loadingMessage || "AI Stylist is working..."} />
      <p className="text-zinc-500 mt-4 max-w-md">
        Generating 3 unique variations. <br/>
        <span className="text-xs text-zinc-600">
            {loadingMessage.includes('Refining') 
                ? 'Enhancing facial features (Phase 2/2)' 
                : 'Creating base style (Phase 1/2)'}
        </span>
      </p>
    </div>
  );

  const renderResults = () => {
    const totalStyles = STYLES.length;
    const loadedCount = generatedImages.length;
    const isStillGenerating = isLoading && loadedCount < totalStyles;
    
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            Your Lookbook {isStillGenerating && `(${loadedCount}/${totalStyles})`}
          </h2>
          <button 
            onClick={handleReset}
            className="text-sm text-zinc-400 hover:text-white underline decoration-zinc-600 underline-offset-4"
          >
            Start Over
          </button>
        </div>

        {isStillGenerating && (
          <div className="space-y-3">
            <div className="bg-indigo-900/30 border border-indigo-500/40 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm font-medium text-indigo-300">Generation in Progress</p>
                    <p className="text-xs text-indigo-400/80 mt-0.5">{loadingMessage || "Creating your styles..."}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-indigo-400/60">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span>Device stays awake</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Show generated images */}
          {generatedImages.map((img, idx) => (
            <div key={idx} className="group relative rounded-2xl overflow-hidden bg-zinc-800 shadow-2xl border border-zinc-700/50 animate-fade-in">
              <div className="aspect-[3/4] overflow-hidden">
                 <img src={img.url} alt={img.style} className="w-full h-full object-cover transform transition duration-700 group-hover:scale-105" />
              </div>
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <span className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium border border-white/20">
                  {img.style}
              </span>
              <a 
                href={img.url} 
                download={`try-on-${img.style}.png`}
                className="absolute right-4 bottom-4 p-2 bg-white text-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-200"
                title="Download"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          </div>
        ))}
        
        {/* Show loading placeholders for images still generating */}
        {isStillGenerating && Array.from({ length: totalStyles - loadedCount }).map((_, idx) => (
          <div key={`loading-${idx}`} className="relative rounded-2xl overflow-hidden bg-zinc-800/50 shadow-2xl border border-zinc-700/50 animate-pulse">
            <div className="aspect-[3/4] flex items-center justify-center bg-zinc-900/50">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                <p className="text-zinc-500 text-sm">Generating {STYLES[loadedCount + idx]?.name}...</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30">
      
      {showPayment && (
        <PaymentModal 
          onClose={() => setShowPayment(false)} 
          onSuccess={handlePaymentSuccess} 
        />
      )}

      {showCamera && (
        <CameraCapture 
          onCapture={(base64) => {
            setShowCamera(false);
            if (step === AppStep.UPLOAD_USER) {
              setUserImage(base64);
              processUserImage(base64);
            } else if (step === AppStep.UPLOAD_CLOTH) {
              setClothImage(base64);
              processClothImage(base64);
            }
          }} 
          onCancel={() => setShowCamera(false)}
          defaultCamera={step === AppStep.UPLOAD_CLOTH ? 'environment' : 'user'}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">
              StyleGenie <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full ml-1 font-normal">v2.0 TEST MODE</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
             {/* Credit Display */}
             {user && (
               <div className="bg-zinc-900 rounded-full px-4 py-1.5 border border-zinc-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span className={`text-sm font-bold ${user.isAdmin ? 'text-indigo-400' : 'text-zinc-300'}`}>
                    {user.isAdmin ? 'Unlimited' : `${user.credits} Credits`}
                  </span>
                  {!user.isAdmin && (
                    <button 
                      onClick={() => setShowPayment(true)}
                      className="ml-2 text-xs text-indigo-400 hover:text-white font-semibold"
                    >
                      + ADD
                    </button>
                  )}
               </div>
             )}

             <div className="h-6 w-px bg-zinc-800"></div>

             <button onClick={handleLogout} className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition">
               Reset
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Progress Bar (Only show if not in Results) */}
        {step !== AppStep.RESULTS && (
          <div className="flex justify-center mb-12">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => {
                const isActive = (step as number) >= (s - 1);
                return (
                  <div key={s} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${isActive ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl text-center text-sm animate-fade-in">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {isLoading && step !== AppStep.GENERATING ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner message={loadingMessage || "Analyzing..."} />
          </div>
        ) : (
          <>
            {step === AppStep.UPLOAD_USER && renderUploadUser()}
            {step === AppStep.UPLOAD_CLOTH && renderUploadCloth()}
            {step === AppStep.CONFIRMATION && renderConfirmation()}
            {step === AppStep.GENERATING && renderGenerating()}
            {step === AppStep.RESULTS && renderResults()}
          </>
        )}
      </main>
    </div>
  );
};

export default App;