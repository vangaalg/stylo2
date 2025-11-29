// Test face swap API with correct parameters from documentation
import { config } from 'dotenv';

config({ path: '.env.local' });

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN || REPLICATE_API_TOKEN === 'your_replicate_api_token_here') {
  console.error('❌ REPLICATE_API_TOKEN not found in .env.local');
  process.exit(1);
}

// Test images from Replicate documentation
const testImages = {
  swap_image: "https://replicate.delivery/pbxt/KYU956lXBNWkoblkuMb93b6CX8SFL2nrJTvv2T89Dm3DLhsW/swap%20img.jpg",
  input_image: "https://replicate.delivery/pbxt/KYU95NKY092KYhmCDbLLOVHZqzSC27D5kQLHDb28YM6u8Il1/input.jpg"
};

console.log('\x1b[36m%s\x1b[0m', '=== Testing Face Swap API ===\n');

async function testFaceSwap() {
  try {
    console.log('1. Starting prediction with Replicate API...');
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34',
        input: testImages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const prediction = await response.json();
    console.log('\x1b[32m%s\x1b[0m', '✓ Prediction started successfully');
    console.log('  Prediction ID:', prediction.id);
    console.log('  Status:', prediction.status);
    
    // Poll for results
    console.log('\n2. Waiting for face swap to complete...');
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }
      
      const status = await statusResponse.json();
      console.log(`  Attempt ${attempts + 1}/${maxAttempts}: ${status.status}`);
      
      if (status.status === 'succeeded') {
        console.log('\x1b[32m%s\x1b[0m', '\n✓ Face swap completed successfully!');
        console.log('  Output URL:', status.output);
        return true;
      }
      
      if (status.status === 'failed' || status.status === 'canceled') {
        throw new Error(`Prediction ${status.status}: ${status.error || 'Unknown error'}`);
      }
      
      attempts++;
    }
    
    throw new Error('Timeout: Prediction took too long');
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '\n✗ Face swap test failed:');
    console.error('  Error:', error.message);
    return false;
  }
}

testFaceSwap().then(success => {
  if (success) {
    console.log('\x1b[36m%s\x1b[0m', '\n=== All tests passed! ===');
    console.log('\nYour face swap API is working correctly.');
    console.log('Parameters used:');
    console.log('  - swap_image (the face to apply)');
    console.log('  - input_image (the target body/image)');
    console.log('  - version: 278a81e7ebb... (full hash)');
  } else {
    console.log('\x1b[31m%s\x1b[0m', '\n=== Test failed ===');
    process.exit(1);
  }
});

