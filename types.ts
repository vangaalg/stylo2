
export enum AppStep {
  UPLOAD_USER = 0,
  UPLOAD_CLOTH = 1,
  CONFIRMATION = 2,
  GENERATING = 3,
  RESULTS = 4,
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Unspecified',
}

export interface UserAnalysis {
  isFace: boolean;
  gender: Gender;
  description: string;
}

export interface ClothAnalysis {
  isClothing: boolean;
  clothingType: string;
  color: string;
  pattern: string;
  hasFaceInImage: boolean;
}

export interface GenerationStyle {
  name: string;
  promptSuffix: string;
}

export const STYLES: GenerationStyle[] = [
  {
    name: "Red Carpet Wedding",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. High-glamour wedding gala entrance, paparazzi camera flashes illuminating the subject, red carpet event atmosphere, cinematic lighting, elegant pose with face looking directly at camera, crowd in background blurred. Shoes must be visible. Face must be front-facing."
  },
  {
    name: "Studio Editorial",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Professional fashion studio photography, neutral grey background, softbox lighting, high fashion pose with face looking directly at camera, sharp focus, 8k resolution, vogue magazine style. Shoes must be visible. Face must be front-facing."
  },
  {
    name: "Supermodel Walk",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Supermodel walking pose, face looking straight ahead directly at camera. Dynamic stride, confident energy, fashion week street background. Shoes must be visible. Face must be front-facing, not in profile."
  }
];

export interface User {
  id: string; // UUID from Supabase
  email: string;
  credits: number;
  isAdmin: boolean;
}

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}
