import { z } from 'zod'

import type { ViewNode, ViewPatch } from '../types/view'

const viewNodeSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    binding: z.string().optional(),
    value: z.unknown().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    actions: z
      .array(
        z.object({
          trigger: z.string(),
          actionId: z.string(),
          command: z.string().optional(),
        }),
      )
      .optional(),
    children: z.array(viewNodeSchema).optional(),
  }),
) as z.ZodType<ViewNode>

const viewPatchSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('setProp'), nodeId: z.string(), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal('setValue'), binding: z.string(), value: z.unknown() }),
  z.object({ op: z.literal('replaceNode'), nodeId: z.string(), node: viewNodeSchema }),
  z.object({ op: z.literal('insertNode'), parentId: z.string(), index: z.number(), node: viewNodeSchema }),
  z.object({ op: z.literal('removeNode'), nodeId: z.string() }),
  z.object({ op: z.literal('moveNode'), nodeId: z.string(), parentId: z.string(), index: z.number() }),
  z.object({ op: z.literal('setOptions'), nodeId: z.string(), options: z.array(z.unknown()) }),
])

export function validatePatches(patches: unknown[] | undefined): ViewPatch[] {
  if (!patches) return []
  const valid: ViewPatch[] = []
  for (const p of patches) {
    const res = viewPatchSchema.safeParse(p)
    if (res.success) {
      valid.push(p as ViewPatch)
    } else {
      console.warn('[sdui] malformed patch', p, res.error.issues)
    }
  }
  return valid
}
