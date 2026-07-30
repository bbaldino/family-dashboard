interface Props {
  viewportWidth: number
  minWidth: number
}

export function SmallViewportFallback({ viewportWidth, minWidth }: Props) {
  return (
    <div className="p-6 text-text-primary bg-bg-primary min-h-screen flex flex-col justify-center items-center text-center">
      <h1 className="text-lg font-bold mb-2">Screen too small</h1>
      <p className="text-sm text-text-secondary">
        This theme is best viewed on a larger screen.
        <br />
        Current: <span className="font-mono">{viewportWidth}px</span> · Minimum:{' '}
        <span className="font-mono">{minWidth}px</span>
      </p>
    </div>
  )
}
