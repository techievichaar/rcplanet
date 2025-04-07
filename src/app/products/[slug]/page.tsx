'use client'

import React from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Star, ShoppingCart, Heart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getProduct } from '@/lib/api'
import { useCart } from '@/hooks/useCart'

export default function ProductPage() {
  const params = useParams()
  const cart = useCart()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', params.slug],
    queryFn: () => getProduct(params.slug as string),
  })

  const [selectedImage, setSelectedImage] = React.useState(0)
  const [quantity, setQuantity] = React.useState(1)

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-lg bg-gray-200" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
      </div>
    )
  }

  function addToCart(arg0: { quantity: number; _id: string; name: string; description: string; price: number; images: string[]; category: string; brand: string; rating: number; stock: number; slug: string; attributes: Record<string, string>; isActive: boolean }): void {
    throw new Error('Function not implemented.')
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Image Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-lg">
            <Image
              src={product.images[selectedImage]}
              alt={product.name}
              width={800}
              height={800}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4">
            {product.images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`aspect-square overflow-hidden rounded-lg ${
                  selectedImage === index ? 'ring-2 ring-primary' : ''
                }`}
              >
                <Image
                  src={image}
                  alt={`${product.name} - ${index + 1}`}
                  width={200}
                  height={200}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <div className="mt-2 flex items-center">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.floor(product.rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="ml-2 text-sm text-gray-500">
                ({product.rating.toFixed(1)})
              </span>
            </div>
          </div>

          <div className="text-3xl font-bold text-primary">
            ${product.price.toFixed(2)}
          </div>

          <p className="text-gray-600">{product.description}</p>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label htmlFor="quantity" className="font-medium">
                Quantity:
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-20 rounded-md border border-gray-300 px-3 py-2"
              />
              <span className="text-sm text-gray-500">
                {product.stock} available
              </span>
            </div>

            <div className="flex gap-4">
              <Button
                size="lg"
                onClick={() => addToCart({ ...product, quantity })}
                disabled={product.stock === 0}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart
              </Button>
              <Button variant="outline" size="lg">
                <Heart className="mr-2 h-5 w-5" />
                Add to Wishlist
              </Button>
            </div>
          </div>

          {/* Product Attributes */}
          <div className="space-y-2">
            <h3 className="font-medium">Product Details</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(product.attributes).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </p>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 