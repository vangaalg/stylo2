// Local development API server to handle Replicate API calls
// This solves CORS issues when running locally

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const PORT = 3001;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN || REPLICATE_API_TOKEN === 'your_replicate_api_token_here') {
  console.error('❌ REPLICATE_API_TOKEN not found in .env.local');
  process.exit(1);
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

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('\x1b[32m✓\x1b[0m API server running on http://localhost:' + PORT);
  console.log('\x1b[36mℹ\x1b[0m Available routes:');
  console.log('  - POST /api/swap-init');
  console.log('  - GET  /api/swap-status?id={predictionId}');
  console.log('\x1b[33m⚠\x1b[0m Run Vite dev server on port 5173 (npm run dev)');
});

