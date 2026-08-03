import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-text-primary bg-bg-primary min-h-screen">
          <h1 className="text-lg font-bold mb-2">Screen failed to load</h1>
          <p className="text-sm text-text-secondary mb-4">{this.state.error.message}</p>
          <button className="text-sm underline text-text-primary" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
