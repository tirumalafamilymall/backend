import Razorpay from 'razorpay'
import crypto from 'crypto'

export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export function verifyRazorpaySignature(
  razorpay_order_id:  string,
  razorpay_payment_id: string,
  razorpay_signature:  string
): boolean {
  const body = `${razorpay_order_id}|${razorpay_payment_id}`

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')

  return expectedSignature === razorpay_signature
}