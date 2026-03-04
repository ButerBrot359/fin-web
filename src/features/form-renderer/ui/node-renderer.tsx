import type { FormNode } from '@/entities/form-config'

import { HStackNode } from './hstack-node'
import { VStackNode } from './vstack-node'
import { FieldNode } from './field-node'
import { SeparatorNode } from './separator-node'
import { LabelNode } from './label-node'
import { TabsNode } from './tabs-node'

interface NodeRendererProps {
  node: FormNode
}

export const NodeRenderer = ({ node }: NodeRendererProps) => {
  switch (node.type) {
    case 'VStack':
      return <VStackNode node={node} />
    case 'HStack':
      return <HStackNode node={node} />
    case 'Field':
      return <FieldNode node={node} />
    case 'Separator':
      return <SeparatorNode />
    case 'Label':
      return <LabelNode node={node} />
    case 'Tabs':
      return <TabsNode node={node} />
  }
}
