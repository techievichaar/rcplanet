'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resetPassword } from '@/lib/api'
import { toast } from 'react-hot-toast'

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error('Invalid reset token')
      return
    }

    try {
      await resetPassword(token, data.password)
      toast.success('Password reset successfully!')
      router.push('/auth/login')
    } catch (error) {
      toast.error('Failed to reset password. Please try again.')
    }
  }

  if (!token) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center py-8">
        <div className="w-full max-w-md space-y-8 rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Reset Link</h1>
          <p className="text-gray-600">
            The password reset link is invalid or has expired.
          </p>
          <Button
            onClick={() => router.push('/auth/forgot-password')}
            className="w-full"
          >
            Request New Reset Link
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center py-8">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-gray-600">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              New Password
            </label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              className="mt-1"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm New Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="mt-1"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resetting password...' : 'Reset password'}
          </Button>
        </form>
      </div>
    </div>
  )
} 