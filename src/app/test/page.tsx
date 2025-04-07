import ImageUpload from '@/components/test/ImageUpload'
import EmailTest from '@/components/test/EmailTest'

export default function TestPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-8">Integration Tests</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Cloudinary Image Upload</h2>
          <ImageUpload />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">SendGrid Email Test</h2>
          <EmailTest />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Stripe Payment Test</h2>
          <p className="text-gray-600">
            To test Stripe payments, use the test card number: 4242 4242 4242 4242
          </p>
          <p className="text-gray-600">
            Any future date for expiry, any 3 digits for CVC, and any postal code.
          </p>
        </section>
      </div>
    </div>
  )
} 