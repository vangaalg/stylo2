// This file should be placed in the /api directory of your Vercel project
// It acts as a secure proxy to Replicate

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sourceImage, targetImage } = req.body;
  
  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'Server misconfiguration: No API Token' });
  }

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: process.env.REPLICATE_MODEL_VERSION || "9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d",
        input: {
          source_image: sourceImage,
          target_image: targetImage,
          swap_image: targetImage
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const prediction = await response.json();
    return res.status(201).json(prediction);

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
