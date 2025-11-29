// Service to interact with Replicate API via our secure Vercel API routes

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | null;
  error: string | null;
}

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
        model: "codeplugtech/face-swap:278a81e7",
        input: {
          source_image: sourceImage,
          target_image: targetImage,
          swap_image: targetImage
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
    // Check if we have Replicate API token in environment
    // @ts-ignore
    const apiToken = process.env.REPLICATE_API_TOKEN;
    
    // Try Vercel API route first (production/deployed)
    const startResponse = await fetch("/api/swap-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceImage, targetImage })
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
    
    // API route failed - try direct call if we have token (local dev)
    if (apiToken && apiToken.length > 0 && apiToken !== 'your_replicate_api_token_here') {
      console.log("Using direct Replicate API call (local development mode)");
      return await swapFaceDirectly(sourceImage, targetImage, apiToken);
    }
    
    // No API available, return original
    console.warn("Face swap unavailable. Install Vercel CLI and run 'vercel dev' or deploy to Vercel.");
    return targetImage;

  } catch (error) {
    console.error("Face swap service failed:", error);
    return targetImage;
  }
};
