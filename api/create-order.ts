import Razorpay from 'razorpay';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for keys
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("Razorpay keys are missing in environment variables.");
    // Return a specific error code or message
    return res.status(503).json({ 
      error: 'Payment gateway is currently under maintenance (Missing Keys). Please try again later or contact support.' 
    });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const { amount, currency } = req.body;

  if (!amount || !currency) {
    return res.status(400).json({ error: 'Amount and currency are required' });
  }

  try {
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error: any) {
    console.error('Razorpay Order Error:', error);
    res.status(500).json({ error: error.message || 'Something went wrong with the payment provider' });
  }
}