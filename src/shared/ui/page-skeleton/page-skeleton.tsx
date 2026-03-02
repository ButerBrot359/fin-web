const ShimmerBlock = ({ className }: { className?: string }) => (
  <div
    className={`animate-shimmer rounded-md bg-linear-to-r from-ui-02 via-ui-03/30 to-ui-02 bg-size-[800px_100%] ${className ?? ''}`}
  />
)

export const PageSkeleton = () => {
  return (
    <div className="flex flex-col gap-8 pt-5">
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-8 w-48" />
        <div className="flex gap-1">
          <ShimmerBlock className="h-10 w-81.5 rounded-lg" />
          <ShimmerBlock className="h-10 w-10 rounded-lg" />
          <ShimmerBlock className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-10">
        {Array.from({ length: 3 }).map((_, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-6">
            {Array.from({ length: 2 }).map((_, sectionIdx) => (
              <div key={sectionIdx} className="flex flex-col gap-2">
                <div className="px-2">
                  <ShimmerBlock className="h-6 w-28" />
                </div>
                <ul className="flex flex-col gap-1">
                  {Array.from({ length: 4 }).map((_, itemIdx) => (
                    <li
                      key={itemIdx}
                      className="flex items-center gap-2 px-2 py-1"
                    >
                      <ShimmerBlock className="h-4 w-4 shrink-0 rounded-full" />
                      <ShimmerBlock
                        className={`h-5 ${['w-40', 'w-56', 'w-48', 'w-36'][itemIdx]}`}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
