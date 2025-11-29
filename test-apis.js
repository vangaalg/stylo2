// Test script to verify all APIs are working
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

console.log('=== API Configuration Test ===\n');

// Test 1: Check environment variables
console.log('1. Checking Environment Variables:');
const apiKey = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
const replicateToken = process.env.REPLICATE_API_TOKEN || process.env.VITE_REPLICATE_API_TOKEN;

if (apiKey) {
  console.log('   ✓ API_KEY found:', apiKey.substring(0, 20) + '...');
} else {
  console.log('   ✗ API_KEY missing');
}

if (replicateToken) {
  console.log('   ✓ REPLICATE_API_TOKEN found:', replicateToken.substring(0, 20) + '...');
} else {
  console.log('   ✗ REPLICATE_API_TOKEN missing');
}

console.log('');

// Test 2: Test Gemini API connection
console.log('2. Testing Gemini API:');
if (apiKey) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Say hello in one word' }]
          }]
        })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✓ Gemini API working');
      console.log('   Response:', data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK');
    } else {
      const error = await response.text();
      console.log('   ✗ Gemini API error:', response.status, error.substring(0, 100));
    }
  } catch (error) {
    console.log('   ✗ Gemini API connection failed:', error.message);
  }
} else {
  console.log('   ⚠ Skipping - API_KEY not found');
}

console.log('');

// Test 3: Test Replicate API connection
console.log('3. Testing Replicate API:');
if (replicateToken) {
  try {
    const response = await fetch('https://api.replicate.com/v1/models/codeplugtech/face-swap', {
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✓ Replicate API working');
      console.log('   Model:', data.name || 'codeplugtech/face-swap');
    } else {
      const error = await response.text();
      console.log('   ✗ Replicate API error:', response.status, error.substring(0, 100));
    }
  } catch (error) {
    console.log('   ✗ Replicate API connection failed:', error.message);
  }
} else {
  console.log('   ⚠ Skipping - REPLICATE_API_TOKEN not found');
}

console.log('');
console.log('=== Test Complete ===');

