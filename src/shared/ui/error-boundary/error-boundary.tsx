import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Typography } from '@mui/material'
import i18n from 'i18next'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <Typography variant="h5" className="text-ui-06">
            {i18n.t('errors.somethingWentWrong')}
          </Typography>
          {this.state.error && (
            <Typography
              variant="body2"
              className="max-w-md text-center text-support-01"
            >
              {this.state.error.message}
            </Typography>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="cursor-pointer rounded-lg bg-accent-01 px-4 py-2.5 text-ui-06 hover:bg-accent-01/80"
          >
            <Typography variant="body2">{i18n.t('errors.tryAgain')}</Typography>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
