// Local development API server to handle Replicate API calls and Razorpay
// This solves CORS issues when running locally

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Load environment variables (try .env.local first, then local.env as fallback)
config({ path: '.env.local' });
if (!process.env.REPLICATE_API_TOKEN) {
  config({ path: 'local.env' });
}

const PORT = 3001;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!REPLICATE_API_TOKEN || REPLICATE_API_TOKEN === 'your_replicate_api_token_here') {
  console.error('❌ REPLICATE_API_TOKEN not found in .env.local');
  process.exit(1);
}

// Initialize Razorpay (optional - won't crash if keys are missing)
let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  console.log('\x1b[32m✓\x1b[0m Razorpay initialized');
} else {
  console.log('\x1b[33m⚠\x1b[0m Razorpay keys not found - payment endpoints will be disabled');
}

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle /api/swap-init
  if (req.url === '/api/swap-init' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { sourceImage, targetImage } = JSON.parse(body);

        const response = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: '278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34',
            input: {
              swap_image: sourceImage,
              input_image: targetImage
            }
          })
        });

        const result = await response.json();
        
        res.writeHead(response.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Error in /api/swap-init:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Handle /api/swap-status
  if (req.url.startsWith('/api/swap-status') && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');

    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing prediction ID' }));
      return;
    }

    try {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Error in /api/swap-status:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Handle /api/create-order (Razorpay)
  if (req.url === '/api/create-order' && req.method === 'POST') {
    if (!razorpay) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Payment gateway is currently under maintenance (Missing Keys). Please try again later or contact support.' 
      }));
      return;
    }

    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { amount, currency } = JSON.parse(body);

        if (!amount || !currency) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Amount and currency are required' }));
          return;
        }

        const options = {
          amount: amount * 100, // Razorpay expects amount in paise
          currency: currency,
          receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(order));
      } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message || 'Something went wrong with the payment provider' }));
      }
    });
    return;
  }

  // Handle /api/verify-payment (Razorpay)
  if (req.url === '/api/verify-payment' && req.method === 'POST') {
    if (!razorpay || !RAZORPAY_KEY_SECRET) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Payment verification is currently unavailable.' 
      }));
      return;
    }

    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(body);

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing payment details' }));
          return;
        }

        // Verify signature
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generated_signature = crypto
          .createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(text)
          .digest('hex');

        const isSignatureValid = generated_signature === razorpay_signature;

        if (isSignatureValid) {
          // Optionally fetch payment details from Razorpay
          try {
            const payment = await razorpay.payments.fetch(razorpay_payment_id);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              payment: {
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                order_id: payment.order_id
              }
            }));
          } catch (fetchError) {
            // Signature is valid but couldn't fetch payment details
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              message: 'Payment verified successfully'
            }));
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Invalid payment signature' 
          }));
        }
      } catch (error) {
        console.error('Payment Verification Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message || 'Payment verification failed' }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('\x1b[32m✓\x1b[0m API server running on http://localhost:' + PORT);
  console.log('\x1b[36mℹ\x1b[0m Available routes:');
  console.log('  - POST /api/swap-init');
  console.log('  - GET  /api/swap-status?id={predictionId}');
  if (razorpay) {
    console.log('  - POST /api/create-order (Razorpay)');
    console.log('  - POST /api/verify-payment (Razorpay)');
  }
  console.log('\x1b[33m⚠\x1b[0m Run Vite dev server on port 5173 (npm run dev)');
});

