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

/**
 * Normalizes an Indian phone number to exactly 12 digits (91XXXXXXXXXX)
 */
function formatPhoneForWhatsApp(phone: string): string {
  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) return cleanPhone;
  if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) return `91${cleanPhone.substring(1)}`;
  if (cleanPhone.length === 10) return `91${cleanPhone}`;
  throw new Error("Invalid Indian phone number format");
}

/**
 * Sends the Order Confirmation Template.
 * Template: order_confirmed
 * Variables: {{1}} Customer Name, {{2}} Order Number, {{3}} Total Amount
 */
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

/**
 * Sends the Order Shipped/Tracking Template.
 * Template: order_shipped
 * Variables: {{1}} Order Number, {{2}} Tracking URL
 */
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