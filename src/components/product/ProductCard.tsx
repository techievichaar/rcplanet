'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/useCart'

interface ProductCardProps {
  product: {
    _id: string
    name: string
    price: number
    images: string[]
    rating: number
    stock: number
    slug: string
  }
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart()

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md">
      <Link href={`/products/${product.slug}`}>
        <div className="aspect-square overflow-hidden">
          <Image
            src={product.images[0]}
            alt={product.name}
            width={500}
            height={500}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="mb-2 text-lg font-semibold hover:text-primary">
            {product.name}
          </h3>
        </Link>

        <div className="mb-2 flex items-center">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
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

        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-primary">
            ${product.price.toFixed(2)}
          </span>
          <Button
            size="sm"
            onClick={() => addToCart(product)}
            disabled={product.stock === 0}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </div>

        {product.stock === 0 && (
          <p className="mt-2 text-sm text-red-500">Out of Stock</p>
        )}
      </div>
    </div>
  )
} 