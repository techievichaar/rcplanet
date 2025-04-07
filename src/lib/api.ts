import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.rcplanet.com',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  }
)

export interface Product {
  _id: string
  name: string
  description: string
  price: number
  images: string[]
  category: string
  brand: string
  rating: number
  stock: number
  slug: string
  attributes: Record<string, string>
  isActive: boolean
}

export interface Category {
  _id: string
  name: string
  description: string
  image: string
  slug: string
  isActive: boolean
}

export const getFeaturedProducts = async (): Promise<Product[]> => {
  const response = await api.get('/products/featured')
  return response.data
}

export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get('/categories')
  return response.data
}

export const getProduct = async (slug: string): Promise<Product> => {
  const response = await api.get(`/products/${slug}`)
  return response.data
}

export const getProducts = async (params?: {
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page?: number
  limit?: number
}): Promise<{ products: Product[]; total: number }> => {
  const response = await api.get('/products', { params })
  return response.data
}

export const searchProducts = async (query: string): Promise<Product[]> => {
  const response = await api.get('/products/search', { params: { query } })
  return response.data
}

export const createOrder = async (data: {
  items: Array<{
    product: string
    quantity: number
    price: number
  }>
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  paymentMethod: string
  coupon?: string
}) => {
  const response = await api.post('/orders', data)
  return response.data
}

export const validateCoupon = async (code: string): Promise<{
  valid: boolean
  discount: number
  message: string
}> => {
  const response = await api.post('/coupons/validate', { code })
  return response.data
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
  avatar?: string
  createdAt: string
  updatedAt: string
}

export const login = async (credentials: LoginCredentials) => {
  const response = await api.post<{ token: string; user: User }>(
    '/auth/login',
    credentials
  )
  localStorage.setItem('token', response.data.token)
  return response.data
}

export const register = async (data: RegisterData) => {
  const response = await api.post<{ token: string; user: User }>(
    '/auth/register',
    data
  )
  localStorage.setItem('token', response.data.token)
  return response.data
}

export const logout = () => {
  localStorage.removeItem('token')
  window.location.href = '/auth/login'
}

export const forgotPassword = async (email: string) => {
  await api.post('/auth/forgot-password', { email })
}

export const resetPassword = async (token: string, password: string) => {
  await api.post('/auth/reset-password', { token, password })
}

export const getCurrentUser = async () => {
  const response = await api.get<User>('/users/me')
  return response.data
}

export const updateProfile = async (data: Partial<User>) => {
  const response = await api.put<User>('/users/profile', data)
  return response.data
}

export const changePassword = async (data: {
  currentPassword: string
  newPassword: string
}) => {
  await api.put('/users/change-password', data)
}

export default api 