import { NextResponse } from 'next/server'

export async function GET() {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: '8074271503',
      type: 'template',
      template: {
        name: 'admin_order_alert',
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: 'TFM-TEST-1234' },
            { type: 'text', text: 'Test Customer' },
            { type: 'text', text: '9999999999' },
            { type: 'text', text: '₹999' },
            { type: 'text', text: '1x Test Product' },
          ],
        }],
      },
    }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}