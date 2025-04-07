'use client'

import React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ProductCard } from '@/components/product/ProductCard'
import { getProducts, getCategories } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const category = searchParams.get('category') || ''
  const brand = searchParams.get('brand') || ''
  const minPrice = Number(searchParams.get('minPrice')) || 0
  const maxPrice = Number(searchParams.get('maxPrice')) || 1000
  const sort = searchParams.get('sort') || 'newest'

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', { page, category, brand, minPrice, maxPrice, sort }],
    queryFn: () =>
      getProducts({
        page,
        category,
        brand,
        minPrice,
        maxPrice,
        sort,
        limit: 12,
      }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const handleFilterChange = (key: string, value: string | number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, String(value))
    params.set('page', '1')
    router.push(`/products?${params.toString()}`)
  }

  const handlePriceChange = (values: number[]) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('minPrice', String(values[0]))
    params.set('maxPrice', String(values[1]))
    params.set('page', '1')
    router.push(`/products?${params.toString()}`)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Filters */}
        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg font-semibold">Categories</h3>
            <div className="space-y-2">
              {categories?.map((cat) => (
                <div key={cat._id} className="flex items-center">
                  <Checkbox
                    id={cat._id}
                    checked={category === cat._id}
                    onCheckedChange={(checked) =>
                      handleFilterChange('category', checked ? cat._id : '')
                    }
                  />
                  <label
                    htmlFor={cat._id}
                    className="ml-2 text-sm text-gray-700"
                  >
                    {cat.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Price Range</h3>
            <Slider
              min={0}
              max={1000}
              step={10}
              value={[minPrice, maxPrice]}
              onValueChange={handlePriceChange}
            />
            <div className="mt-2 flex justify-between text-sm text-gray-600">
              <span>${minPrice}</span>
              <span>${maxPrice}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Sort By</h3>
            <Select
              value={sort}
              onValueChange={(value) => handleFilterChange('sort', value)}
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </Select>
          </div>
        </div>

        {/* Products */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-[400px] animate-pulse rounded-lg bg-gray-200"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {productsData?.products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {productsData?.total > 12 && (
                <div className="mt-8 flex justify-center">
                  <div className="flex gap-2">
                    {Array.from(
                      { length: Math.ceil(productsData.total / 12) },
                      (_, i) => i + 1
                    ).map((pageNum) => (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? 'default' : 'outline'}
                        onClick={() => handleFilterChange('page', pageNum)}
                      >
                        {pageNum}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
} 