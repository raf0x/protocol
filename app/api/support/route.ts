import { NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || 'support@mypepprotocol.app'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function POST(request: Request) {
  try {
    if (!SENDGRID_API_KEY) {
      console.error('Support email configuration is missing.')
      return NextResponse.json(
        { error: 'Support is temporarily unavailable.' },
        { status: 503 }
      )
    }

    const body = await request.json()

    const name = clean(body.name)
    const email = clean(body.email).toLowerCase()
    const subject = clean(body.subject)
    const message = clean(body.message)
    const website = clean(body.website)

    // Honeypot. Bots commonly fill hidden fields.
    if (website) {
      return NextResponse.json({ ok: true })
    }

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Please complete all fields.' },
        { status: 400 }
      )
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    if (
      name.length > 100 ||
      email.length > 254 ||
      subject.length > 150 ||
      message.length > 5000
    ) {
      return NextResponse.json(
        { error: 'One or more fields are too long.' },
        { status: 400 }
      )
    }

    sgMail.setApiKey(SENDGRID_API_KEY)

    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeSubject = escapeHtml(subject)
    const safeMessage = escapeHtml(message).replaceAll('\n', '<br />')

    await sgMail.send({
      to: SUPPORT_EMAIL,
      from: {
        email: SUPPORT_EMAIL,
        name: 'MyPepProtocol Support',
      },
      replyTo: {
        email,
        name,
      },
      subject: `Support request: ${subject}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        '',
        message,
      ].join('\n'),
      html: `
        <h2>New MyPepProtocol support request</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeMessage}</p>
      `,
    })

    await sgMail.send({
      to: email,
      from: {
        email: SUPPORT_EMAIL,
        name: 'MyPepProtocol Support',
      },
      replyTo: SUPPORT_EMAIL,
      subject: 'We received your MyPepProtocol support request',
      text: [
        `Hi ${name},`,
        '',
        'Thanks for contacting MyPepProtocol Support.',
        '',
        'We received your request and will respond within 24 hours.',
        '',
        'If you have additional information, you can reply directly to this email.',
        '',
        'MyPepProtocol Support',
      ].join('\n'),
      html: `
        <p>Hi ${safeName},</p>
        <p>Thanks for contacting MyPepProtocol Support.</p>
        <p>We received your request and will respond within <strong>24 hours</strong>.</p>
        <p>If you have additional information, you can reply directly to this email.</p>
        <p>MyPepProtocol Support</p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(
      'Support request failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    return NextResponse.json(
      { error: 'Unable to send your request. Please try again.' },
      { status: 500 }
    )
  }
}