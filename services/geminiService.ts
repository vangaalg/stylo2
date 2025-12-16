import { GoogleGenAI, Type } from "@google/genai";
import { UserAnalysis, ClothAnalysis, Gender } from "../types";
import { swapFaceWithReplicate } from "./replicateService";
import { perfLogger } from '../utils/performanceLogger';

// Helper to remove header from base64 if present
const cleanBase64 = (b64: string) => b64.replace(/^data:image\/\w+;base64,/, "");

// Helper to compress image for faster API calls
const compressImageForAnalysis = async (base64: string): Promise<string> => {
  perfLogger.start('Image Compression');
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
        perfLogger.end('Image Compression');
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% quality
      } else {
        perfLogger.end('Image Compression');
        resolve(base64); // Fallback to original
      }
    };
    img.onerror = () => {
        perfLogger.end('Image Compression');
        resolve(base64);
    }; // Fallback to original
    img.src = base64;
  });
};

// @ts-ignore
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

// Helper function to generate image with fallback
const generateImageWithFallback = async (
  model: string,
  contents: any[],
  config: any
): Promise<string> => {
  const perfId = `Gemini API Call (${model})`;
  perfLogger.start(perfId);
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: config
    });

    // Extract image from response parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated");
  } catch (error: any) {
    // If model not found or error, throw to trigger fallback
    if (error.message?.includes("not found") || error.message?.includes("404") || error.message?.includes("NOT_FOUND")) {
      throw new Error("MODEL_NOT_FOUND");
    }
    throw error;
  } finally {
    perfLogger.end(perfId);
  }
};

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
            text: `Analyze this image. Does it contain a clear human face? What is the apparent gender? Provide a short description. Also analyze hair details: style (curly, straight, wavy, bald, etc), color (black, blonde, brown, etc), and length (short, medium, long, etc).

CRITICAL: Check if the person is wearing any headwear (regardless of gender):
- Turban (pagri/safa) - can be worn by any gender
- Hijab/headscarf - typically worn by females
- Cap, hat, or other headwear - can be worn by any gender
- Religious or cultural headwear - can be worn by any gender
- If headwear is present, specify the type (turban, hijab, cap, hat, headscarf, etc.)
- If no headwear, set hasHeadwear to false

Note: Headwear detection should be gender-neutral. Detect all types of headwear for all genders.`,
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
            hairStyle: { type: Type.STRING },
            hairColor: { type: Type.STRING },
            hairLength: { type: Type.STRING },
            hasHeadwear: { type: Type.BOOLEAN },
            headwearType: { type: Type.STRING },
          },
          required: ["isFace", "gender", "description", "hairStyle", "hairColor", "hairLength", "hasHeadwear"],
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
            text: "Analyze this image. Is it a clothing item? If so, what type (shirt, pant, dress, suit, etc.)? Be very specific about the color (e.g. 'emerald green' instead of 'green', 'navy blue' instead of 'blue') and pattern (floral, striped, solid, etc). Also analyze fabric texture (denim, silk, cotton, wool, etc), fit (loose, tight, oversized, etc), neckline (V-neck, round, collar, etc), and sleeve length (long, short, sleeveless, etc). Detect if there is a person's face visible.",
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
            texture: { type: Type.STRING },
            fit: { type: Type.STRING },
            neckline: { type: Type.STRING },
            sleeveLength: { type: Type.STRING },
          },
          required: ["isClothing", "clothingType", "color", "pattern", "hasFaceInImage", "texture", "fit", "neckline", "sleeveLength"],
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
    const contents = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64(clothBase64),
        },
      },
      {
        text: "Generate a clean product photo of ONLY the clothing item from this image. Remove or mask any person, face, or body parts. Show only the clothing item itself, as if it's laid flat or on a mannequin without visible face or skin. Keep the clothing's color, pattern, and texture exactly the same.",
      },
    ];

    // Try Gemini 3 Pro Image Preview first, fallback to Gemini 2.5 Flash Image
    let cleanedImage = "";
    try {
      cleanedImage = await generateImageWithFallback(
        "gemini-3-pro-image-preview",
        contents,
        {
          temperature: 0.3,
          imageConfig: {
            aspectRatio: "1:1",
            outputResolution: "1K"
          }
        }
      );
    } catch (error: any) {
      if (error.message === "MODEL_NOT_FOUND" || error.message?.includes("not found")) {
        console.log("Falling back to Gemini 2.5 Flash Image for face removal");
        cleanedImage = await generateImageWithFallback(
          "gemini-2.5-flash-image",
          contents,
          {
            temperature: 0.3,
            imageConfig: {
              aspectRatio: "1:1"
            }
          }
        );
      } else {
        throw error;
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


export const enhanceStylePrompt = async (userPrompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          {
            text: `Enhance this user photo description into a high-quality AI image generation prompt.
            
            User Input: "${userPrompt}"
            
            Rules:
            1. Keep the core location and elements (e.g., "Marine Drive", "Mercedes Benz").
            2. Add professional photography details: "Full body shot from head to toe", "Wide angle composition", "Cinematic lighting", "High fashion photography style".
            3. CRITICAL: Add "Face must be front-facing", "Shoes must be visible".
            4. Make it descriptive and atmospheric.
            5. Output ONLY the prompt string, no explanations.`
          }
        ]
      }
    });

    return response.text || userPrompt;
  } catch (error) {
    console.error("Prompt enhancement failed", error);
    return userPrompt; // Fallback to original
  }
};

