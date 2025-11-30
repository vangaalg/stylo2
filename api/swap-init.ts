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
        version: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
        input: {
          swap_image: sourceImage,
          input_image: targetImage
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Replicate API Error:", response.status, errText);
      return res.status(response.status).json({ error: `Replicate Error: ${errText}` });
    }

    const prediction = await response.json();
    return res.status(201).json(prediction);

  } catch (error: any) {
    console.error("Swap Init Handler Error:", error);
    return res.status(500).json({ error: `Internal Handler Error: ${error.message}` });
  }
}
