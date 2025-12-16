// Convert height from "5'5" format to meters
export const convertHeightToMeters = (height: string): number | null => {
  if (!height) return null;
  
  // Parse format like "5'5" or "5'5\"" or "5'5 inches"
  const match = height.match(/(\d+)'(\d+)/);
  if (!match) return null;
  
  const feet = parseInt(match[1]);
  const inches = parseInt(match[2]);
  const totalInches = feet * 12 + inches;
  const meters = totalInches * 0.0254; // 1 inch = 0.0254 meters
  
  return meters;
};

// Extract weight number from string like "60 kg" or "60"
export const extractWeight = (weight: string): number | null => {
  if (!weight) return null;
  
  // Extract first number from string
  const match = weight.match(/(\d+\.?\d*)/);
  if (!match) return null;
  
  return parseFloat(match[1]);
};

// Calculate BMI and return adjusted weight
export const calculateBMIAndAdjustWeight = (
  height: string,
  weight: string
): { bmi: number | null; adjustedWeight: string; originalWeight: string } => {
  const heightMeters = convertHeightToMeters(height);
  const weightKg = extractWeight(weight);
  
  if (!heightMeters || !weightKg) {
    return { bmi: null, adjustedWeight: weight, originalWeight: weight };
  }
  
  // Calculate BMI: weight (kg) / height (m)²
  const bmi = weightKg / (heightMeters * heightMeters);
  
  // If BMI >= 25 (overweight), reduce by 5kg
  let adjustedWeightKg = weightKg;
  if (bmi >= 25) {
    adjustedWeightKg = weightKg - 5; // Reduce by exactly 5kg
    adjustedWeightKg = Math.max(adjustedWeightKg, 40); // Minimum 40kg
    adjustedWeightKg = Math.round(adjustedWeightKg * 10) / 10; // Round to 1 decimal
  }
  
  // Format weight back to string
  const adjustedWeight = `${adjustedWeightKg} kg`;
  
  return {
    bmi: Math.round(bmi * 10) / 10, // Round to 1 decimal
    adjustedWeight,
    originalWeight: weight
  };
};
