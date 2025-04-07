'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'react-hot-toast'

interface CartItem {
  _id: string
  name: string
  price: number
  image: string
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const currentItems = get().items
        const existingItem = currentItems.find((i) => i._id === item._id)

        if (existingItem) {
          set({
            items: currentItems.map((i) =>
              i._id === item._id
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          })
          toast.success('Item quantity updated')
        } else {
          set({ items: [...currentItems, { ...item, quantity: 1 }] })
          toast.success('Item added to cart')
        }
      },
      removeItem: (id) => {
        set({ items: get().items.filter((item) => item._id !== id) })
        toast.success('Item removed from cart')
      },
      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
          return
        }

        set({
          items: get().items.map((item) =>
            item._id === id ? { ...item, quantity } : item
          ),
        })
      },
      clearCart: () => {
        set({ items: [] })
        toast.success('Cart cleared')
      },
      totalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },
      totalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        )
      },
    }),
    {
      name: 'cart-storage',
    }
  )
) 