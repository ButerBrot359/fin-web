import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'

// Metadata-only node. TABLE reads its children to build grouped column defs.
export const ColumnGroupNode: FC<NodeProps> = () => null
