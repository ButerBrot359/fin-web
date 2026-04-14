import type { Attribute } from './document-types-api.js'

export interface ExampleConfig {
  name: string
  json: string
}

export function buildPrompt(
  docCode: string,
  docTitle: string,
  attributes: Attribute[],
  examples: ExampleConfig[]
): string {
  const attributesList = attributes
    .map(
      (a) =>
        `- code: "${a.code}", nameRu: "${a.nameRu}", dataType: "${a.dataType}", domainKind: ${a.domainKind ? `"${a.domainKind}"` : 'null'}, isRequired: ${String(a.isRequired)}`
    )
    .join('\n')

  const examplesText = examples
    .map(
      (ex, i) =>
        `### Пример ${String(i + 1)}: ${ex.name}\n\`\`\`json\n${ex.json}\n\`\`\``
    )
    .join('\n\n')

  return `Ты генератор layout-конфигов форм финансового приложения. Твоя задача — создать JSON-конфиг расположения полей формы документа.

## Схема

\`\`\`typescript
interface FormConfig {
  name: string    // код документа
  title: string   // название документа на русском
  layout: FormNode
}

type FormNode = VStackNode | HStackNode | FieldNode | SeparatorNode | LabelNode | TabsNode

interface VStackNode {
  type: "VStack"
  children: FormNode[]
  gap?: number   // отступ между элементами (умножается на 4px)
  flex?: number
}

interface HStackNode {
  type: "HStack"
  children: FormNode[]
  gap?: number
  flex?: number
  align?: "start" | "center" | "end" | "stretch"
}

interface FieldNode {
  type: "Field"
  code: string   // код атрибута — должен ТОЧНО совпадать с кодом из списка атрибутов
  flex?: number
}

interface SeparatorNode {
  type: "Separator"
}

interface LabelNode {
  type: "Label"
  text: string
  variant?: "default" | "link" | "heading"
}

interface TabsNode {
  type: "Tabs"
  panes: Array<{ key: string, label: string, children: FormNode[] }>
}
\`\`\`

## Правила раскладки

Строго следуй этим правилам:

1. Корневой элемент — всегда VStack с gap: 8
2. Первый дочерний элемент — шапка: HStack с gap: 6, align: "stretch", содержащий две колонки VStack (каждая с flex: 1, gap: 3)
3. Поля "Nomer" и "Data" всегда объединены в HStack с gap: 3, каждое с flex: 1
4. Если есть поле "VidOperatsii" — оно первое в левой колонке, перед Nomer+Data
5. В левой колонке после Nomer/Data идут: Organizatsiya, PodrazdelenieOrganizatsii и другие основные поля документа (контрагент, сумма, касса и т.д.)
6. Правая колонка начинается с Label { text: "Основание", variant: "link" } если есть финансовые поля (IstochnikFinansirovaniya, FKR, Spetsifika, KodPlatnykhUslug и т.п.)
7. Связанные бухгалтерские поля можно объединять в HStack с gap: 3 (например SchetKassy + StatyaDDS, или SchetUchetaBU + SchetRaschetovBU)
8. После шапки — секция Tabs для вторичных/детальных полей. Группируй логически связанные поля во вкладки
9. Последний блок ВСЕГДА: Separator, затем HStack с gap: 3, содержащий Kommentariy (flex: 1) и Otvetstvennyy (flex: 1). Если одного из них нет в атрибутах — используй только тот что есть
10. Атрибуты с dataType "TABLE" — каждый в отдельную вкладку Tabs
11. Поле "code" в Field ДОЛЖНО точно совпадать с кодом атрибута из списка
12. КАЖДЫЙ атрибут из списка ОБЯЗАТЕЛЬНО должен присутствовать в layout. Не пропускай ни одного
13. Значения gap: 3 — компактная группировка внутри колонки, 6 — между колонками, 8 — между основными секциями

## Примеры существующих конфигов

${examplesText}

## Задание

Сгенерируй конфиг формы для документа "${docCode}" с названием "${docTitle}".

Список атрибутов (showInForm: true, отсортированы по sortOrder):
${attributesList}

Верни ТОЛЬКО JSON объект конфига. Без объяснений, без markdown-обёрток, без \`\`\`json блоков. Только чистый JSON.`
}
