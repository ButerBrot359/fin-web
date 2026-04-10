import type {
  SubmitAction,
  SubmitActionConfig,
} from '../../types/document-entry-actions'

export const ACTION_CONFIG: Record<SubmitAction, SubmitActionConfig> = {
  save: { isPosted: false, shouldClose: false },
  post: { isPosted: true, shouldClose: false },
  saveAndClose: { isPosted: false, shouldClose: true },
  postAndClose: { isPosted: true, shouldClose: true },
}
