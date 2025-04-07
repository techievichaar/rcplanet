import { useState } from 'react'
import { sendEmail } from '@/lib/email'

export default function EmailTest() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  const handleSend = async () => {
    if (!email) return

    setLoading(true)
    try {
      const success = await sendEmail({
        to: email,
        subject: 'Test Email',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email from RC Planet.</p>
          <p>If you received this, the email service is working correctly.</p>
        `,
      })

      setResult(success ? 'Email sent successfully!' : 'Failed to send email')
    } catch (error) {
      console.error('Email error:', error)
      setResult('Error sending email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email address"
        className="mb-4 p-2 border rounded"
      />
      <button
        onClick={handleSend}
        disabled={loading || !email}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Test Email'}
      </button>
      {result && <p className="mt-4">{result}</p>}
    </div>
  )
} 