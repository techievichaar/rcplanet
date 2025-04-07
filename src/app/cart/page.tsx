'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/useCart'
import { createOrder } from '@/lib/api'
import { toast } from 'react-hot-toast'

export default function CartPage() {
  const router = useRouter()
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart()

  const handleCheckout = async () => {
    try {
      const order = await createOrder({
        items: items.map((item) => ({
          product: item._id,
          quantity: item.quantity,
          price: item.price,
        })),
        shippingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
        paymentMethod: 'credit_card',
      })

      clearCart()
      router.push(`/orders/${order._id}`)
      toast.success('Order placed successfully!')
    } catch (error) {
      toast.error('Failed to place order. Please try again.')
    }
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="mb-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mb-8 text-gray-600">
          Looks like you haven't added any items to your cart yet.
        </p>
        <Button asChild>
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-2xl font-bold">Shopping Cart</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item._id}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <div className="relative h-24 w-24 overflow-hidden rounded-lg">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-gray-500">
                    ${item.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateQuantity(item._id, item.quantity - 1)
                    }
                    className="rounded-md border px-2 py-1"
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() =>
                      updateQuantity(item._id, item.quantity + 1)
                    }
                    className="rounded-md border px-2 py-1"
                  >
                    +
                  </button>
                </div>
                <div className="text-lg font-semibold">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
                <button
                  onClick={() => removeItem(item._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-xl font-bold">Order Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal ({totalItems()} items)</span>
                <span>${totalPrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${(totalPrice() * 0.1).toFixed(2)}</span>
              </div>
              <div className="my-4 border-t" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>
                  ${(totalPrice() * 1.1).toFixed(2)}
                </span>
              </div>
            </div>
            <Button
              size="lg"
              className="mt-6 w-full"
              onClick={handleCheckout}
            >
              Proceed to Checkout
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={clearCart}
          >
            Clear Cart
          </Button>
        </div>
      </div>
    </div>
  )
} 