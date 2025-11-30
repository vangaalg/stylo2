
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
  hairStyle: string;
  hairColor: string;
  hairLength: string;
}

export interface ClothAnalysis {
  isClothing: boolean;
  clothingType: string;
  color: string;
  pattern: string;
  hasFaceInImage: boolean;
  texture: string;
  fit: string;
  neckline: string;
  sleeveLength: string;
}

export interface GenerationStyle {
  name: string;
  promptSuffix: string;
  synopsis: string;
}

export const STYLES: GenerationStyle[] = [
  {
    name: "Red Carpet Wedding",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. High-glamour wedding gala entrance, paparazzi camera flashes illuminating the subject, red carpet event atmosphere, cinematic lighting, elegant pose with face looking directly at camera, crowd in background blurred. Shoes must be visible. Face must be front-facing.",
    synopsis: "A glamorous celebrity entrance at a high-profile wedding gala."
  },
  {
    name: "Supermodel Walk",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Supermodel walking pose, face looking straight ahead directly at camera. Dynamic stride, confident energy, fashion week street background. Shoes must be visible. Face must be front-facing, not in profile. Person is wearing stylish designer sunglasses (e.g., Wayfarer or Aviator) that perfectly match the face shape.",
    synopsis: "A confident runway stride wearing chic designer sunglasses."
  },
  {
    name: "Studio Editorial",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Professional fashion studio photography, neutral grey background, softbox lighting, high fashion pose with face looking directly at camera, sharp focus, 8k resolution, vogue magazine style. Shoes must be visible. Face must be front-facing.",
    synopsis: "A professional, high-fashion studio photoshoot with perfect lighting."
  },
  {
    name: "Taj Mahal Royal",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Standing majestically in front of the Taj Mahal, Agra. Early morning golden hour lighting. The subject looks like Indian royalty or a high-end traveler. Marble reflecting pool in foreground. Majestic, serene atmosphere. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "A majestic, royal portrait in front of the iconic Taj Mahal."
  },
  {
    name: "Mumbai Nightlife",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Inside a high-end luxury nightclub in Mumbai. Neon lights, disco balls, energetic party atmosphere. The subject is the center of attention, holding a confident pose. Bokeh lights in background. Stylish, trendy vibe. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "The center of attention at a buzzing luxury nightclub."
  },
  {
    name: "Bollywood Runway",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Walking as a showstopper on a grand Bollywood fashion week ramp. Spotlights beaming down, confetti in the air, enthusiastic audience in dark background. Confident stride, superstar energy. High fashion runway setting. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "A showstopper moment on a grand Bollywood fashion runway."
  },
  {
    name: "Goa Beach Drive",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Leaning casually against a vintage open-top jeep or convertible car at a scenic Goa beach during sunset. Palm trees, ocean waves in background. Relaxed luxury travel vibe. Warm sunset lighting. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "Relaxed luxury vibes with a vintage car at a Goa beach sunset."
  },
  {
    name: "Jaipur Palace",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Standing on a balcony of the Hawa Mahal or City Palace, Jaipur. Intricate rajasthani architecture, sandstone arches in background. Regal, heritage fashion editorial style. Bright daylight. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "A regal heritage editorial amidst Jaipur's stunning architecture."
  },
  {
    name: "Concert Rockstar",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Standing in the VIP area or near stage at a massive music concert stadium. Laser lights, smoke machines, electric atmosphere. The subject looks like a rockstar or VIP guest. Night time concert lighting. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "Living the rockstar life at a massive stadium concert."
  },
  {
    name: "Anime Hero",
    promptSuffix: "Full body shot from head to toe. Wide angle composition. Studio Ghibli art style. Hand-painted background of a lush, magical meadow with fluffy clouds. The subject is drawn as the main anime protagonist but wearing the exact real clothing. Whimsical, peaceful, artistic. Soft cel-shaded coloring. Face looking straight at camera. Shoes visible. Face must be front-facing.",
    synopsis: "Transformed into the hero of a magical Studio Ghibli anime."
  },
  {
    name: "Custom Creation",
    promptSuffix: "CUSTOM", // Placeholder, will be replaced dynamically
    synopsis: "Create your own unique scene with a custom description."
  }
];

export interface User {
  id: string; // UUID from Supabase
  email: string;
  credits: number;
  isAdmin: boolean;
  age?: string;
  height?: string;
  weight?: string;
  name?: string;
  avatar?: string;
}

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}
