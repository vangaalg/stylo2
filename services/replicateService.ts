// Service to interact with Replicate API via our secure Vercel API routes

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | null;
  error: string | null;
}

// Helper to compress image for Vercel payload optimization
const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 1024; // Safe size for Vercel payload limit (4.5MB)
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > MAX_SIZE) {
        height = (height * MAX_SIZE) / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = (width * MAX_SIZE) / height;
        height = MAX_SIZE;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // JPEG 0.85 is great balance
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
    const maxAttempts = 30;

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

export const swapFaceWithReplicate = async (
  sourceImage: string, // User's original face (Base64)
  targetImage: string  // Gemini generated image (Base64)
): Promise<string> => {
  
  try {
    // Compress images to ensure we stay under Vercel's 4.5MB payload limit
    const compressedSource = await compressImage(sourceImage);
    const compressedTarget = await compressImage(targetImage);

    // Try Vercel API route first (works in production and with 'vercel dev')
    const startResponse = await fetch("/api/swap-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceImage: compressedSource, targetImage: compressedTarget })
    });

    // If API route works, use it
    if (startResponse.ok) {
      const prediction: ReplicatePrediction = await startResponse.json();
      const predictionId = prediction.id;

      // Poll for results via Proxy
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pollResponse = await fetch(`/api/swap-status?id=${predictionId}`);
        
        if (!pollResponse.ok) continue;

        const statusResult: ReplicatePrediction = await pollResponse.json();

        if (statusResult.status === "succeeded" && statusResult.output) {
          return statusResult.output;
        }

        if (statusResult.status === "failed" || statusResult.status === "canceled") {
          throw new Error(`Replicate prediction failed: ${statusResult.error}`);
        }

        attempts++;
      }

      throw new Error("Replicate prediction timed out");
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
  }
};
