import { NextResponse } from 'next/server'
import { sendContactMail } from '@/lib/mailer'

// POST /api/contact
// Body: { name, email, phone, message }
// No auth required — public endpoint
export async function POST(req: Request) {
  try {
    const { name, email, phone, message } = await req.json()

    // Validate
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'name, email and message are required' },
        { status: 400 }
      )
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Sanitize — strip HTML tags to prevent injection
    const sanitize = (str: string) =>
      str.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    await sendContactMail({
      senderName:  sanitize(name),
      senderEmail: sanitize(email),
      senderPhone: sanitize(phone || 'Not provided'),
      message:     sanitize(message),
    })

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}