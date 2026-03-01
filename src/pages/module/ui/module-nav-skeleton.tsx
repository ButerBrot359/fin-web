const ShimmerBlock = ({ className }: { className?: string }) => (
  <div
    className={`animate-shimmer rounded-md bg-linear-to-r from-ui-02 via-ui-03/30 to-ui-02 bg-size-[800px_100%] ${className ?? ''}`}
  />
)

const ItemSkeleton = ({ width }: { width: string }) => (
  <li className="flex items-center px-2 py-1">
    <ShimmerBlock className={`pl-6 h-5 ${width}`} />
  </li>
)

const SectionSkeleton = ({
  titleWidth,
  itemCount,
}: {
  titleWidth: string
  itemCount: number
}) => {
  const widths = ['w-40', 'w-56', 'w-48', 'w-36', 'w-52', 'w-44']

  return (
    <div className="flex flex-col gap-2">
      <div className="px-2">
        <ShimmerBlock className={`h-6 ${titleWidth}`} />
      </div>
      <ul className="flex flex-col gap-1">
        {Array.from({ length: itemCount }).map((_, i) => (
          <ItemSkeleton key={i} width={widths[i % widths.length]} />
        ))}
      </ul>
    </div>
  )
}

export const ModuleNavSkeleton = () => {
  return (
    <div className="grid grid-cols-3 gap-x-10">
      <div className="flex flex-col gap-6">
        <SectionSkeleton titleWidth="w-32" itemCount={3} />
        <SectionSkeleton titleWidth="w-24" itemCount={2} />
        <SectionSkeleton titleWidth="w-28" itemCount={4} />
      </div>
      <div className="flex flex-col gap-6">
        <SectionSkeleton titleWidth="w-20" itemCount={6} />
        <SectionSkeleton titleWidth="w-28" itemCount={4} />
      </div>
      <div className="flex flex-col gap-6">
        <SectionSkeleton titleWidth="w-32" itemCount={7} />
        <SectionSkeleton titleWidth="w-24" itemCount={2} />
      </div>
    </div>
  )
}
