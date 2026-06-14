// lib/whatsapp.ts
const GRAPH_API_VERSION = 'v19.0';

const getWhatsAppUrl = () => {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID is not defined.');
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
};

const getHeaders = () => {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN is not defined.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

async function sendToMeta(body: object): Promise<{ message_id?: string }> {
  try {
    const res = await fetch(getWhatsAppUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Meta API error:', JSON.stringify(data));
      throw new Error(data?.error?.message ?? `Meta API returned ${res.status}`);
    }

    return { message_id: data?.messages?.[0]?.id };
  } catch (error) {
    console.error("WhatsApp Request Failed:", error);
    return {};
  }
}


function formatPhoneForWhatsApp(phone: string): string {
  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) return cleanPhone;
  if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) return `91${cleanPhone.substring(1)}`;
  if (cleanPhone.length === 10) return `91${cleanPhone}`;
  throw new Error("Invalid Indian phone number format");
}


export async function sendOrderConfirmationWhatsApp(
  phone: string,
  customerName: string,
  orderNumber: string,
  totalAmount: string
) {
  try {
    const validPhone = formatPhoneForWhatsApp(phone);
    return await sendToMeta({
      messaging_product: 'whatsapp',
      to: validPhone,
      type: 'template',
      template: {
        name: 'order_confirmed',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName || 'Valued Customer' },
              { type: 'text', text: orderNumber },
              { type: 'text', text: totalAmount },
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error("Failed to send order confirmation WhatsApp:", error);
  }
}


export async function sendShippingUpdateWhatsApp(
  phone: string,
  orderNumber: string,
  trackingUrl: string
) {
  try {
    const validPhone = formatPhoneForWhatsApp(phone);
    return await sendToMeta({
      messaging_product: 'whatsapp',
      to: validPhone,
      type: 'template',
      template: {
        name: 'order_shipped',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: orderNumber },
              { type: 'text', text: trackingUrl },
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error("Failed to send shipping update WhatsApp:", error);
  }
}



export async function sendAdminOrderWhatsApp(
  orderNumber: string,
  customerName: string,
  customerPhone: string,
  totalAmount: string,
  items: { name: string; quantity: number; size?: string | null; color?: string | null }[]
) {
  try {
    const itemsSummary = items.map(item => 
      `${item.quantity}x ${item.name}${item.size ? ` (${item.size}` : ''}${item.color ? `, ${item.color})` : item.size ? ')' : ''}`
    ).join(', ')

    const adminPhone = '919966248223'

    return await sendToMeta({
      messaging_product: 'whatsapp',
      to: adminPhone,
      type: 'template',
      template: {
        name: 'admin_order_alert',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: orderNumber },
              { type: 'text', text: customerName || 'Customer' },
              { type: 'text', text: customerPhone },
              { type: 'text', text: totalAmount },
              { type: 'text', text: itemsSummary },
            ],
          },
        ],
      },
    })
  } catch (error) {
    console.error('Failed to send admin order WhatsApp:', error)
  }
}