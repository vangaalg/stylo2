import { perfLogger } from '../utils/performanceLogger';

// Service to interact with Replicate API via our secure Vercel API routes

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | null;
  error: string | null;
}

// Helper to compress image for Vercel payload optimization
const compressImage = (base64: string, maxSize: number = 1024, quality: number = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64); 
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

// Direct Replicate API call for local development
const swapFaceDirectly = async (
  sourceImage: string,
  targetImage: string,
  apiToken: string
): Promise<string> => {
  try {
    // Start prediction
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
        input: {
          swap_image: sourceImage,
          input_image: targetImage
        }
      })
    });

    if (!startResponse.ok) {
      throw new Error(`Replicate API error: ${startResponse.statusText}`);
    }

    const prediction = await startResponse.json();
    const predictionId = prediction.id;

    // Poll for results
    let attempts = 0;
    const maxAttempts = 60; // Increased to 120s timeout

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          "Authorization": `Token ${apiToken}`,
          "Content-Type": "application/json",
        }
      });

      if (!pollResponse.ok) continue;

      const statusResult = await pollResponse.json();

      if (statusResult.status === "succeeded" && statusResult.output) {
        return statusResult.output;
      }

      if (statusResult.status === "failed" || statusResult.status === "canceled") {
        throw new Error(`Replicate prediction failed: ${statusResult.error}`);
      }

      attempts++;
    }

    throw new Error("Replicate prediction timed out");
  } catch (error) {
    console.error("Direct Replicate call failed:", error);
    throw error;
  }
};

// Add this helper function to extract and composite headwear
const preserveHeadwearAfterSwap = async (
  originalImageWithHeadwear: string, // Gemini-generated image (has headwear)
  swappedImage: string, // After face swap (headwear removed)
  headwearType?: string
): Promise<string> => {
  return new Promise((resolve) => {
    const originalImg = new Image();
    const swappedImg = new Image();
    
    originalImg.onload = () => {
      swappedImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = swappedImg.width;
        canvas.height = swappedImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(swappedImage);
          return;
        }
        
        // Draw the swapped image (with correct face)
        ctx.drawImage(swappedImg, 0, 0);
        
        // Extract headwear region from original image (top 25% of image)
        // For turban/pagdi, it's typically in the top portion
        const headwearHeight = Math.floor(originalImg.height * 0.25);
        const headwearWidth = originalImg.width;
        
        // Create a temporary canvas for headwear extraction
        const headwearCanvas = document.createElement('canvas');
        headwearCanvas.width = headwearWidth;
        headwearCanvas.height = headwearHeight;
        const headwearCtx = headwearCanvas.getContext('2d');
        
        if (headwearCtx) {
          // Extract headwear region from original
          headwearCtx.drawImage(
            originalImg,
            0, 0, headwearWidth, headwearHeight, // Source region
            0, 0, headwearWidth, headwearHeight  // Destination
          );
          
          // Composite headwear onto swapped image with soft blending
          // Use destination-over to place headwear on top, but blend edges
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.95; // Slight transparency for natural blending
          
          // Scale headwear to match swapped image width if needed
          const scaleX = swappedImg.width / originalImg.width;
          const scaledHeadwearHeight = headwearHeight * scaleX;
          
          ctx.drawImage(
            headwearCanvas,
            0, 0, headwearWidth, headwearHeight,
            0, 0, swappedImg.width, scaledHeadwearHeight
          );
          
          ctx.globalAlpha = 1.0; // Reset
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      swappedImg.src = swappedImage;
    };
    
    originalImg.src = originalImageWithHeadwear;
  });
};

// Update swapFaceWithReplicate to accept preserveHeadwear parameter
export const swapFaceWithReplicate = async (
  sourceImage: string, // User's original face (Base64)
  targetImage: string, // Gemini generated image (Base64)
  preserveHeadwear?: boolean | null,
  headwearType?: string
): Promise<string> => {
  
  perfLogger.start('Replicate Total');
  try {
    // Compress images to ensure we stay under Vercel's 4.5MB payload limit
    // Strategy: High quality for face (Source), Aggressive compression for dress (Target)
    perfLogger.start('Replicate Compression');
    const compressedSource = await compressImage(sourceImage, 1536, 0.95); // High Quality Face
    const compressedTarget = await compressImage(targetImage, 1024, 0.85); // Standard Quality Dress
    perfLogger.end('Replicate Compression');

    // Try Vercel API route first (works in production and with 'vercel dev')
    perfLogger.start('Replicate API Init');
    const startResponse = await fetch("/api/swap-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceImage: compressedSource, targetImage: compressedTarget })
    });
    perfLogger.end('Replicate API Init');

    // If API route works, use it
    if (startResponse.ok) {
      const prediction: ReplicatePrediction = await startResponse.json();
      const predictionId = prediction.id;

      // Poll for results via Proxy
      perfLogger.start('Replicate Polling');
      let attempts = 0;
      const maxAttempts = 60; // Increased to 120s timeout

      try {
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
      
          const pollResponse = await fetch(`/api/swap-status?id=${predictionId}`);
      
          if (!pollResponse.ok) continue;

          const statusResult: ReplicatePrediction = await pollResponse.json();

          if (statusResult.status === "succeeded" && statusResult.output) {
            let finalImage = statusResult.output;
            
            // If headwear should be preserved, composite it back
            if (preserveHeadwear === true) {
              perfLogger.start('Headwear Preservation');
              console.log('Preserving headwear after face swap...');
              finalImage = await preserveHeadwearAfterSwap(targetImage, statusResult.output, headwearType);
              perfLogger.end('Headwear Preservation');
            }
            
            return finalImage;
          }

          if (statusResult.status === "failed" || statusResult.status === "canceled") {
            throw new Error(`Replicate prediction failed: ${statusResult.error}`);
          }

          attempts++;
        }
        throw new Error("Replicate prediction timed out");
      } finally {
        perfLogger.end('Replicate Polling');
      }
    }
    
    // API route failed (404) - CORS prevents direct browser calls to Replicate
    // Solution: Use 'vercel dev' or 'npm run dev:full' to enable API routes
    console.warn("Face swap API route not available (404).");
    console.warn("To enable face swap in local development:");
    console.warn("1. Stop current server (Ctrl+C)");
    console.warn("2. Run: npm run dev:full");
    console.warn("   OR: vercel dev");
    console.warn("3. This will start API routes on http://localhost:3000");
    console.warn("4. Face swap will work through the API routes");
    console.warn("");
    console.warn("Note: Direct Replicate API calls from browser are blocked by CORS.");
    console.warn("Continuing without face swap enhancement...");
    return targetImage;

  } catch (error) {
    console.error("Face swap service failed:", error);
    return targetImage;
  } finally {
    perfLogger.end('Replicate Total');
  }
};
