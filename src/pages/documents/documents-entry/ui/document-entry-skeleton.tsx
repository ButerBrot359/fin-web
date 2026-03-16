import { ShimmerBlock } from '@/shared/ui/shimmer-block'

export const DocumentEntrySkeleton = () => (
  <div className="flex flex-col gap-4">
    <ShimmerBlock className="h-12 w-1/3" />
    <ShimmerBlock className="h-12 w-1/2" />
    <ShimmerBlock className="h-12 w-2/5" />
    <ShimmerBlock className="h-12 w-1/4" />
    <ShimmerBlock className="h-12 w-1/3" />
  </div>
)
