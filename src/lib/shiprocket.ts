import axios from 'axios'
import { prisma } from '@/lib/prisma'

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external'

// 🔥 ADDED: forceRefresh parameter to bypass the poisoned cache
async function getToken(forceRefresh = false): Promise<string> {
  const now = Date.now()

  // 1. Check PostgreSQL database for existing token (unless forcing refresh)
  if (!forceRefresh) {
    const dbToken = await prisma.systemSetting.findUnique({ where: { key: 'SHIPROCKET_TOKEN' } })
    const dbExpiry = await prisma.systemSetting.findUnique({ where: { key: 'SHIPROCKET_EXPIRY' } })

    if (dbToken && dbExpiry && now < Number(dbExpiry.value)) {
      return dbToken.value
    }
  }

  console.log("🚀 Generating FRESH Shiprocket Token...");

  // 2. Fetch new one from Shiprocket
  const res = await axios.post(`${BASE_URL}/auth/login`, {
    email:    process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  })

  const newToken = res.data.token
  const newExpiry = (now + 23 * 60 * 60 * 1000).toString() // 23 hours

  // 3. Save to database so all Vercel serverless instances share it
  await prisma.systemSetting.upsert({
    where: { key: 'SHIPROCKET_TOKEN' },
    update: { value: newToken },
    create: { key: 'SHIPROCKET_TOKEN', value: newToken }
  })
  
  await prisma.systemSetting.upsert({
    where: { key: 'SHIPROCKET_EXPIRY' },
    update: { value: newExpiry },
    create: { key: 'SHIPROCKET_EXPIRY', value: newExpiry }
  })

  return newToken
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function formatPhoneForShiprocket(phone: string): string {
  const clean = String(phone).replace(/\D/g, '') // Remove all non-digits
  if (clean.length === 12 && clean.startsWith('91')) return clean.substring(2)
  if (clean.length === 11 && clean.startsWith('0')) return clean.substring(1)
  if (clean.length === 10) return clean
  return clean.slice(-10) // Fallback: take last 10 digits
}

export async function createShiprocketOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: { items: true, user: true },
  })

  if (!order) throw new Error('Order not found')
  if (order.payment_status !== 'PAID') throw new Error('Order not paid')

  const address = order.shipping_address as any
  let token   = await getToken()

  const payload = {
    order_id:               order.order_number,
    order_date:             order.created_at.toISOString().split('T')[0],
    pickup_location:        'home',
    channel_id:             '',
    comment:                order.notes || '',
    billing_customer_name:  address.name,
    billing_last_name:      '',
    billing_address:        address.address,
    billing_city:           address.city,
    billing_pincode:        address.pincode,
    billing_state:          address.state,
    billing_country:        'India',
    billing_email:          order.user.email || '',
    billing_phone: formatPhoneForShiprocket(address.phone),
    shipping_is_billing:    true,
    order_items: order.items.map((item) => ({
      name:          item.name,
      sku:           item.product_code,
      units:         item.quantity,
      selling_price: item.price,
      discount:      0,
      tax:           0,
      hsn:           '',
    })),
    payment_method: 'Prepaid',
    sub_total:      order.total_amount,
    length:         10,
    breadth:        10,
    height:         10,
    weight:         0.5,
  }

  try {
    const res = await axios.post(`${BASE_URL}/orders/create/adhoc`, payload, {
      headers: authHeaders(token),
    })
    return res.data
  } catch (error: any) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("⚠️ Shiprocket token rejected. Auto-healing and retrying...");
      token = await getToken(true); 
      const retryRes = await axios.post(`${BASE_URL}/orders/create/adhoc`, payload, { headers: authHeaders(token) })
      return retryRes.data;
    }
    throw error;
  }
}

export async function generateAWB(shipmentId: string) {
  let token = await getToken()
  try {
    const res = await axios.post(`${BASE_URL}/courier/assign/awb`, { shipment_id: shipmentId }, { headers: authHeaders(token) })
    return res.data
  } catch (error: any) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      token = await getToken(true);
      const retryRes = await axios.post(`${BASE_URL}/courier/assign/awb`, { shipment_id: shipmentId }, { headers: authHeaders(token) })
      return retryRes.data;
    }
    throw error;
  }
}

export async function trackShipment(orderId: string) {
  let token = await getToken()
  try {
    const res = await axios.get(`${BASE_URL}/courier/track/shipment/${orderId}`, { headers: authHeaders(token) })
    return res.data
  } catch (error: any) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      token = await getToken(true);
      const retryRes = await axios.get(`${BASE_URL}/courier/track/shipment/${orderId}`, { headers: authHeaders(token) })
      return retryRes.data;
    }
    throw error;
  }
}

export async function cancelShiprocketOrder(ids: number[]) {
  const token = await getToken()
  const res = await axios.post(`${BASE_URL}/orders/cancel`, { ids }, { headers: authHeaders(token) })
  return res.data
}

export async function schedulePickup(shipmentId: string) {
  let token = await getToken()
  try {
    const res = await axios.post(`${BASE_URL}/courier/generate/pickup`, { shipment_id: [shipmentId] }, { headers: authHeaders(token) })
    return res.data
  } catch (error: any) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      token = await getToken(true);
      const retryRes = await axios.post(`${BASE_URL}/courier/generate/pickup`, { shipment_id: [shipmentId] }, { headers: authHeaders(token) })
      return retryRes.data;
    }
    throw error;
  }
}

export async function generateLabel(shipmentId: string) {
  try {
    const token = await getToken()
    const res = await axios.post(`${BASE_URL}/courier/generate/label`, { shipment_id: [shipmentId] }, { headers: authHeaders(token) })
    return res.data
  } catch (error: any) {
    console.error('generateLabel failed:', error?.response?.data || error?.message || error)
    throw error
  }
}

export async function generateManifest(shipmentId: string) {
  const token = await getToken()
  // Try to generate — if already generated, fetch the existing one
  try {
    const res = await axios.post(`${BASE_URL}/manifests/generate`, { shipment_id: [shipmentId] }, { headers: authHeaders(token) })
    return res.data
  } catch (error: any) {
    if (error.response?.data?.status_code === 400 && error.response?.data?.message?.includes('already generated')) {
      // Manifest already exists — fetch it
      const fetchRes = await axios.get(`${BASE_URL}/manifests/print`, {
        params: { shipment_id: shipmentId },
        headers: authHeaders(token)
      })
      return fetchRes.data
    }
    throw error
  }
}

export async function checkServiceability(
  pickupPostcode:   string,
  deliveryPostcode: string,
  weight:           number = 0.5,
  cod:              boolean = false
) {
  let token = await getToken()

  const makeRequest = (authToken: string) => axios.get(`${BASE_URL}/courier/serviceability`, {
    params: { pickup_postcode: pickupPostcode, delivery_postcode: deliveryPostcode, weight, cod: cod ? 1 : 0 },
    headers: authHeaders(authToken),
  });

  try {
    const res = await makeRequest(token);
    return res.data;
  } catch (error: any) {
    // 🔥 THE MAGIC FIX: If the cached token is dead, force a refresh and try again instantly
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("⚠️ Shiprocket token rejected (403/401). Auto-healing...");
      token = await getToken(true); // Bypass the DB cache
      const retryRes = await makeRequest(token);
      return retryRes.data;
    }
    throw error;
  }
}