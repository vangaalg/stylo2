// Service to interact with Replicate API via our secure Vercel API routes

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | null;
  error: string | null;
}

export const swapFaceWithReplicate = async (
  sourceImage: string, // User's original face (Base64)
  targetImage: string  // Gemini generated image (Base64)
): Promise<string> => {
  
  try {
    // 1. Start the Prediction via our Secure Proxy
    // Note: When running locally, ensure your API server is running or fallback to direct if allowed
    const startResponse = await fetch("/api/swap-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceImage, targetImage })
    });

    if (!startResponse.ok) {
        // If the proxy fails (e.g. 404 because not deployed yet), log warning and return original
        console.warn("Face swap API unreachable. Returning original image.");
        return targetImage;
    }

    const prediction: ReplicatePrediction = await startResponse.json();
    const predictionId = prediction.id;

    // 2. Poll for results via Proxy
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds approx

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      
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

  } catch (error) {
    console.error("Face swap service failed:", error);
    return targetImage;
  }
};
