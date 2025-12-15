import Razorpay from 'razorpay';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for keys
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("Razorpay keys are missing in environment variables.");
    return res.status(503).json({ 
      error: 'Payment verification is currently unavailable (Missing Keys). Please try again later or contact support.' 
    });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details' });
  }

  try {
    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    const isSignatureValid = generated_signature === razorpay_signature;

    if (isSignatureValid) {
      // Optionally fetch payment details from Razorpay
      try {
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        
        res.status(200).json({ 
          success: true, 
          payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            order_id: payment.order_id
          }
        });
      } catch (fetchError: any) {
        // Signature is valid but couldn't fetch payment details
        console.warn('Payment signature valid but could not fetch payment details:', fetchError);
        res.status(200).json({ 
          success: true, 
          message: 'Payment verified successfully'
        });
      }
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid payment signature' 
      });
    }
  } catch (error: any) {
    console.error('Payment Verification Error:', error);
    res.status(500).json({ error: error.message || 'Payment verification failed' });
  }
}

