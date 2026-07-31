export function Home() {
  return (
    <div
      data-testid="broadsheet-home"
      className="broadsheet-root w-[1600px] h-[900px] flex items-center justify-center"
    >
      <span className="text-6xl italic" style={{ fontFamily: 'var(--font-display)' }}>
        Broadsheet
      </span>
    </div>
  )
}
