import React, { useState, useRef, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PaymentModal } from './components/PaymentModal';
import { LoginModal } from './components/LoginModal'; // Added LoginModal
import { AdminDashboard } from './components/AdminDashboard';
import { 
  analyzeUserFace, 
  analyzeClothItem, 
  generateTryOnImage,
  removeFaceFromClothingImage,
  enhanceStylePrompt
} from './services/geminiService';
import { 
  deductCredits, 
  addCredits, 
  getUserHistory, 
  uploadImageToStorage, 
  saveHistoryItem,
  getOrCreateUserProfile, // Added profile creator
  updateUserDetails
} from './services/userService';
import { swapFaceWithReplicate } from './services/replicateService';
import { supabase, signOut } from './services/supabaseClient'; // Added supabase and signOut
import { perfLogger } from './utils/performanceLogger';
import { 
  AppStep, 
  UserAnalysis, 
  ClothAnalysis, 
  STYLES, 
  GenerationStyle,
  User
} from './types';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null); // Default to null (Guest)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const sessionTokenRef = useRef<string | null>(null);

  // Listen for Auth Changes
  useEffect(() => {
    let activeSubscription: any = null;

    const setupAuth = async () => {
      // Check active session
      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        setIsAuthLoading(false);
        return;
      }

      if (initialSession?.user) {
        try {
          const token = initialSession.access_token;
          sessionTokenRef.current = token;
          const metadata = {
            full_name: initialSession.user.user_metadata?.full_name,
            avatar_url: initialSession.user.user_metadata?.avatar_url
          };
          const profile = await getOrCreateUserProfile(initialSession.user.id, initialSession.user.email || '', token, metadata);
          
          if (!profile) {
            console.error("Failed to get/create user profile");
            setIsAuthLoading(false);
            return;
          }
          
          setUser(profile);

          // Fetch History
          getUserHistory(initialSession.user.id).then(items => setHistory(items));
          
          // 1. Try to restore redirect state
          const savedState = sessionStorage.getItem('styleGenie_redirect_state');
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState);
              if (parsed.step !== undefined) setStep(parsed.step);
              if (parsed.userAge) setUserAge(parsed.userAge);
              if (parsed.userHeight) setUserHeight(parsed.userHeight);
              if (parsed.userWeight) setUserWeight(parsed.userWeight);
              if (parsed.manualClothType) setManualClothType(parsed.manualClothType);
              if (parsed.manualColor) setManualColor(parsed.manualColor);
              sessionStorage.removeItem('styleGenie_redirect_state');
            } catch (e) { console.error("Failed to restore state", e); }
          } 
          // 2. If no redirect state, pre-fill from profile
          else if (profile) {
            if (profile.age) setUserAge(profile.age);
            if (profile.height) setUserHeight(profile.height);
            if (profile.weight) setUserWeight(profile.weight);
          }

          activeSubscription = subscribeToSessionChanges(initialSession.user.id);
        } catch (error) {
          console.error("Error setting up auth:", error);
        }
      }
      
      // If we have a hash that looks like a redirect, keep loading state true
      // and let onAuthStateChange handle the finalization to avoid flicker/race conditions
      if (!initialSession && window.location.hash && window.location.hash.includes('access_token')) {
        console.log("Detected auth redirect hash, waiting for auth event...");
        return; 
      }
      
      setIsAuthLoading(false);
    };

    setupAuth();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.email);
      
      // Cleanup old subscription if user changed
      if (activeSubscription) {
        supabase.removeChannel(activeSubscription);
        activeSubscription = null;
      }

      if (session?.user) {
        try {
          const token = session.access_token;
          sessionTokenRef.current = token;
          const metadata = {
            full_name: session.user.user_metadata?.full_name,
            avatar_url: session.user.user_metadata?.avatar_url
          };
          const profile = await getOrCreateUserProfile(session.user.id, session.user.email || '', token, metadata);
          
          if (!profile) {
            console.error("Failed to get/create profile on auth change");
            setUser(null);
            setIsAuthLoading(false);
            return;
          }
          
          setUser(profile);
          
          // Clean up URL hash if it's an auth redirect
          if (window.location.hash && window.location.hash.includes('access_token')) {
             window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }

          // Fetch History
          getUserHistory(session.user.id).then(items => setHistory(items));
          
          // Restore redirect state if pending (and not handled by setupAuth)
          const savedState = sessionStorage.getItem('styleGenie_redirect_state');
          if (savedState) {
             try {
              const parsed = JSON.parse(savedState);
              if (parsed.step !== undefined) setStep(parsed.step);
              if (parsed.userAge) setUserAge(parsed.userAge);
              if (parsed.userHeight) setUserHeight(parsed.userHeight);
              if (parsed.userWeight) setUserWeight(parsed.userWeight);
              if (parsed.manualClothType) setManualClothType(parsed.manualClothType);
              if (parsed.manualColor) setManualColor(parsed.manualColor);
              sessionStorage.removeItem('styleGenie_redirect_state');
             } catch(e) { console.error("Failed to restore state:", e); }
          } else if (profile) {
            // Only fill if empty to avoid overwriting
            setUserAge(prev => prev || profile.age || '');
            setUserHeight(prev => prev || profile.height || '');
            setUserWeight(prev => prev || profile.weight || '');
          }
          
          // Start listening for session changes
          activeSubscription = subscribeToSessionChanges(session.user.id);
        } catch (error) {
          console.error("Error in auth state change:", error);
          setUser(null);
        }
      } else {
        // User signed out
        setUser(null);
        sessionTokenRef.current = null;
        // Clear fields on logout
        setUserAge('');
        setUserHeight('');
        setUserWeight('');
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (activeSubscription) supabase.removeChannel(activeSubscription);
    };
  }, []);

  const subscribeToSessionChanges = (userId: string) => {
    const channel = supabase
      .channel(`session-check-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const newSessionId = payload.new.last_session_id;
          const currentToken = sessionTokenRef.current;
          
          if (newSessionId && currentToken && newSessionId !== currentToken) {
             // Detected a new session elsewhere
             alert("You have been logged out because a new session was started on another device.");
             handleSignOut();
          }
        }
      )
      .subscribe();
      
    return channel;
  };

  const handleLoginStart = () => {
    // Save critical state before redirect
    const stateToSave = {
      step,
      userAge,
      userHeight,
      userWeight,
      manualClothType,
      manualColor
    };
    sessionStorage.setItem('styleGenie_redirect_state', JSON.stringify(stateToSave));
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error("Sign out error:", error);
      }
      // Clear all state
      setUser(null);
      sessionTokenRef.current = null;
      setStep(AppStep.UPLOAD_USER);
      setHistory([]);
      setUserAge('');
      setUserHeight('');
      setUserWeight('');
      setUserImage(null);
      setClothImage(null);
      setUserAnalysis(null);
      setClothAnalysis(null);
      setGeneratedImages([]);
      // Clear any saved redirect state
      sessionStorage.removeItem('styleGenie_redirect_state');
      // Don't force reload - let Supabase auth state change handle it
    } catch (err) {
      console.error("Sign out failed:", err);
      // Still clear local state even if API call fails
      setUser(null);
      sessionTokenRef.current = null;
      setStep(AppStep.UPLOAD_USER);
    }
  };

  // Protected Action Handler
  const requireAuth = (action: () => void) => {
    if (user) {
      action();
    } else {
      setShowLoginModal(true);
    }
  };
  
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
  const [customPromptText, setCustomPromptText] = useState<string>('');
  
  // User details
  const [userAge, setUserAge] = useState<string>('');
  const [userHeight, setUserHeight] = useState<string>('');
  const [userWeight, setUserWeight] = useState<string>(''); // Added Weight State

  const [generatedImages, setGeneratedImages] = useState<{style: string, url: string, status?: string}[]>([]);
  const [loadedCount, setLoadedCount] = useState(0); // Track loaded count
  const [isStillGenerating, setIsStillGenerating] = useState(false); // Track generation status
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [processStage, setProcessStage] = useState<string>(""); // "generating" | "swapping"
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [qualityMode, setQualityMode] = useState<'fast' | 'quality'>('fast'); // Default to fast
  const [selectedImage, setSelectedImage] = useState<{url: string, style: string} | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // History State
  const [history, setHistory] = useState<{url: string, style: string, date: string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showWaitModal, setShowWaitModal] = useState(false);
  
  // UI State
  const [showCamera, setShowCamera] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Wake Lock for preventing device sleep during generation
  const wakeLockRef = useRef<any>(null);

  // Load history from Supabase on mount (if user exists)
  useEffect(() => {
    const loadHistory = async () => {
      if (user?.id) {
        const remoteHistory = await getUserHistory(user.id);
        if (remoteHistory && remoteHistory.length > 0) {
          setHistory(remoteHistory);
        } else {
          // Fallback to local storage if no remote history (or offline)
          const savedHistory = localStorage.getItem('styleGenieHistory');
          if (savedHistory) {
            try {
              setHistory(JSON.parse(savedHistory));
            } catch (e) { console.error(e); }
          }
        }
      }
    };
    loadHistory();
  }, [user?.id]);

  // Save history helper (Supabase + Local Fallback)
  const addToHistory = async (newImage: {url: string, style: string}) => {
    // 1. Optimistic Update (Temporary)
    const tempItem = { ...newImage, date: new Date().toISOString() };
    setHistory(prev => [tempItem, ...prev].slice(0, 20)); // Keep last 20 in UI

    // 2. Persist to Supabase (Background)
    if (user?.id) {
      try {
        // Upload image to storage
        const publicUrl = await uploadImageToStorage(user.id, newImage.url);
        
        if (publicUrl) {
          // Save metadata to DB
          await saveHistoryItem(user.id, publicUrl, newImage.style);
          
          // Update state with permanent URL
          setHistory(prev => prev.map(item => 
            item.url === newImage.url ? { ...item, url: publicUrl } : item
          ));
        }
      } catch (err) {
        console.error("Failed to save history to Supabase", err);
        // Fallback to local storage
        const savedHistory = localStorage.getItem('styleGenieHistory');
        const current = savedHistory ? JSON.parse(savedHistory) : [];
        const updated = [tempItem, ...current].slice(0, 5);
        localStorage.setItem('styleGenieHistory', JSON.stringify(updated));
      }
    }
  };

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
    
    // Check URL for history view
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'history') {
      setShowHistory(true);
    }
    
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
    // Play notification sound
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log("Audio play failed", e));
    } catch (e) {
      console.log("Audio setup failed", e);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('StyleGenie - Generation Complete! 🎉', {
        body: 'Your lookbook is ready! Click to view your 3 amazing styles.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'generation-complete',
        requireInteraction: true,
        data: { url: window.location.origin + '?view=history' }
      });
      
      notification.onclick = function(event) {
        event.preventDefault(); // prevent the browser from focusing the Notification's tab
        window.open(window.location.origin + '?view=history', '_self');
        notification.close();
      };
    }
  };

  // Helper function to force download
  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback to opening in new tab
      window.open(url, '_blank');
    }
  };

  // --- Handlers ---

  const handlePaymentSuccess = async (addedCredits: number) => {
    if (!user) return;
    try {
      // Mock DB update for test user
      if (user.id === 'test-guest-id') {
         setUser({ ...user, credits: user.credits + addedCredits });
      } else {
         // Real DB update (won't run in test mode)
         const newBalance = await addCredits(user.id, user.credits, addedCredits);
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
    perfLogger.start('User Image Analysis');
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
      perfLogger.end('User Image Analysis');
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
    perfLogger.start('Cloth Image Analysis');
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
      perfLogger.end('Cloth Image Analysis');
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const startGenerationFlow = () => {
    if (!userImage || !clothImage || !userAnalysis) return;
    
    // Require Auth for Generation
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const AUTO_GEN_COST = qualityMode === 'quality' ? 4 : 2; // 2 photos * cost per photo
    if (!user.isAdmin && user.credits < AUTO_GEN_COST) {
      setShowPayment(true);
      return;
    }
    setShowWaitModal(true);
  };

  const handleGenerate = async (backgroundMode: boolean = false) => {
    if (!userImage || !clothImage || !userAnalysis || !user) return;

    setShowWaitModal(false);
    
    if (backgroundMode && 'Notification' in window) {
      Notification.requestPermission();
    }

    const AUTO_GEN_COST = qualityMode === 'quality' ? 4 : 2; // 2 photos * cost per photo
    if (!user.isAdmin && user.credits < AUTO_GEN_COST) {
      setShowPayment(true);
      return;
    }
    
    perfLogger.start('Total Generation Flow');
    setStep(AppStep.RESULTS); // Move to results immediately
    setIsLoading(true);
    setIsStillGenerating(true);
    setLoadingMessage("Initializing Stylist...");
    setError(null);
    setGeneratedImages(Array(STYLES.length).fill(null).map((_, idx) => ({
      style: STYLES[idx].name,
      url: '',
      status: idx < 2 ? 'pending' : 'locked' // First 2 pending, rest locked
    })));
    setLoadedCount(0);
    setCurrentProcessingIndex(0);
    setProgressPercent(0);

    // Activate wake lock to prevent device from sleeping
    await requestWakeLock();

    // Build user description with age, height, weight, and hair details
    let userDesc = `${userAnalysis.gender} person, ${userAnalysis.description}`;
    if (userAge) userDesc += `, age ${userAge}`;
    if (userHeight) userDesc += `, height ${userHeight}`;
    if (userWeight) userDesc += `, weight ${userWeight}`;
    
    // Add hair details if available
    if (userAnalysis.hairStyle) userDesc += `, Hair: ${userAnalysis.hairStyle}, ${userAnalysis.hairColor}, ${userAnalysis.hairLength}`;

    const finalClothType = manualClothType || clothAnalysis?.clothingType || "clothing";
    const finalColor = manualColor || clothAnalysis?.color || "multi-colored";
    
    // Add detailed cloth analysis
    let clothDesc = `${finalClothType}, ${finalColor}, ${clothAnalysis?.pattern}`;
    if (clothAnalysis?.texture) clothDesc += `, Material: ${clothAnalysis.texture}`;
    if (clothAnalysis?.fit) clothDesc += `, Fit: ${clothAnalysis.fit}`;
    if (clothAnalysis?.neckline) clothDesc += `, Neckline: ${clothAnalysis.neckline}`;
    if (clothAnalysis?.sleeveLength) clothDesc += `, Sleeves: ${clothAnalysis.sleeveLength}`;

    try {
      // Save user details
      if (user && (userAge || userHeight || userWeight)) {
         updateUserDetails(user.id, { 
            age: userAge, 
            height: userHeight, 
            weight: userWeight 
         }).catch(console.error);
      }

      // Deduct credits upfront for the first 2 photos
      const AUTO_GEN_COST = qualityMode === 'quality' ? 4 : 2; // 2 photos * cost per photo
      
      if (!user.isAdmin) {
         if (user.id === 'test-guest-id') {
           // Mock deduction for testing
           setUser({ ...user, credits: user.credits - AUTO_GEN_COST });
         } else {
           // Real DB deduction
           const newBalance = await deductCredits(user.id, user.credits, AUTO_GEN_COST);
           setUser({ ...user, credits: newBalance });
         }
      }
      
      // Pipelined Generation
      // We maintain an array of promises for Replicate tasks to ensure we don't block Gemini loop
      const replicateTasks: Promise<void>[] = [];

      // Only generate the first 2 styles automatically
      for (let index = 0; index < 2; index++) {
        const style = STYLES[index];
        
        // Update UI to show we are working on this style (and potential background work on others)
        setCurrentProcessingIndex(index);
        setProcessStage("generating"); // Phase 1 starts
        setProgressPercent(10); // Started

        try {
          // 1. Gemini Step (Blocking - we wait for this to keep order and rate limits safe)
          setLoadingMessage(`Creating base style for ${style.name}...`);
          perfLogger.start(`Gemini Gen Style ${index + 1}`);
          
          const generatedImage = await generateTryOnImage(
          userImage, 
          clothImage, 
          userDesc, 
          clothDesc, 
          style.promptSuffix,
            (msg) => {}, // No verbose logs to avoid flicker
            clothAnalysis?.hasFaceInImage || false,
            qualityMode // Pass selected quality mode
          );
          perfLogger.end(`Gemini Gen Style ${index + 1}`);
          
          // 2. Trigger Replicate Step (Non-blocking for next loop iteration, but tracked for UI)
          // We start the Replicate process but DO NOT await it here.
          // Instead, we attach a "then" handler to update the UI when it finishes later.
          
          // Initial state for this image: "Generating" done, "Swapping" started
          setGeneratedImages(prev => {
             const newImages = [...prev];
             // Store the Gemini image first (so user sees something immediately)
             newImages[index] = { style: style.name, url: generatedImage, status: 'swapping' }; 
             return newImages;
          });
          
          // Increment count so the next placeholder shows "Waiting" or "Generating" correctly
          setLoadedCount(prev => Math.max(prev, index + 1));

          const replicateTask = (async () => {
            const taskId = `Replicate Swap Style ${index + 1}`;
            perfLogger.start(taskId);
            try {
               // This runs in background
               const finalImage = await swapFaceWithReplicate(userImage, generatedImage);
               perfLogger.end(taskId);
               
               // Update UI with final image
               setGeneratedImages(prev => {
                 const newImages = [...prev];
                 newImages[index] = { style: style.name, url: finalImage, status: 'done' };
                 return newImages;
               });
               
               // Save to history
               addToHistory({ url: finalImage, style: style.name });
            } catch (swapError) {
               console.error(`Face swap failed for ${style.name} (background)`, swapError);
               // Keep the Gemini image if swap fails
               setGeneratedImages(prev => {
                 const newImages = [...prev];
                 newImages[index] = { style: style.name, url: generatedImage, status: 'done_with_error' };
                 return newImages;
               });
            }
          })();
          
          replicateTasks.push(replicateTask);

        } catch (err) {
          console.error(`Failed to generate ${style.name}:`, err);
          // Mark as failed
          setGeneratedImages(prev => {
             const newImages = [...prev];
             newImages[index] = { style: style.name, url: '', status: 'failed' };
             return newImages;
          });
          setLoadedCount(prev => Math.max(prev, index + 1));
        }
      }

      // Wait for all background Replicate tasks to finish before declaring "Complete"
      setLoadingMessage("Finalizing all images...");
      await Promise.all(replicateTasks);
      
      // Send notification when all images are complete
      sendCompletionNotification();
      
    } catch (err) {
      setError("Generation failed. The model might be busy or the request invalid. Try again.");
      setStep(AppStep.CONFIRMATION);
    } finally {
      perfLogger.end('Total Generation Flow');
      setIsLoading(false);
      setIsStillGenerating(false);
      setCurrentProcessingIndex(-1);
      setLoadingMessage("");
      
      // Release wake lock when generation is complete
      await releaseWakeLock();
    }
  };

  const handleRegenerate = async (index: number) => {
    if (!userImage || !clothImage || !userAnalysis || index < 0 || index >= STYLES.length) return;

    // Require Auth
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    
    // 2. We'll assume 1 credit for Fast, 2 for Quality (as discussed in plan, though not strictly enforced yet in code, let's add basic check)
    const cost = qualityMode === 'quality' ? 2 : 1;
    
    const style = STYLES[index];
    const styleName = style.name;

    requireAuth(async () => {
      // Check for custom creation prompt
      if (styleName === "Custom Creation" && !customPromptText.trim()) {
        alert("Please enter a description for your custom style.");
        return;
      }
      
      // If it's a regeneration (already done/failed) OR an unlock (undefined status)
      // We should check credits.
      if (user && !user.isAdmin && user.credits < cost) {
          setShowPayment(true);
          return;
      }

      // Deduct credits if not admin
      if (user && !user.isAdmin) {
         try {
           if (user.id === 'test-guest-id') {
              setUser({ ...user, credits: user.credits - cost });
           } else {
              const newBalance = await deductCredits(user.id, user.credits, cost);
              setUser({ ...user, credits: newBalance });
           }
         } catch (e) {
           console.error("Credit deduction failed", e);
           return;
         }
      }
      
      // Update status to regenerating
      setGeneratedImages(prev => {
        const newImages = [...prev];
        // Ensure the array is large enough
        if (!newImages[index]) {
           newImages[index] = { style: styleName, url: '', status: 'regenerating' };
        } else {
           newImages[index] = { ...newImages[index], status: 'regenerating' };
        }
        return newImages;
      });

      // Build descriptions again (in case state changed, though likely same)
      let userDesc = `${userAnalysis.gender} person, ${userAnalysis.description}`;
      if (userAge) userDesc += `, age ${userAge}`;
      if (userHeight) userDesc += `, height ${userHeight}`;
      if (userWeight) userDesc += `, weight ${userWeight}`;
      if (userAnalysis.hairStyle) userDesc += `, Hair: ${userAnalysis.hairStyle}, ${userAnalysis.hairColor}, ${userAnalysis.hairLength}`;

      const finalClothType = manualClothType || clothAnalysis?.clothingType || "clothing";
      const finalColor = manualColor || clothAnalysis?.color || "multi-colored";
      let clothDesc = `${finalClothType}, ${finalColor}, ${clothAnalysis?.pattern}`;
      if (clothAnalysis?.texture) clothDesc += `, Material: ${clothAnalysis.texture}`;
      if (clothAnalysis?.fit) clothDesc += `, Fit: ${clothAnalysis.fit}`;
      if (clothAnalysis?.neckline) clothDesc += `, Neckline: ${clothAnalysis.neckline}`;
      if (clothAnalysis?.sleeveLength) clothDesc += `, Sleeves: ${clothAnalysis.sleeveLength}`;

      try {
        // Determine prompt suffix
        let finalPromptSuffix = style.promptSuffix;
        
        // If custom, enhance the prompt first
        if (styleName === "Custom Creation") {
          finalPromptSuffix = await enhanceStylePrompt(customPromptText);
        }

        // 1. Gemini Step
        const generatedImage = await generateTryOnImage(
          userImage, 
          clothImage, 
          userDesc, 
          clothDesc, 
          finalPromptSuffix, // Use the enhanced prompt
          (msg) => {}, 
          clothAnalysis?.hasFaceInImage || false,
          qualityMode
        );

        // Update to swapping state
        setGeneratedImages(prev => {
          const newImages = [...prev];
          newImages[index] = { style: styleName, url: generatedImage, status: 'swapping' };
          return newImages;
        });

        // 2. Replicate Step
        const finalImage = await swapFaceWithReplicate(userImage, generatedImage);

        // Success
        setGeneratedImages(prev => {
          const newImages = [...prev];
          newImages[index] = { style: styleName, url: finalImage, status: 'done' };
          return newImages;
        });
        
        // Save to history
        if (user) {
          addToHistory({ url: finalImage, style: styleName });
        }

      } catch (err) {
        console.error(`Regeneration failed for ${styleName}:`, err);
        setGeneratedImages(prev => {
          const newImages = [...prev];
          newImages[index] = { style: styleName, url: '', status: 'failed' };
          return newImages;
        });
      }
    });
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
    setUserWeight('');
    setCurrentProcessingIndex(-1);
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
        
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3 mb-6 text-xs text-indigo-300 text-left">
          <p className="font-bold mb-1">💡 Tip for Best Results:</p>
          <p>Please upload high-quality, clear photos of your face and the clothing. The AI result depends heavily on the clarity and lighting of your uploaded pictures.</p>
        </div>
        
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

      <div className="flex justify-center">
        <button 
          onClick={() => setStep(AppStep.UPLOAD_USER)}
          className="text-sm text-zinc-500 hover:text-zinc-300 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-zinc-900 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Face Upload
        </button>
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

      {/* User Details Section with Weight & Quality */}
      <div className="bg-zinc-800/30 p-6 rounded-xl border border-zinc-700 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Additional Details</h3>
        <div className="grid grid-cols-3 gap-4">
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
              placeholder="e.g. 5'8"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 block">Weight</label>
            <input 
              type="text" 
              value={userWeight}
              onChange={(e) => setUserWeight(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition text-white placeholder-zinc-600"
              placeholder="e.g. 60 kg"
            />
          </div>
        </div>
        
        {/* Quality Selection */}
        <div className="pt-4 border-t border-zinc-700/50">
          <div className="flex items-start gap-3">
            <div className="flex items-center h-5">
              <input
                id="quality-mode"
                type="checkbox"
                checked={qualityMode === 'quality'}
                onChange={(e) => setQualityMode(e.target.checked ? 'quality' : 'fast')}
                className="w-4 h-4 text-indigo-600 bg-zinc-900 border-zinc-600 rounded focus:ring-indigo-500 focus:ring-2"
              />
            </div>
            <div className="text-sm">
              <label htmlFor="quality-mode" className="font-medium text-zinc-300 cursor-pointer">High Quality Mode</label>
              <p className="text-zinc-500 text-xs mt-1">
                {qualityMode === 'quality' 
                  ? "⚠️ Uses Gemini 3 Pro (Slower). Takes 2-3 minutes per photo but produces higher detail."
                  : "⚡ Uses Gemini 2.5 Flash (Fast). Generates quickly but with less detail."}
              </p>
             </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 space-y-3">
        {(user && !user.isAdmin && user.credits < 3) && (
            <div className="text-center text-yellow-500 text-sm mb-2">
                ⚠️ Insufficient credits. Please top up.
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
        
        <div className="flex gap-4">
        <button 
            onClick={() => setStep(AppStep.UPLOAD_CLOTH)}
            className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-zinc-700 transition border border-zinc-700"
          >
            Back
          </button>
          <button 
            onClick={startGenerationFlow}
            className="flex-[2] bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-900/20 transform transition hover:-translate-y-1 flex justify-center items-center gap-2"
        >
          <span>Generate Lookbook</span>
          {!user?.isAdmin && (
             <span className="bg-black/20 text-xs px-2 py-1 rounded-full">Cost: 3 Credits</span>
          )}
        </button>
        </div>
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
          {/* We render ALL styles, but some might be empty/locked */}
          {STYLES.map((style, idx) => {
             const img = generatedImages[idx];
             const isGenerated = !!img;
             
             // Status flags
             const isSwapping = img?.status === 'swapping';
             const isRegenerating = img?.status === 'regenerating';
             const isFailed = img?.status === 'failed';
             const isDoneWithError = img?.status === 'done_with_error';
             const isDone = img?.status === 'done';
             const isLocked = img?.status === 'locked';
             const isPending = img?.status === 'pending'; // Added pending check
             
             // Show regenerate button if failed, done with error, or even if done (user option)
             // But prominently for failures
             const showRegenerate = isFailed || isDoneWithError || isDone;

             return (
            <div 
              key={idx} 
              className={`group relative rounded-2xl overflow-hidden bg-zinc-800 shadow-2xl border transition-all ${isLocked ? 'border-zinc-800 hover:border-indigo-500/50' : 'border-zinc-700/50 hover:ring-2 hover:ring-indigo-500'}`}
              onClick={() => isDone && setSelectedImage({url: img.url, style: style.name})}
            >
              <div className="aspect-[3/4] overflow-hidden relative bg-zinc-900">
                 {isLocked ? (
                    // LOCKED STATE
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/80 backdrop-blur-sm">
                       {style.name === "Custom Creation" ? (
                         <div className="w-full flex flex-col items-center h-full justify-between">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-2 shadow-lg">
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
            </div>
                            <h4 className="text-white font-bold text-sm mb-2">Custom Creation</h4>
                            
                            <textarea 
                              className="w-full flex-1 bg-zinc-950/50 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-300 placeholder-zinc-600 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
                              placeholder="e.g., I want my photo at Mumbai Marine Drive with a Mercedes Benz C-Class..."
                              value={customPromptText}
                              onChange={(e) => setCustomPromptText(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            
                            <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleRegenerate(idx);
                               }}
                               className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:from-indigo-500 hover:to-purple-500 transition shadow-lg flex items-center justify-center gap-1"
                             >
                               <span>Enhance & Generate</span>
                               <span className="bg-black/20 px-1.5 rounded text-[9px]">{qualityMode === 'quality' ? '2' : '1'} Cr</span>
                             </button>
                         </div>
                       ) : (
                         <>
                           <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 border border-zinc-700 group-hover:border-indigo-500 transition-colors">
                             <svg className="w-6 h-6 text-zinc-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                             </svg>
                           </div>
                           <h4 className="text-white font-bold text-sm mb-1">{style.name}</h4>
                           <p className="text-xs text-zinc-400 mb-4 line-clamp-2">{style.synopsis}</p>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleRegenerate(idx);
                             }}
                             className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold hover:bg-indigo-500 hover:text-white transition shadow-lg flex items-center gap-1"
                           >
                             <span>Generate</span>
                             <span className="bg-black/10 px-1.5 rounded text-[10px]">{qualityMode === 'quality' ? '2' : '1'} Cr</span>
                           </button>
                         </>
                       )}
                    </div>
                 ) : (
                   // GENERATED / PROCESSING STATE
                   <>
                     {img.url && !isRegenerating ? (
                       <>
                       <img src={img.url} alt={style.name} className={`w-full h-full object-cover transform transition duration-700 ${isSwapping ? 'blur-sm scale-105' : 'group-hover:scale-105'}`} />
                       {isSwapping && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                           <div className="text-center">
                             <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                             <p className="text-xs text-white font-medium shadow-black drop-shadow-md">Refining Face...</p>
                           </div>
                         </div>
                       )}
                       </>
                     ) : (
                       <div className="flex items-center justify-center h-full bg-zinc-900 relative">
                         {isRegenerating || isPending ? (
                            <div className="text-center">
                              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                              <p className="text-xs text-indigo-400 font-medium">
                                {isPending ? 'Waiting...' : 'Generating...'}
                              </p>
                            </div>
                         ) : (
                            <div className="flex flex-col items-center text-red-400">
                              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="text-xs">Generation Failed</span>
                            </div>
                         )}
                       </div>
                     )}
                   </>
                 )}
              </div>
              
              {!isLocked && (
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
                <div className="flex flex-col gap-1">
                  <span className="inline-block self-start px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium border border-white/20">
                    {style.name}
              </span>
                  {style.synopsis && (
                    <p className="text-[10px] text-zinc-300 leading-tight line-clamp-2">
                      {style.synopsis}
                    </p>
                  )}
                </div>
              </div>
              )}
              
              {/* Action Buttons */}
              {!isLocked && (
              <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                  {/* Download Button */}
                  {img?.url && !isSwapping && !isRegenerating && !isFailed && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(img.url, `try-on-${style.name}.png`);
                      }}
                      className="p-2 bg-white text-black rounded-full shadow-lg hover:bg-zinc-200 transition-all"
                title="Download"
              >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                    </button>
                  )}
                  
                  {/* Regenerate Button */}
                  {showRegenerate && !isSwapping && !isRegenerating && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate(idx);
                      }}
                      className={`p-2 rounded-full shadow-lg transition-all ${isFailed ? 'bg-indigo-600 text-white hover:bg-indigo-500 animate-pulse' : 'bg-black/50 text-white hover:bg-black/80 backdrop-blur-md'}`}
                      title="Regenerate"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
            </div>
              )}
              
              {/* Explicit Regenerate Button for Failed State */}
              {isFailed && !isRegenerating && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate(idx);
                      }}
                      className="pointer-events-auto bg-indigo-600 text-white px-4 py-2 rounded-full font-semibold shadow-xl hover:bg-indigo-500 transition transform hover:scale-105 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
          </div>
              )}
            </div>
          )})}
          
          {/* Loading Placeholders (Only for the first 2 if generating) */}
          {isStillGenerating && Array.from({ length: 2 - loadedCount }).map((_, idx) => {
             // Only show placeholders if we haven't loaded the first 2 yet
             if (loadedCount >= 2) return null;
             
             const actualIndex = loadedCount + idx;
             if (actualIndex >= 2) return null; // Just in case

             const isCurrent = actualIndex === currentProcessingIndex;
             const styleName = STYLES[actualIndex]?.name;

             return (
              <div key={`loading-${idx}`} className={`relative rounded-2xl overflow-hidden bg-zinc-800/50 shadow-2xl border ${isCurrent ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-zinc-700/50'} animate-pulse`}>
                <div className="aspect-[3/4] flex items-center justify-center bg-zinc-900/50 relative">
                  {isCurrent ? (
                    <div className="text-center space-y-4 w-full px-6">
                      <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                      
                      <div>
                        <p className="text-white font-medium text-sm mb-1">{styleName}</p>
                        <p className="text-indigo-400 text-xs mb-3">
                          {processStage === 'generating' ? 'Creating style...' : 'Refining face...'}
                        </p>
                        
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="text-zinc-500 text-[10px] mt-1 text-right">{progressPercent}%</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 opacity-50">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center">
                        <span className="text-zinc-500 text-xs font-bold">{idx + 1}</span>
                      </div>
                      <p className="text-zinc-600 text-xs">Waiting...</p>
                    </div>
                  )}
      </div>
    </div>
  );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30">
      
      {/* Detail View Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
            <div className="absolute top-4 right-4 z-10 flex gap-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(selectedImage.url, `try-on-${selectedImage.style}.png`);
                }}
                className="bg-white text-black px-6 py-2 rounded-full font-semibold hover:bg-zinc-200 transition flex items-center gap-2 shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button 
                onClick={() => setSelectedImage(null)}
                className="bg-black/50 text-white p-3 rounded-full hover:bg-black/80 transition border border-white/20 shadow-xl backdrop-blur-md"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.style} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
              />
            </div>
            <div className="mt-4 text-center">
              <h3 className="text-xl font-bold text-white">{selectedImage.style}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Navigation</p>
              <button onClick={() => {setStep(AppStep.UPLOAD_USER); setIsSidebarOpen(false);}} className="block w-full text-left text-zinc-300 hover:text-white py-2">Start New Look</button>
              {user && (
                <button onClick={() => { setShowHistory(true); setIsSidebarOpen(false); }} className="block w-full text-left text-zinc-300 hover:text-white py-2">My History</button>
              )}
            </div>
            
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Settings</p>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">High Quality</span>
                <div 
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${qualityMode === 'quality' ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                  onClick={() => setQualityMode(prev => prev === 'fast' ? 'quality' : 'fast')}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${qualityMode === 'quality' ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
              {user?.isAdmin && (
                <button onClick={() => { setShowAdminDashboard(true); setIsSidebarOpen(false); }} className="block w-full text-left text-indigo-400 hover:text-indigo-300 py-2 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Performance Dashboard
                </button>
              )}
              {user && (
                <button onClick={() => { handleSignOut(); setIsSidebarOpen(false); }} className="block w-full text-left text-red-400 hover:text-red-300 py-2">Sign Out</button>
              )}
            </div>
          </div>
          
          <div className="absolute bottom-6 left-6 right-6">
            {user ? (
              <div className="bg-zinc-800 p-4 rounded-xl">
                <p className="text-xs text-zinc-400 mb-2">Credits Balance</p>
                <p className="text-xl font-bold text-white">{user.credits}</p>
                <button onClick={() => {setShowPayment(true); setIsSidebarOpen(false);}} className="mt-3 w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-500">Top Up</button>
              </div>
            ) : (
              <div className="bg-zinc-800 p-4 rounded-xl text-center">
                <p className="text-sm text-zinc-300 mb-3">Sign in to save your styles and get 10 free credits!</p>
                <button onClick={() => {setShowLoginModal(true); setIsSidebarOpen(false);}} className="w-full bg-white text-black text-xs font-bold py-2 rounded-lg hover:bg-zinc-200">Sign In</button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Overlay for sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {showPayment && (
        <PaymentModal 
          onClose={() => setShowPayment(false)} 
          onSuccess={handlePaymentSuccess} 
        />
      )}

      {/* Wait Option Modal */}
      {showWaitModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Start Generation?</h3>
              <p className="text-zinc-400 text-sm">
                Creating your custom high-quality lookbook typically takes <span className="text-white font-bold">2-5 minutes</span>.
              </p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => handleGenerate(false)}
                className="w-full bg-zinc-800 text-white py-3 rounded-xl font-semibold hover:bg-zinc-700 transition border border-zinc-700"
              >
                I'll Wait Here
              </button>
              <button 
                onClick={() => handleGenerate(true)}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-lg shadow-indigo-500/20"
              >
                Notify Me When Done
              </button>
            </div>
            <button onClick={() => setShowWaitModal(false)} className="text-xs text-zinc-500 hover:text-zinc-300 underline">Cancel</button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">My History</h2>
              <button onClick={() => setShowHistory(false)} className="text-zinc-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {history.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <p>No saved looks yet.</p>
                  <p className="text-sm mt-1">Generate some photos to see them here!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {history.map((item, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden bg-zinc-800 aspect-[3/4]">
                      <img src={item.url} alt={item.style} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                        <p className="text-xs text-white font-medium">{item.style}</p>
                        <button 
                          onClick={() => downloadImage(item.url, `history-${idx}.png`)}
                          className="bg-white text-black p-2 rounded-full hover:bg-zinc-200"
                          title="Download"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 text-center text-xs text-zinc-500">
                Auto-saves last 5 generated styles
              </div>
            </div>
          </div>
        </div>
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

      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onLoginStart={handleLoginStart} />
      )}

      {showAdminDashboard && (
        <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">
                StyleGenie <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full ml-1 font-normal">v2.0</span>
            </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Auth & Credit Display */}
             {user ? (
               <>
                 <div className="bg-zinc-900 rounded-full px-4 py-1.5 border border-zinc-800 flex items-center gap-2 cursor-pointer hover:bg-zinc-800 transition" onClick={() => setShowHistory(true)}>
                    {user.avatar ? (
                      <img src={user.avatar} alt="User" className="w-6 h-6 rounded-full object-cover border border-zinc-700" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
                        {user.name ? user.name[0].toUpperCase() : (user.email?.[0].toUpperCase() || 'U')}
                      </span>
                    )}
                    {user.name && (
                      <span className="text-xs text-zinc-400 font-medium hidden sm:block">
                        {user.name.split(' ')[0]}
                      </span>
                    )}
                  <span className={`text-sm font-bold ${user.isAdmin ? 'text-indigo-400' : 'text-zinc-300'}`}>
                      {user.isAdmin ? 'Unlimited' : `${user.credits} Cr`}
                  </span>
                  {!user.isAdmin && (
                    <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPayment(true);
                        }}
                      className="ml-2 text-xs text-indigo-400 hover:text-white font-semibold"
                    >
                        +
                    </button>
                  )}
               </div>
             <div className="h-6 w-px bg-zinc-800"></div>
                 <button onClick={handleReset} className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition">
                   New
             </button>
               </>
             ) : (
               <button 
                 onClick={() => setShowLoginModal(true)}
                 className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-zinc-200 transition"
               >
                 Sign In
               </button>
             )}
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

        {isLoading && step !== AppStep.GENERATING && step !== AppStep.RESULTS ? (
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