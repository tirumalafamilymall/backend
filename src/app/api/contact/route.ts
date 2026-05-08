import { NextResponse } from 'next/server'
import { sendContactMail } from '@/lib/mailer'

export async function POST(req: Request) {
  try {
    const { name, email, phone, message } = await req.json()

    // Validate (Email is no longer strictly required)
    if (!name || !message) {
      return NextResponse.json(
        { error: 'Name and message are required' },
        { status: 400 }
      )
    }

    // Only run Regex check IF an email was actually provided
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        )
      }
    }

    // Sanitize — strip HTML tags to prevent injection
    const sanitize = (str: string) =>
      str.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    await sendContactMail({
      senderName:  sanitize(name),
      senderEmail: sanitize(email || 'No email provided'), // Fallback added
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