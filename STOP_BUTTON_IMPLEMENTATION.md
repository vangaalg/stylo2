# Stop Button Implementation Guide

This file contains the code changes needed to add a stop button for each image generation that:
- Appears only for the first 10 seconds after generation starts
- Works independently for each image
- Cancels the generation when clicked

## Changes Required in App.tsx

### 1. Add State Variables (add after existing state declarations)

```typescript
// State for tracking generation start times
const [generationStartTimes, setGenerationStartTimes] = useState<Record<number, number>>({});

// State for tracking cancelled generations
const [cancelledGenerations, setCancelledGenerations] = useState<Set<number>>(new Set());

// State for abort controllers
const [abortControllers, setAbortControllers] = useState<Record<number, AbortController>>({});
```

### 2. Add Stop Generation Handler Function

```typescript
// Handler to stop generation for a specific image
const handleStopGeneration = (index: number) => {
  // Mark as cancelled
  setCancelledGenerations(prev => new Set(prev).add(index));
  
  // Abort the controller if it exists
  if (abortControllers[index]) {
    abortControllers[index].abort();
  }
  
  // Update status to cancelled
  setGeneratedImages(prev => {
    const newImages = [...prev];
    if (newImages[index]) {
      newImages[index] = { 
        ...newImages[index],
        status: 'cancelled' as ImageStatus
      };
    }
    return newImages;
  });
  
  // Clean up
  setGenerationStartTimes(prev => {
    const new = { ...prev };
    delete new[index];
    return new;
  });
  
  setAbortControllers(prev => {
    const new = { ...prev };
    delete new[index];
    return new;
  });
  
  console.log(`Generation stopped for image ${index}`);
};
```

### 3. Update handleGenerate Function

In the loop where images are generated, add:

```typescript
for (let index = 0; index < STYLES.length; index++) {
  const style = STYLES[index];
  
  // Skip if already cancelled
  if (cancelledGenerations.has(index)) {
    continue;
  }
  
  // Create AbortController for this image
  const abortController = new AbortController();
  setAbortControllers(prev => ({ ...prev, [index]: abortController }));
  
  // Record start time
  setGenerationStartTimes(prev => ({ ...prev, [index]: Date.now() }));
  
  try {
    // Update status to generating
    setGeneratedImages(prev => {
      const newImages = [...prev];
      newImages[index] = { style: style.name, url: '', status: 'generating' };
      return newImages;
    });
    
    // 1. Gemini Step - check for cancellation before and after
    if (abortController.signal.aborted || cancelledGenerations.has(index)) {
      continue;
    }
    
    const generatedImage = await generateTryOnImage(
      userImage, 
      clothImage, 
      userDesc, 
      clothDesc, 
      style.promptSuffix,
      (msg) => {},
      clothAnalysis?.hasFaceInImage || false,
      qualityMode,
      preserveHeadwear,
      userAnalysis?.headwearType
    );
    
    // Check if cancelled during generation
    if (abortController.signal.aborted || cancelledGenerations.has(index)) {
      setGeneratedImages(prev => {
        const newImages = [...prev];
        newImages[index] = { style: style.name, url: '', status: 'cancelled' };
        return newImages;
      });
      continue;
    }
    
    // 2. Replicate Step
    setGeneratedImages(prev => {
      const newImages = [...prev];
      newImages[index] = { style: style.name, url: generatedImage, status: 'swapping' };
      return newImages;
    });
    
    const replicateTask = (async () => {
      try {
        // Check cancellation before face swap
        if (abortController.signal.aborted || cancelledGenerations.has(index)) {
          return;
        }
        
        const finalImage = await swapFaceWithReplicate(
          userImage, 
          generatedImage,
          preserveHeadwear,
          userAnalysis?.headwearType
        );
        
        // Final check before updating
        if (!abortController.signal.aborted && !cancelledGenerations.has(index)) {
          setGeneratedImages(prev => {
            const newImages = [...prev];
            newImages[index] = { style: style.name, url: finalImage, status: 'done' };
            return newImages;
          });
          
          // Clear timer and start time
          setImageTimers(prev => ({ ...prev, [index]: 0 }));
          setGenerationStartTimes(prev => {
            const new = { ...prev };
            delete new[index];
            return new;
          });
          
          addToHistory({ url: finalImage, style: style.name });
        }
      } catch (err) {
        if (!abortController.signal.aborted && !cancelledGenerations.has(index)) {
          // Handle error...
        }
      } finally {
        // Clean up abort controller
        setAbortControllers(prev => {
          const new = { ...prev };
          delete new[index];
          return new;
        });
      }
    })();
    
    replicateTasks.push(replicateTask);
    
  } catch (err) {
    if (!abortController.signal.aborted && !cancelledGenerations.has(index)) {
      // Handle error...
    }
  }
}
```

### 4. Add useEffect to Auto-hide Stop Buttons After 10 Seconds

```typescript
// Auto-hide stop buttons after 10 seconds
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    setGenerationStartTimes(prev => {
      const updated = { ...prev };
      let changed = false;
      
      Object.keys(updated).forEach(key => {
        const index = parseInt(key);
        const elapsed = (now - updated[index]) / 1000;
        
        if (elapsed >= 10) {
          delete updated[index];
          changed = true;
        }
      });
      
      return changed ? updated : prev;
    });
  }, 100); // Check every 100ms
  
  return () => clearInterval(interval);
}, []);
```

### 5. Add Stop Button UI in Image Grid

In the section where generatedImages are mapped and displayed, add:

```typescript
{generatedImages.map((img, idx) => {
  const startTime = generationStartTimes[idx];
  const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
  const showStopButton = startTime && 
                        elapsed < 10 && 
                        (img?.status === 'generating' || img?.status === 'swapping') &&
                        !cancelledGenerations.has(idx);
  
  return (
    <div key={idx} className="relative">
      {/* Your existing image card */}
      
      {/* Stop Button - Only shows for first 10 seconds */}
      {showStopButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStopGeneration(idx);
          }}
          className="absolute top-2 right-2 z-50 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all animate-pulse"
          title="Stop generation (available for 10 seconds)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Stop
        </button>
      )}
      
      {/* Countdown indicator (optional) */}
      {showStopButton && (
        <div className="absolute top-2 left-2 z-50 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
          {Math.max(0, Math.ceil(10 - elapsed))}s
        </div>
      )}
      
      {/* Rest of your image card UI */}
    </div>
  );
})}
```

## Notes

- The stop button only appears for the first 10 seconds
- Each image has its own independent stop button
- Cancellation is tracked per-image using the index
- AbortController is used to signal cancellation
- The button automatically disappears after 10 seconds

