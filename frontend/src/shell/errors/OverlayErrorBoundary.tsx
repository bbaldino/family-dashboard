import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
}

export class OverlayErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('Overlay crashed (silently unmounted):', error, info.componentStack)
  }

  render() {
    return this.state.crashed ? null : this.props.children
  }
}
