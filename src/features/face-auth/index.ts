/**
 * Вход по лицу с проверкой живости (ADR-0069 в репозитории webbuh).
 *
 * Публичный API слайса. Наружу отдаётся готовая кнопка со всей обвязкой и типы контракта;
 * внутренности (арифметика светового расписания, работа с камерой, разбор ответов) остаются
 * приватными — подменять их поштучно нельзя, они образуют одно целое с тем, что измеряет сервер.
 */
export { FaceLoginButton } from './ui/face-login-button'
export { FacePhotoDialog } from './ui/face-photo-dialog'
export { useFaceCapture } from './lib/hooks/use-face-capture'
export type {
  FaceCapturePhase,
  FaceCaptureState,
} from './lib/hooks/use-face-capture'
export type {
  FaceTemplateSummary,
  FaceTemplateUploadOutcome,
} from './types/face-template'
export type {
  FaceChallengeResponse,
  FaceQualityReason,
  FaceVerifyOutcome,
} from './types/face-auth'
