'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface CategoryCardProps {
  category: {
    _id: string
    name: string
    image: string
    slug: string
    description: string
  }
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link href={`/categories/${category.slug}`}>
      <div className="group relative overflow-hidden rounded-lg">
        <div className="aspect-[4/3] overflow-hidden">
          <Image
            src={category.image}
            alt={category.name}
            width={600}
            height={450}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h3 className="mb-2 text-2xl font-bold">{category.name}</h3>
          <p className="text-sm opacity-90">{category.description}</p>
        </div>
      </div>
    </Link>
  )
} 