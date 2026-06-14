import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// Existing contact mail — keep as is
export async function sendContactMail({
  senderName, senderEmail, senderPhone, message,
}: {
  senderName: string, senderEmail: string, senderPhone: string, message: string
}) {
  await transporter.sendMail({
    from:    `"TFM Website" <${process.env.GMAIL_USER}>`,
    to:      process.env.GMAIL_USER,
    replyTo: senderEmail,
    subject: `New Contact Message from ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>New Contact Form Message</h2>
        <p><strong>Name:</strong> ${senderName}</p>
        <p><strong>Email:</strong> ${senderEmail}</p>
        <p><strong>Phone:</strong> ${senderPhone}</p>
        <p><strong>Message:</strong> ${message}</p>
      </div>
    `,
  })
}

// Order confirmation email
export async function sendOrderConfirmationMail({
  customerEmail,
  customerName,
  orderNumber,
  items,
  totalAmount,
  shippingAddress,
}: {
  customerEmail:   string
  customerName:    string
  orderNumber:     string
  items:           any[]
  totalAmount:     number
  shippingAddress: any
}) {
  const itemsHtml = items.map((item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price * item.quantity}</td>
    </tr>
  `).join('')

  await transporter.sendMail({
    from:    `"Tirumala Family Mall" <${process.env.GMAIL_USER}>`,
    to:      customerEmail,
    subject: `Order Confirmed — ${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Tirumala Family Mall</h1>
        </div>

        <div style="padding: 24px;">
          <h2>Thank you, ${customerName}! 🎉</h2>
          <p>Your order has been confirmed. Here's a summary:</p>

          <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
            <strong>Order Number:</strong> ${orderNumber}
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 8px; text-align: left;">Product</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Price</th>
                <th style="padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 8px; text-align: right;"><strong>Total Amount</strong></td>
                <td style="padding: 8px; text-align: right;"><strong>₹${totalAmount}</strong></td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 24px;">
            <h3>Shipping To:</h3>
            <p style="margin: 0;">${shippingAddress.name}</p>
            <p style="margin: 0;">${shippingAddress.address}</p>
            <p style="margin: 0;">${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pincode}</p>
            <p style="margin: 0;">Phone: ${shippingAddress.phone}</p>
          </div>

          <p style="margin-top: 24px; color: #666;">
            We'll notify you once your order is shipped. For any queries, 
            reply to this email or contact us at ${process.env.GMAIL_USER}.
          </p>
        </div>
      </div>
    `,
  })
}

// Shipping notification email
export async function sendShippingMail({
  customerEmail,
  customerName,
  orderNumber,
  trackingUrl,
}: {
  customerEmail: string
  customerName:  string
  orderNumber:   string
  trackingUrl:   string
}) {
  await transporter.sendMail({
    from:    `"Tirumala Family Mall" <${process.env.GMAIL_USER}>`,
    to:      customerEmail,
    subject: `Your Order ${orderNumber} Has Been Shipped! 🚚`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Tirumala Family Mall</h1>
        </div>

        <div style="padding: 24px;">
          <h2>Your order is on the way, ${customerName}! 🎁</h2>

          <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
            <strong>Order Number:</strong> ${orderNumber}
          </div>

          <p>Great news! Your order has been shipped and is on its way to you.</p>

          ${trackingUrl ? `
            <a href="${trackingUrl}" 
               style="display: inline-block; background: #1a1a1a; color: white; 
                      padding: 12px 24px; border-radius: 6px; text-decoration: none;
                      margin: 16px 0;">
              Track Your Order
            </a>
          ` : ''}

          <p style="color: #666; margin-top: 24px;">
            For any queries, contact us at ${process.env.GMAIL_USER}.
          </p>
        </div>
      </div>
    `,
  })
}


export async function sendAdminOrderMail({
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  items,
  totalAmount,
  shippingAddress,
}: {
  orderNumber:     string
  customerName:    string
  customerEmail:   string
  customerPhone:   string
  items:           any[]
  totalAmount:     number
  shippingAddress: any
}) {
  const itemsHtml = items.map((item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.size || '—'} / ${item.color || '—'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${Number(item.price * item.quantity).toLocaleString('en-IN')}</td>
    </tr>
  `).join('')

  await transporter.sendMail({
    from:    `"TFM Orders" <${process.env.GMAIL_USER}>`,
    to:      'tirumalafamilymall@gmail.com',
    subject: `🛍️ New Order Received — ${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #CC0000; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">New Order Alert 🛍️</h1>
        </div>

        <div style="padding: 24px;">
          <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px 0;">Order ${orderNumber}</h2>
            <p style="margin: 0; color: #666;">Payment confirmed and shipment auto-scheduled.</p>
          </div>

          <h3>Customer Details</h3>
          <p style="margin: 4px 0;"><strong>Name:</strong> ${customerName}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${customerEmail}</p>
          <p style="margin: 4px 0;"><strong>Phone:</strong> ${customerPhone}</p>

          <h3 style="margin-top: 20px;">Shipping Address</h3>
          <p style="margin: 4px 0;">${shippingAddress.name}</p>
          <p style="margin: 4px 0;">${shippingAddress.address}</p>
          <p style="margin: 4px 0;">${shippingAddress.city}, ${shippingAddress.state} — ${shippingAddress.pincode}</p>
          <p style="margin: 4px 0;">📞 ${shippingAddress.phone}</p>

          <h3 style="margin-top: 20px;">Items Ordered</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 8px; text-align: left;">Product</th>
                <th style="padding: 8px; text-align: center;">Size / Color</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 12px 8px; text-align: right; font-size: 16px;"><strong>Total Paid</strong></td>
                <td style="padding: 12px 8px; text-align: right; font-size: 16px; color: #CC0000;"><strong>₹${Number(totalAmount).toLocaleString('en-IN')}</strong></td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 24px; padding: 12px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #CC0000;">
            <p style="margin: 0; font-size: 13px;">⚡ Shiprocket pickup has been auto-scheduled. Log in to admin panel to print the shipping label.</p>
          </div>
        </div>
      </div>
    `,
  })
}