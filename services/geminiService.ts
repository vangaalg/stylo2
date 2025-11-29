import { GoogleGenAI, Type } from "@google/genai";
import { UserAnalysis, ClothAnalysis, Gender } from "../types";
import { swapFaceWithReplicate } from "./replicateService";

// Helper to remove header from base64 if present
const cleanBase64 = (b64: string) => b64.replace(/^data:image\/\w+;base64,/, "");

// Helper to compress image for faster API calls
const compressImageForAnalysis = async (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 800; // Max width/height for analysis
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions maintaining aspect ratio
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
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% quality
      } else {
        resolve(base64); // Fallback to original
      }
    };
    img.onerror = () => resolve(base64); // Fallback to original
    img.src = base64;
  });
};

// @ts-ignore
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export const analyzeUserFace = async (base64Image: string): Promise<UserAnalysis> => {
  try {
    // Compress image for faster analysis
    const compressedImage = await compressImageForAnalysis(base64Image);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(compressedImage),
            },
          },
          {
            text: "Analyze this image. Does it contain a clear human face? What is the apparent gender? Provide a short description of hair, skin tone, and body type.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFace: { type: Type.BOOLEAN },
            gender: { type: Type.STRING, enum: [Gender.MALE, Gender.FEMALE, Gender.OTHER] },
            description: { type: Type.STRING },
          },
          required: ["isFace", "gender", "description"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as UserAnalysis;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Face analysis failed", error);
    throw error;
  }
};

export const analyzeClothItem = async (base64Image: string): Promise<ClothAnalysis> => {
  try {
    // Compress image for faster analysis
    const compressedImage = await compressImageForAnalysis(base64Image);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(compressedImage),
            },
          },
          {
            text: "Analyze this image. Is it a clothing item? If so, what type (shirt, pant, dress, suit, etc.)? Be very specific about the color (e.g. 'emerald green' instead of 'green', 'navy blue' instead of 'blue') and pattern. Also detect if there is a person's face visible in this image (hasFaceInImage should be true if any face is visible, false otherwise).",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isClothing: { type: Type.BOOLEAN },
            clothingType: { type: Type.STRING },
            color: { type: Type.STRING },
            pattern: { type: Type.STRING },
            hasFaceInImage: { type: Type.BOOLEAN },
          },
          required: ["isClothing", "clothingType", "color", "pattern", "hasFaceInImage"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as ClothAnalysis;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Cloth analysis failed", error);
    throw error;
  }
};

// Function to remove face from clothing image if present
export const removeFaceFromClothingImage = async (clothBase64: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "imagen-3",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(clothBase64),
            },
          },
          {
            text: "Generate a clean product photo of ONLY the clothing item from this image. Remove or mask any person, face, or body parts. Show only the clothing item itself, as if it's laid flat or on a mannequin without visible face or skin. Keep the clothing's color, pattern, and texture exactly the same.",
          },
        ],
      },
      config: {
        temperature: 0.3,
        imageConfig: {
          aspectRatio: "1:1",
          outputResolution: "high"
        }
      }
    });

    // Extract image from response
    let cleanedImage = "";
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          cleanedImage = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }
    
    if (!cleanedImage) {
      console.warn("Failed to remove face from clothing image, using original");
      return clothBase64;
    }
    
    return cleanedImage;
  } catch (error) {
    console.error("Face removal from clothing failed, using original:", error);
    return clothBase64;
  }
};

export const generateTryOnImage = async (
  userBase64: string,
  clothBase64: string,
  userDescription: string,
  clothDescription: string,
  styleSuffix: string,
  onStatusChange?: (status: string) => void,
  clothingHasFace: boolean = false
): Promise<string> => {
  try {
    if (onStatusChange) onStatusChange("Generating base look...");

    // Strengthened prompt to enforce color fidelity and full body composition
    const faceWarning = clothingHasFace 
      ? "\n      CRITICAL: Image 2 may contain a person's face. IGNORE any face in Image 2. Use ONLY the face, hair, and features from Image 1 (the person's photo). Extract ONLY the clothing details from Image 2."
      : "";
    
    const prompt = `
      You are an expert virtual fashion stylist.
      
      Task: Create a photorealistic image of the person (from Image 1) wearing the exact clothing item (from Image 2).${faceWarning}
      
      COMPOSITION REQUIREMENTS (CRITICAL):
      - Full body shot from head to toe.
      - Wide angle view to capture the entire outfit and shoes.
      - Do NOT crop the head or feet.
      
      CRITICAL INSTRUCTIONS FOR COLOR & TEXTURE:
      - The generated clothing MUST MATCH the color, pattern, and fabric texture of the reference clothing image EXACTLY.
      - Do NOT alter the color. If the reference is red, the output must be the same shade of red.
      - Do NOT alter the pattern.
      - Ensure the lighting does not wash out the colors.
      
      FACE AND IDENTITY (CRITICAL):
      - Use ONLY the face, hair, skin tone, and physical features from Image 1 (the person's reference photo).
      - Do NOT use any face or body features from Image 2 (the clothing reference).
      - The final person must be clearly identifiable as the person from Image 1.
      
      Subject Details:
      - Person: ${userDescription} (Keep face, hair, and body type consistent with Image 1. Ensure body proportions match the specified age and height if provided).
      - Clothing: ${clothDescription} (Use this to verify color accuracy).
      
      Style: ${styleSuffix}
      
      Output: A single high-quality fashion photograph. The clothing must look naturally worn, with realistic draping and fit. Body proportions should be age-appropriate and match the specified height.
    `;

    const response = await ai.models.generateContent({
      model: "imagen-3",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(userBase64),
            },
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(clothBase64),
            },
          },
          { text: prompt },
        ],
      },
      config: {
        temperature: 0.4,
        imageConfig: {
          aspectRatio: "3:4",
          outputResolution: "4K"
        }
      }
    });

    // Extract image from response parts
    let generatedImage = "";
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImage = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }
    
    if (!generatedImage) {
      throw new Error("No image generated by Gemini.");
    }

    // --- PHASE 2: FACE SWAP ---
    if (onStatusChange) onStatusChange("Refining face details...");
    
    // Call Replicate to swap original face onto generated body
    const finalImage = await swapFaceWithReplicate(userBase64, generatedImage);

    return finalImage;

  } catch (error) {
    console.error("Generation pipeline failed", error);
    throw error;
  }
};