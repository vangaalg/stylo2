// Test script to verify Gemini image generation models
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const apiKey = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

console.log('=== Testing Gemini Image Generation Models ===\n');

const modelsToTest = [
  'gemini-3.0-pro-image-preview',
  'gemini-3-pro-image-preview', 
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp'
];

async function testModel(modelName) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Generate a simple red circle' }]
          }]
        })
      }
    );
    
    if (response.ok) {
      console.log(`   ✓ ${modelName} - Available`);
      return true;
    } else {
      const error = await response.json();
      if (error.error?.message?.includes('not found')) {
        console.log(`   ✗ ${modelName} - Not found`);
      } else {
        console.log(`   ⚠ ${modelName} - Error: ${error.error?.message?.substring(0, 80)}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`   ✗ ${modelName} - Connection error: ${error.message}`);
    return false;
  }
}

console.log('Testing image generation models:\n');

for (const model of modelsToTest) {
  await testModel(model);
  await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit protection
}

console.log('\n=== Model Test Complete ===');
console.log('\nRecommended: Use models marked with ✓');

