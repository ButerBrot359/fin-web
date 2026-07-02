import type { ViewNode, ViewPatch } from '../types/view'

export function findNode(root: ViewNode, id: string): ViewNode | null {
  if (root.id === id) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

function updateNode(
  root: ViewNode,
  id: string,
  mutate: (n: ViewNode) => ViewNode,
): ViewNode {
  if (root.id === id) return mutate(root)
  if (!root.children) return root
  let changed = false
  const newChildren = root.children.map((c) => {
    const u = updateNode(c, id, mutate)
    if (u !== c) changed = true
    return u
  })
  return changed ? { ...root, children: newChildren } : root
}

function removeNodeFromTree(root: ViewNode, id: string): ViewNode {
  if (!root.children) return root
  const filtered = root.children.filter((c) => c.id !== id)
  const mapped = filtered.map((c) => removeNodeFromTree(c, id))
  const changed =
    filtered.length !== root.children.length ||
    mapped.some((m, i) => m !== filtered[i])
  return changed ? { ...root, children: mapped } : root
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  const result = [...arr]
  result.splice(index, 0, item)
  return result
}

// Патчи проверены validatePatches — поля по op гарантированы
function applyOne(root: ViewNode, patch: ViewPatch): ViewNode {
  switch (patch.op) {
    case 'setProp':
      return updateNode(root, patch.nodeId!, (n) => ({
        ...n,
        props: { ...n.props, [patch.key!]: patch.value },
      }))

    case 'setValue':
      return root

    case 'replaceNode':
      return updateNode(root, patch.nodeId!, () => patch.node!)

    case 'insertNode':
      return updateNode(root, patch.parentId!, (parent) => ({
        ...parent,
        children: insertAt(parent.children ?? [], patch.index!, patch.node!),
      }))

    case 'removeNode':
      return removeNodeFromTree(root, patch.nodeId!)

    case 'moveNode': {
      const moved = findNode(root, patch.nodeId!)
      if (!moved) return root
      const without = removeNodeFromTree(root, patch.nodeId!)
      return updateNode(without, patch.parentId!, (parent) => ({
        ...parent,
        children: insertAt(parent.children ?? [], patch.index!, moved),
      }))
    }

    case 'setOptions':
      return updateNode(root, patch.nodeId!, (n) => ({
        ...n,
        props: { ...n.props, options: patch.options },
      }))

    default:
      console.warn('[sdui] unknown patch op', patch)
      return root
  }
}

export function applyPatches(root: ViewNode, patches: ViewPatch[]): ViewNode {
  return patches.reduce((tree, patch) => applyOne(tree, patch), root)
}

export function clearErrors(root: ViewNode): ViewNode {
  const hasError = root.props?.error != null
  const children = root.children
  let newChildren = children
  if (children) {
    let changed = false
    newChildren = children.map((c) => {
      const u = clearErrors(c)
      if (u !== c) changed = true
      return u
    })
    if (!changed) newChildren = children
  }
  if (!hasError && newChildren === children) return root
  const newProps = hasError ? { ...root.props, error: null } : root.props
  return newChildren !== children
    ? { ...root, props: newProps, children: newChildren }
    : { ...root, props: newProps }
}

export function applyValuePatches(
  patches: ViewPatch[],
  setter: (binding: string, value: unknown) => void,
): void {
  for (const p of patches) {
    if (p.op === 'setValue' && p.binding) {
      setter(p.binding, p.value)
    }
  }
}
