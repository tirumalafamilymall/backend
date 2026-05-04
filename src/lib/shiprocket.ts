import axios from 'axios'
import { prisma } from '@/lib/prisma'

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external'

let cachedToken: string | null = null
let tokenExpiry: number | null = null

async function getToken(): Promise<string> {
  const now = Date.now()

  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken
  }

  const res = await axios.post(`${BASE_URL}/auth/login`, {
    email:    process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  })

  cachedToken = res.data.token
  tokenExpiry = now + 23 * 60 * 60 * 1000
  return cachedToken!
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function createShiprocketOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: { items: true, user: true },
  })

  if (!order) throw new Error('Order not found')
  if (order.payment_status !== 'PAID') throw new Error('Order not paid')

  const address = order.shipping_address as any
  const token   = await getToken()

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
    billing_phone:          address.phone,
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

  const res = await axios.post(`${BASE_URL}/orders/create/adhoc`, payload, {
    headers: authHeaders(token),
  })

  return res.data
}

export async function generateAWB(shipmentId: string) {
  const token = await getToken()

  const res = await axios.post(
    `${BASE_URL}/courier/assign/awb`,
    { shipment_id: shipmentId },
    { headers: authHeaders(token) }
  )

  return res.data
}

export async function trackShipment(orderId: string) {
  const token = await getToken()

  const res = await axios.get(
    `${BASE_URL}/courier/track/shipment/${orderId}`,
    { headers: authHeaders(token) }
  )

  return res.data
}

export async function cancelShiprocketOrder(ids: number[]) {
  const token = await getToken()

  const res = await axios.post(
    `${BASE_URL}/orders/cancel`,
    { ids },
    { headers: authHeaders(token) }
  )

  return res.data
}

export async function schedulePickup(shipmentId: string) {
  const token = await getToken()

  const res = await axios.post(
    `${BASE_URL}/courier/generate/pickup`,
    { shipment_id: [shipmentId] },
    { headers: authHeaders(token) }
  )

  return res.data
}

export async function generateLabel(shipmentId: string) {
  const token = await getToken()

  const res = await axios.post(
    `${BASE_URL}/courier/generate/label`,
    { shipment_id: [shipmentId] },
    { headers: authHeaders(token) }
  )

  return res.data
}

export async function generateManifest(shipmentId: string) {
  const token = await getToken()

  const res = await axios.post(
    `${BASE_URL}/manifests/generate`,
    { shipment_id: [shipmentId] },
    { headers: authHeaders(token) }
  )

  return res.data
}

export async function checkServiceability(
  pickupPostcode:   string,
  deliveryPostcode: string,
  weight:           number = 0.5,
  cod:              boolean = false
) {
  const token = await getToken()

  const res = await axios.get(`${BASE_URL}/courier/serviceability`, {
    params: {
      pickup_postcode:   pickupPostcode,
      delivery_postcode: deliveryPostcode,
      weight,
      cod: cod ? 1 : 0,
    },
    headers: authHeaders(token),
  })

  return res.data
}