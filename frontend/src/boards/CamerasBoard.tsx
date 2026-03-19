export function CamerasBoard() {
  return (
    <div className="h-full">
      <iframe
        src="https://cast.baldino.me/webrtc-doorbell.html"
        className="w-full h-full border-0"
        allow="autoplay; camera; microphone"
      />
    </div>
  )
}
