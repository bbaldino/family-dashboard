import { useState, useEffect } from 'react'

export function ClockWidget() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="text-[42px] font-extralight tracking-[-2px] leading-none text-text-primary">
        {time}
      </div>
      <div className="text-[14px] text-text-secondary mt-1">{date}</div>
    </div>
  )
}
