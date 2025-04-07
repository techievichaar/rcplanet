import { useState } from 'react'
import { uploadImage } from '@/lib/cloudinary'

export default function ImageUpload() {
  const [image, setImage] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const result = await uploadImage(file)
      setImage(result.secure_url)
      console.log('Upload successful:', result)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={loading}
        className="mb-4"
      />
      {loading && <p>Uploading...</p>}
      {image && (
        <div>
          <p>Uploaded Image:</p>
          <img src={image} alt="Uploaded" className="max-w-xs mt-2" />
        </div>
      )}
    </div>
  )
} 