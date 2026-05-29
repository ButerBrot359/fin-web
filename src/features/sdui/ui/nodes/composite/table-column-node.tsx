import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'

// TABLE_COLUMN is not rendered standalone.
// TABLE node reads its children's props to build column definitions.
export const TableColumnNode: FC<NodeProps> = () => null
