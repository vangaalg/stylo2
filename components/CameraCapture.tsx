import React, { useRef, useState, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
  defaultCamera?: 'user' | 'environment';
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel, defaultCamera = 'user' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultCamera);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        let mediaStream: MediaStream;
        try {
           // Try with specified facing mode
           mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode }, 
            audio: false 
          });
        } catch (firstError) {
           console.warn("Preferred camera settings failed, trying generic fallback...", firstError);
           // Fallback to any available video source
           mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
        }

        if (!isMounted) {
            // Component unmounted while waiting for permission
            mediaStream.getTracks().forEach(track => track.stop());
            return;
        }

        currentStream = mediaStream;
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        if (isMounted) {
          setError("Unable to access camera. Please check if a camera is connected and permissions are allowed.");
          console.error("Camera initialization failed:", err);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Match canvas size to video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        // Cleanup is handled by useEffect unmount when parent removes this component
        onCapture(dataUrl);
      }
    }
  };

  const handleSwitchCamera = () => {
    // Stop current stream before switching
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    // Toggle between front and rear camera
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      {error ? (
        <div className="bg-zinc-900 p-6 rounded-2xl max-w-sm text-center border border-zinc-800">
             <div className="w-12 h-12 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                 </svg>
             </div>
            <p className="text-red-400 mb-6">{error}</p>
            <button 
              onClick={onCancel}
              className="bg-zinc-800 text-white px-6 py-2 rounded-lg hover:bg-zinc-700 transition w-full"
            >
              Close
            </button>
        </div>
      ) : (
        <div className="relative w-full max-w-md bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-[60vh] object-cover bg-black"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Camera Switch Button & Indicator - Top Right */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
            <button 
              onClick={handleSwitchCamera}
              className="text-white bg-zinc-700/70 hover:bg-zinc-600 p-3 rounded-full backdrop-blur-sm transition shadow-lg"
              title="Switch Camera"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
              {facingMode === 'user' ? '🤳 Front' : '📷 Rear'}
            </span>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent">
            <button 
              onClick={onCancel}
              className="text-white bg-zinc-700/50 hover:bg-zinc-700 px-4 py-2 rounded-full backdrop-blur-sm transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleCapture}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:bg-white/20 transition-all"
            >
              <div className="w-12 h-12 bg-white rounded-full"></div>
            </button>
            <div className="w-20"></div> {/* Spacer for alignment */}
          </div>
        </div>
      )}
    </div>
  );
};
