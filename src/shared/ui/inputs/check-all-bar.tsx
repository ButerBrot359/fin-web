import { useContext } from 'react'

import { CheckAllActionsContext } from './check-all-context'

const ACTION_CLASS =
  'cursor-pointer rounded-lg px-4 py-2.5 text-body1 font-medium text-accent-02'

export function CheckAllBar() {
  const actions = useContext(CheckAllActionsContext)
  if (!actions) return null
  return (
    <div className="flex items-center gap-2 border-b border-ui-04 py-1">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          actions.onCheckAll()
        }}
        className={ACTION_CLASS}
      >
        {actions.checkAllLabel}
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          actions.onUncheckAll()
        }}
        className={ACTION_CLASS}
      >
        {actions.uncheckAllLabel}
      </button>
    </div>
  )
}
