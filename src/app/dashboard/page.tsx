'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { User, Package, MapPin, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import getOrders from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
  })

  const menuItems = [
    {
      title: 'Profile',
      icon: User,
      href: '/dashboard/profile',
    },
    {
      title: 'Orders',
      icon: Package,
      href: '/dashboard/orders',
    },
    {
      title: 'Addresses',
      icon: MapPin,
      href: '/dashboard/addresses',
    },
    {
      title: 'Payment Methods',
      icon: CreditCard,
      href: '/dashboard/payment',
    },
  ]

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        {/* Sidebar */}
        <div className="space-y-4">
          {menuItems.map((item) => (
            <Button
              key={item.title}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => router.push(item.href)}
            >
              <item.icon className="mr-2 h-5 w-5" />
              {item.title}
            </Button>
          ))}
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-xl font-bold">Recent Orders</h2>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-lg bg-gray-200"
                  />
                ))}
              </div>
            ) : !orders || !Array.isArray(orders) || orders.length === 0 ? (
              <p className="text-gray-600">No orders yet.</p>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 3).map((order: any) => (
                  <div
                    key={order._id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">
                        Order #{order._id.slice(-6)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${order.total.toFixed(2)}
                      </p>
                      <p
                        className={`text-sm ${
                          order.status === 'completed'
                            ? 'text-green-600'
                            : order.status === 'processing'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {order.status.charAt(0).toUpperCase() +
                          order.status.slice(1)}
                      </p>
                    </div>
                  </div>
                ))}
                {orders && orders.length > 3 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard/orders')}
                  >
                    View All Orders
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-6">
              <h3 className="mb-4 text-lg font-semibold">
                Account Information
              </h3>
              <p className="text-gray-600">
                Manage your account settings and preferences.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/dashboard/profile')}
              >
                Edit Profile
              </Button>
            </div>

            <div className="rounded-lg border p-6">
              <h3 className="mb-4 text-lg font-semibold">
                Shipping Addresses
              </h3>
              <p className="text-gray-600">
                Manage your shipping addresses for faster checkout.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/dashboard/addresses')}
              >
                Manage Addresses
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 