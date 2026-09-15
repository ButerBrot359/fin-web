import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  enrollFaceIdProfile,
  faceIdHttpStatus,
  getFaceIdProfile,
  replaceFaceIdProfile,
} from '../../api/face-id-api'
import type { FaceIdPhotoTarget } from '../../types/face-id'

export const faceIdPhotoIdentity = (target: FaceIdPhotoTarget): string =>
  target.kind === 'self'
    ? `self:${String(target.accountId)}`
    : `user:${String(target.userEntryId)}`

export function useFaceIdPhoto(target: FaceIdPhotoTarget) {
  const client = useQueryClient()
  const queryKey = ['face-id-profile', faceIdPhotoIdentity(target)]
  const [mustRefresh, setMustRefresh] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [replacementProfileId, setReplacementProfileId] = useState<
    string | null
  >(null)
  const [pickerVersion, setPickerVersion] = useState(0)
  const query = useQuery({
    queryKey,
    queryFn: () => getFaceIdProfile(target),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const resetPicker = () => {
    setReplacementProfileId(null)
    setPickerVersion((value) => value + 1)
  }
  const upload = useMutation({
    mutationFn: ({
      image,
      expectedProfileId,
    }: {
      image: string
      expectedProfileId: string | null
    }) =>
      expectedProfileId === null
        ? enrollFaceIdProfile(target, image)
        : replaceFaceIdProfile(target, image, expectedProfileId),
    retry: false,
    onSuccess: (data, variables) => {
      client.setQueryData(queryKey, data)
      resetPicker()
      setMessage(
        variables.expectedProfileId === null
          ? 'faceId.saved'
          : 'faceId.replaced'
      )
    },
    onError: async (error, variables) => {
      const status = faceIdHttpStatus(error)
      const uncertain = !status || status >= 500
      setMustRefresh(uncertain || status === 409)
      setMessage(
        status === 409
          ? 'faceId.staleProfile'
          : uncertain
            ? 'faceId.uploadUncertain'
            : status === 422
              ? variables.expectedProfileId === null
                ? 'faceId.badPhoto'
                : 'faceId.replacementRejected'
              : status === 403
                ? 'faceId.forbidden'
                : 'faceId.uploadFailed'
      )
      if (uncertain || status === 409) resetPicker()
      if (status === 409) {
        const refreshed = await query.refetch()
        if (refreshed.isSuccess) setMustRefresh(false)
      }
    },
  })
  const refresh = async () => {
    const result = await query.refetch()
    if (result.isSuccess) {
      resetPicker()
      setMustRefresh(false)
      setMessage(null)
      upload.reset()
    }
  }
  return {
    query,
    upload,
    message,
    mustRefresh,
    pickerVersion,
    replacementProfileId,
    refresh,
    startReplacement: () => {
      const user = query.data
      if (!user?.canReplace || !user.profile || mustRefresh || upload.isPending)
        return
      setReplacementProfileId(user.profile.id)
      setMessage(null)
      upload.reset()
    },
    cancelReplacement: () => {
      resetPicker()
      setMessage(null)
      upload.reset()
    },
    submit: (image: string) => {
      if (upload.isPending || mustRefresh || query.isFetching) return
      const user = query.data
      if (
        !user?.accountAvailable ||
        (replacementProfileId === null
          ? !user.canManage || user.registered
          : !user.canReplace)
      )
        return
      setMessage(null)
      upload.mutate({ image, expectedProfileId: replacementProfileId })
    },
  }
}
