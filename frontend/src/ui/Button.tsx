import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-[var(--radius-button)] transition-all active:scale-95 disabled:opacity-50'
  const variants = {
    primary: 'bg-calendar text-white hover:opacity-90',
    secondary: 'bg-bg-card-hover text-text-primary border border-border',
    ghost: 'text-text-secondary hover:bg-bg-card-hover',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[48px]',
    lg: 'px-6 py-3 text-lg min-h-[56px]',
  }
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>
}
