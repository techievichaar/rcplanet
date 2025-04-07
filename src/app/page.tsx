'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product/ProductCard'
import { CategoryCard } from '@/components/category/CategoryCard'
import { useQuery } from '@tanstack/react-query'
import { getFeaturedProducts, getCategories } from '@/lib/api'

export default function HomePage() {
  const { data: featuredProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['featuredProducts'],
    queryFn: getFeaturedProducts,
  })

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="relative h-[600px] overflow-hidden">
        <Image
          src="/images/hero-bg.jpg"
          alt="RC Planat Hero"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container relative mx-auto flex h-full items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl text-white"
          >
            <h1 className="mb-4 text-5xl font-bold">
              Experience the Thrill of RC
            </h1>
            <p className="mb-8 text-xl">
              Discover our premium collection of remote control vehicles and
              accessories. Quality, performance, and endless fun.
            </p>
            <Button size="lg" asChild>
              <Link href="/products">Shop Now</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto">
        <h2 className="mb-8 text-3xl font-bold">Featured Products</h2>
        {productsLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[400px] animate-pulse rounded-lg bg-gray-200"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts?.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="container mx-auto">
        <h2 className="mb-8 text-3xl font-bold">Shop by Category</h2>
        {categoriesLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-[300px] animate-pulse rounded-lg bg-gray-200"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories?.map((category) => (
              <CategoryCard key={category._id} category={category} />
            ))}
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section className="bg-primary py-16">
        <div className="container mx-auto text-center text-white">
          <h2 className="mb-4 text-3xl font-bold">
            Subscribe to Our Newsletter
          </h2>
          <p className="mb-8 text-lg">
            Stay updated with our latest products and exclusive offers.
          </p>
          <form className="mx-auto flex max-w-md gap-4">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-lg border-0 bg-white/10 px-4 py-2 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <Button type="submit" variant="secondary">
              Subscribe
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
} 