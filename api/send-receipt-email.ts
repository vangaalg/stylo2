export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    email, 
    userName, 
    paymentId, 
    orderId, 
    amount, 
    credits, 
    packageName,
    websiteUrl 
  } = req.body;

  if (!email || !paymentId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check for Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error("Resend API key is missing");
    return res.status(503).json({ 
      error: 'Email service is currently unavailable. Please contact support.' 
    });
  }

  try {
    // Generate payment links for all packages
    const paymentLinks = {
      single: `${websiteUrl || 'https://stylo2.vercel.app'}#payment-single`,
      mini: `${websiteUrl || 'https://stylo2.vercel.app'}#payment-mini`,
      starter: `${websiteUrl || 'https://stylo2.vercel.app'}#payment-starter`,
      pro: `${websiteUrl || 'https://stylo2.vercel.app'}#payment-pro`
    };

    // Create email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - StyleGenie</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">StyleGenie AI</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">Thank You for Your Purchase!</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${userName || 'Valued Customer'},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Thank you for your purchase! Your payment has been successfully processed and your credits have been added to your account.
              </p>
              
              <!-- Receipt Card -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px; font-weight: 600;">Payment Receipt</h2>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Package:</td>
                    <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${packageName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Amount Paid:</td>
                    <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">₹${amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Credits Added:</td>
                    <td style="color: #6366f1; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">+${credits}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Payment ID:</td>
                    <td style="color: #111827; font-size: 12px; font-family: monospace; text-align: right; padding: 8px 0;">${paymentId}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Order ID:</td>
                    <td style="color: #111827; font-size: 12px; font-family: monospace; text-align: right; padding: 8px 0;">${orderId}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Status:</td>
                    <td style="color: #10b981; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">✓ Completed</td>
                  </tr>
                </table>
              </div>
              
              <!-- Payment Links Section -->
              <div style="margin: 40px 0 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600;">Need More Credits?</h3>
                <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">Choose from our packages:</p>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                  <tr>
                    <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;">
                      <a href="${paymentLinks.single}" style="color: #6366f1; text-decoration: none; font-weight: 600; font-size: 14px;">Single Look - ₹1 (4 Credits)</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;">
                      <a href="${paymentLinks.mini}" style="color: #6366f1; text-decoration: none; font-weight: 600; font-size: 14px;">Trial Pack - ₹149 (8 Credits)</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;">
                      <a href="${paymentLinks.starter}" style="color: #6366f1; text-decoration: none; font-weight: 600; font-size: 14px;">Starter Pack - ₹999 (54 Credits)</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
                      <a href="${paymentLinks.pro}" style="color: #6366f1; text-decoration: none; font-weight: 600; font-size: 14px;">Pro Pack - ₹1500 (102 Credits)</a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${websiteUrl || 'https://stylo2.vercel.app'}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Start Creating Styles</a>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6; text-align: center;">
                If you have any questions, please contact our support team.<br>
                This is an automated email, please do not reply.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} StyleGenie AI. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email using Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StyleGenie <onboarding@resend.dev>', // Use Resend test domain, update with your verified domain for production
        to: email,
        subject: `Payment Receipt - ${packageName} | StyleGenie AI`,
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API Error:', data);
      throw new Error(data.message || 'Failed to send email');
    }

    res.status(200).json({ 
      success: true, 
      messageId: data.id,
      message: 'Email sent successfully' 
    });
  } catch (error: any) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to send email' 
    });
  }
}

