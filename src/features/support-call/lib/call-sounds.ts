/**
 * Звуки живой поддержки (ADR-0050).
 *
 * <p><b>Ни одного звукового файла.</b> Всё синтезируется в браузере через Web Audio: это снимает
 * вопрос лицензий целиком — тоны сочинены здесь, а не скачаны, поэтому «на этот звук у кого-то
 * права» невозможно в принципе. Заодно в репозиторий не едут бинарники, а сборка не тащит
 * лишних килобайт: весь набор — это несколько десятков строк с частотами.
 *
 * <p><b>У каждого действия свой рисунок, а не громкость одного щелчка.</b> Звук здесь работает
 * подтверждением: включённый микрофон звучит восходящим тоном, выключенный — нисходящим, и по
 * одному этому слышно, что именно произошло, не глядя на кнопку. Ровно то же различие между
 * началом и концом показа экрана.
 *
 * <p><b>Браузер не даёт звучать до первого действия человека.</b> Политика автозапуска держит
 * {@link AudioContext} в состоянии suspended, пока страницу не тронули, поэтому контекст
 * создаётся лениво и будится при первом же клике. Если что-то пошло не так — молчим: звук
 * приятен, но обязателен он только в кино.
 */

/** Одна нота: частота, сдвиг от начала и длительность — всё в секундах. */
interface Note {
  freq: number
  /** Сдвиг относительно начала звука. */
  at: number
  duration: number
  /** Громкость ноты, 0…1. Общий уровень намеренно тихий: это интерфейс, а не сигнализация. */
  gain?: number
  type?: OscillatorType
}

/** Спад и нарастание сглаживают щелчок, который иначе слышен на каждом включении осциллятора. */
const ATTACK = 0.008
const RELEASE = 0.05

let context: AudioContext | null = null

/**
 * Общий {@link AudioContext}.
 *
 * <p>Один на вкладку: браузеры ограничивают число контекстов, и заводить его на каждый звук
 * означало бы упереться в лимит за время одного разговора.
 */
const audio = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') {
      void context.resume()
    }
    return context
  } catch {
    // Браузер без Web Audio или запрет политикой — интерфейс обязан работать молча.
    return null
  }
}

/** Проигрывает набор нот. Возвращает момент окончания — по нему строятся повторяющиеся сигналы. */
const play = (notes: Note[], startAt?: number): number => {
  const ctx = audio()
  if (!ctx) {
    return 0
  }
  const start = startAt ?? ctx.currentTime
  let end = start

  for (const note of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const from = start + note.at
    const to = from + note.duration
    const level = note.gain ?? 0.12

    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(note.freq, from)

    // Огибающая, а не голый gain: без неё в начале и конце ноты слышен щелчок.
    gain.gain.setValueAtTime(0, from)
    gain.gain.linearRampToValueAtTime(level, from + ATTACK)
    gain.gain.setValueAtTime(level, Math.max(from + ATTACK, to - RELEASE))
    gain.gain.linearRampToValueAtTime(0, to)

    osc.connect(gain).connect(ctx.destination)
    osc.start(from)
    osc.stop(to + 0.02)
    end = Math.max(end, to)
  }

  return end
}

/**
 * Разовые сигналы действий.
 *
 * <p>Восходящие — про включение и начало, нисходящие — про выключение и конец. Правило одно на
 * весь контур, поэтому смысл нового звука угадывается без объяснений.
 */
export const callSounds = {
  /** Звонок в поддержку — восходящее трезвучие: начало разговора. */
  call: () =>
    play([
      { freq: 523, at: 0, duration: 0.09 },
      { freq: 659, at: 0.08, duration: 0.09 },
      { freq: 784, at: 0.16, duration: 0.16 },
    ]),

  /** Поддержка взяла трубку. */
  answer: () =>
    play([
      { freq: 659, at: 0, duration: 0.08 },
      { freq: 988, at: 0.07, duration: 0.16 },
    ]),

  micOn: () =>
    play([
      { freq: 700, at: 0, duration: 0.05 },
      { freq: 1000, at: 0.045, duration: 0.08 },
    ]),

  micOff: () =>
    play([
      { freq: 1000, at: 0, duration: 0.05 },
      { freq: 700, at: 0.045, duration: 0.08 },
    ]),

  /** Показ экрана начался — три ступени вверх, заметнее прочих: чужие глаза на своём экране. */
  screenOn: () =>
    play([
      { freq: 600, at: 0, duration: 0.06 },
      { freq: 900, at: 0.055, duration: 0.06 },
      { freq: 1200, at: 0.11, duration: 0.14 },
    ]),

  screenOff: () =>
    play([
      { freq: 1200, at: 0, duration: 0.06 },
      { freq: 600, at: 0.055, duration: 0.14 },
    ]),

  minimize: () =>
    play([
      { freq: 800, at: 0, duration: 0.05, gain: 0.08 },
      { freq: 520, at: 0.045, duration: 0.07, gain: 0.08 },
    ]),

  restore: () =>
    play([
      { freq: 520, at: 0, duration: 0.05, gain: 0.08 },
      { freq: 800, at: 0.045, duration: 0.07, gain: 0.08 },
    ]),

  /** Трубка положена — два низких тона вниз, как отбой на телефоне. */
  hangUp: () =>
    play([
      { freq: 440, at: 0, duration: 0.11, type: 'triangle' },
      { freq: 330, at: 0.1, duration: 0.22, type: 'triangle' },
    ]),
}

/** Останавливает повторяющийся сигнал. */
export type StopSound = () => void

/**
 * Гудок ожидания у звонящего.
 *
 * <p>425 Гц, секунда звука на четыре секунды тишины — это КПВ, тот самый сигнал «идёт вызов»
 * из городской телефонии Казахстана и России. Взят намеренно: человек, который ждёт ответа
 * поддержки, слышит ровно то, что слышит, когда куда-то звонит, и не гадает, соединилось ли.
 * Сам сигнал — две константы, а не запись, поэтому вопроса прав не возникает.
 */
export const startRingback = (): StopSound => {
  const beat = () => {
    play([{ freq: 425, at: 0, duration: 1, gain: 0.07, type: 'sine' }])
  }
  beat()
  const timer = setInterval(beat, 5000)
  return () => {
    clearInterval(timer)
  }
}

/**
 * Звонок у поддержки.
 *
 * <p>Двухтонная трель, а не длинный гудок: агент сидит в интерфейсе, и сигнал должен привлечь
 * внимание, не мешая говорить. Повторяется, пока обращение ждёт ответа, — один сигнал легко
 * пропустить, отойдя за чаем.
 */
export const startIncomingRing = (): StopSound => {
  const chime = () => {
    play([
      { freq: 988, at: 0, duration: 0.16, gain: 0.1 },
      { freq: 1319, at: 0.17, duration: 0.22, gain: 0.1 },
      { freq: 988, at: 0.55, duration: 0.16, gain: 0.1 },
      { freq: 1319, at: 0.72, duration: 0.22, gain: 0.1 },
    ])
  }
  chime()
  const timer = setInterval(chime, 2600)
  return () => {
    clearInterval(timer)
  }
}
