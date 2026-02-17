import type { PropsWithChildren } from 'react'
import { Sidebar } from '@/features/sidebar'

export const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex h-screen w-full bg-ui-06">
      <Sidebar />
      <main className="flex-1 rounded-tl-4xl rounded-bl-4xl bg-ui-02">
        {children}
      </main>
    </div>
  )
}
