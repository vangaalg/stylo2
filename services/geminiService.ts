import { GoogleGenAI, Type } from "@google/genai";
import { UserAnalysis, ClothAnalysis, Gender } from "../types";
import { swapFaceWithReplicate } from "./replicateService";

// Helper to remove header from base64 if present
const cleanBase64 = (b64: string) => b64.replace(/^data:image\/\w+;base64,/, "");

// @ts-ignore
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export const analyzeUserFace = async (base64Image: string): Promise<UserAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(base64Image),
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64(base64Image),
            },
          },
          {
            text: "Analyze this image. Is it a clothing item? If so, what type (shirt, pant, dress, suit, etc.)? Be very specific about the color (e.g. 'emerald green' instead of 'green', 'navy blue' instead of 'blue') and pattern.",
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
          },
          required: ["isClothing", "clothingType", "color", "pattern"],
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

export const generateTryOnImage = async (
  userBase64: string,
  clothBase64: string,
  userDescription: string,
  clothDescription: string,
  styleSuffix: string,
  onStatusChange?: (status: string) => void
): Promise<string> => {
  try {
    if (onStatusChange) onStatusChange("Generating base look...");

    // Strengthened prompt to enforce color fidelity and full body composition
    const prompt = `
      You are an expert virtual fashion stylist.
      
      Task: Create a photorealistic image of the person (from Image 1) wearing the exact clothing item (from Image 2).
      
      COMPOSITION REQUIREMENTS (CRITICAL):
      - Full body shot from head to toe.
      - Wide angle view to capture the entire outfit and shoes.
      - Do NOT crop the head or feet.
      
      CRITICAL INSTRUCTIONS FOR COLOR & TEXTURE:
      - The generated clothing MUST MATCH the color, pattern, and fabric texture of the reference clothing image EXACTLY.
      - Do NOT alter the color. If the reference is red, the output must be the same shade of red.
      - Do NOT alter the pattern.
      - Ensure the lighting does not wash out the colors.
      
      Subject Details:
      - Person: ${userDescription} (Keep face, hair, and body type consistent with Image 1).
      - Clothing: ${clothDescription} (Use this to verify color accuracy).
      
      Style: ${styleSuffix}
      
      Output: A single high-quality fashion photograph. The clothing must look naturally worn, with realistic draping and fit.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
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
          aspectRatio: "3:4"
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