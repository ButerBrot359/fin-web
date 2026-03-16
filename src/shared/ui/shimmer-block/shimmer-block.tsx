import { cn } from '@/shared/lib/utils/cn'

interface ShimmerBlockProps {
  className?: string
}

export const ShimmerBlock = ({ className }: ShimmerBlockProps) => (
  <div
    className={cn(
      'animate-shimmer rounded-md bg-linear-to-r from-ui-02 via-ui-03/30 to-ui-02 bg-size-[800px_100%]',
      className
    )}
  />
)
