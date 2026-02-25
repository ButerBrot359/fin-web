import type { ReactNode } from 'react'

interface LayoutProps {
  sidebar: ReactNode
  header?: ReactNode
  children?: ReactNode
}

export const Layout = ({ sidebar, header, children }: LayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-ui-06">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-4xl rounded-bl-4xl bg-ui-02 p-10 pl-8">
        <header>{header}</header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
