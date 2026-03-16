export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="w-6 h-6 border-2 border-border border-t-calendar rounded-full animate-spin" />
    </div>
  )
}