export const generateTryOnImage = async (
  userBase64: string,
  clothBase64: string,
  userDescription: string,
  clothDescription: string,
  styleSuffix: string,
  onStatusChange?: (status: string) => void,
  clothingHasFace: boolean = false,
  qualityMode: 'fast' | 'quality' = 'fast',
  preserveHeadwear?: boolean | null,
  headwearType?: string
): Promise<string> => {
  try {
    if (onStatusChange) onStatusChange("Generating base look...");

    // Strengthened prompt to enforce color fidelity and full body composition
    const faceWarning = clothingHasFace 
      ? "\n      CRITICAL: Image 2 may contain a person's face. IGNORE any face in Image 2. Use ONLY the face, hair, and features from Image 1 (the person's photo). Extract ONLY the clothing details from Image 2."
      : "";
    
    // Gender-neutral headwear instruction
    const headwearInstruction = preserveHeadwear === true
      ? `\n      CRITICAL HEADWEAR INSTRUCTION: The person in Image 1 is wearing ${headwearType || 'headwear'}. 
         You MUST preserve and maintain the exact headwear in ALL generated images. 
         The headwear is an essential part of their identity and should NEVER be removed, altered, or replaced.
         This applies regardless of the style or clothing being tried on.`
      : preserveHeadwear === false
      ? `\n      CRITICAL HEADWEAR INSTRUCTION: Remove any headwear from the person in Image 1. 
         Generate images showing only the face and hair, without any ${headwearType || 'headwear'}.`
      : '';
    
    const prompt = `
      You are an expert virtual fashion stylist.
      
      Task: Create a photorealistic image of the person (from Image 1) wearing the exact clothing item (from Image 2).${faceWarning}${headwearInstruction}
      
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
      - Person: ${userDescription}
      - Clothing: ${clothDescription} (CRITICAL: Match material, texture, pattern, and fit exactly).
      
      Style: ${styleSuffix}
      
      FITTING INSTRUCTIONS (CRITICAL - HIGHEST PRIORITY):
      - The clothing MUST FIT PERFECTLY on the body - like it was custom-tailored or professionally fitted.
      - NO LOOSE, BAGGY, OR ILL-FITTING AREAS. The fabric should hug the body contours naturally.
      - Dresses must fit snugly at the waist, bust, and hips - showing the body's natural shape.
      - The fabric should drape elegantly and follow the body's curves, NOT hang loosely away from the body.
      - Avoid any appearance of clothing being "too big" or "floating" on the person.
      - The clothing should look like it was made specifically for this person's measurements.
      - If the reference clothing appears loose, still make it fit well on the person in the generated image.
      - Fabric should show natural tension and flow, not appear stretched or artificially draped.
      
      REALISM & PHOTOQUALITY (CRITICAL):
      - Generate a PHOTOREALISTIC image that looks like a real professional fashion photograph.
      - Avoid any 3D render, CGI, or artificial appearance.
      - Natural skin texture, realistic lighting, and authentic shadows.
      - The clothing should look like real fabric with natural wrinkles, folds, and movement.
      - Avoid overly smooth or plastic-looking surfaces.
      - The image should be indistinguishable from a real fashion photoshoot.
      - Natural depth of field and realistic background blur if applicable.
      
      Output: A single high-quality, photorealistic fashion photograph. The clothing must fit impeccably, look naturally worn, and appear completely realistic - as if taken by a professional fashion photographer.
    `;

    const contents = [
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
    ];

    // Select model based on quality mode
    let primaryModel = qualityMode === 'quality' ? "gemini-3-pro-image-preview" : "gemini-2.5-flash-image";
    let generatedImage = "";

    try {
      if (onStatusChange) onStatusChange(`Using ${primaryModel}...`);
      
      const config: any = {
        temperature: 0.4,
        imageConfig: {
          aspectRatio: "3:4"
        }
      };

      // Only add outputResolution for pro model
      if (qualityMode === 'quality') {
        config.imageConfig.outputResolution = "1K";
      }

      generatedImage = await generateImageWithFallback(
        primaryModel,
        contents,
        config
      );
    } catch (error: any) {
      // Fallback logic
      if (error.message === "MODEL_NOT_FOUND" || error.message?.includes("not found")) {
        // If Pro fails or is not found, fallback to Flash
        if (primaryModel === "gemini-3-pro-image-preview") {
           console.log("Gemini 3 Pro Image Preview not available, falling back to Gemini 2.5 Flash Image");
           if (onStatusChange) onStatusChange("Using Gemini 2.5 Flash Image (Fallback)...");
           generatedImage = await generateImageWithFallback(
            "gemini-2.5-flash-image",
            contents,
            {
              temperature: 0.4,
              imageConfig: {
                aspectRatio: "3:4"
              }
            }
          );
        } else {
          // If Flash fails, try Pro (rare, but possible if Flash is down)
           console.log("Gemini 2.5 Flash Image not available, attempting Gemini 3 Pro Image Preview");
           generatedImage = await generateImageWithFallback(
            "gemini-3-pro-image-preview",
            contents,
            {
              temperature: 0.4,
              imageConfig: {
                aspectRatio: "3:4"
              }
            }
          );
        }
      } else {
        throw error;
      }
    }
    
    if (!generatedImage) {
      throw new Error("No image generated by Gemini.");
    }

    // --- PHASE 2: FACE SWAP ---
    // Note: Face swap is handled in App.tsx separately now for pipelining, 
    // but we keep this return for backward compatibility if needed, 
    // or we can remove the internal call.
    // Based on the user's request for pipelining, App.tsx calls swapFaceWithReplicate separately.
    // So we just return the generated image here.
    return generatedImage;

  } catch (error) {
    console.error("Generation pipeline failed", error);
    throw error;
  }
};