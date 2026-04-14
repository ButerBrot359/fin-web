import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchDocumentAttributes } from './document-types-api.js'
import { buildPrompt, type ExampleConfig } from './prompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIGS_DIR = path.resolve(__dirname, '../configs')

interface FormConfig {
  name: string
  title: string
  layout: unknown
}

async function loadExamples(): Promise<ExampleConfig[]> {
  const files = await fs.readdir(CONFIGS_DIR)
  const jsonFiles = files.filter((f) => f.endsWith('.json'))

  if (jsonFiles.length === 0) return []

  const fileSizes = await Promise.all(
    jsonFiles.map(async (f) => {
      const stat = await fs.stat(path.join(CONFIGS_DIR, f))
      return { name: f.replace('.json', ''), size: stat.size }
    })
  )

  fileSizes.sort((a, b) => a.size - b.size)

  const smallest = fileSizes[0]
  const largest = fileSizes[fileSizes.length - 1]
  const selected =
    smallest.name === largest.name ? [smallest] : [smallest, largest]

  const examples: ExampleConfig[] = await Promise.all(
    selected.map(async (s) => {
      const content = await fs.readFile(
        path.join(CONFIGS_DIR, `${s.name}.json`),
        'utf-8'
      )
      return { name: s.name, json: content }
    })
  )

  return examples
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // Try extracting from markdown code fence
    const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed)
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim())
    }
    throw new Error('Failed to parse AI response as JSON')
  }
}

export async function generateConfig(docCode: string): Promise<FormConfig> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const { title, attributes } = await fetchDocumentAttributes(docCode)
  const examples = await loadExamples()
  const prompt = buildPrompt(docCode, title, attributes, examples)

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) {
    throw new Error('No text content in AI response')
  }

  const config = extractJson(
    'text' in textBlock ? textBlock.text : ''
  ) as FormConfig

  if (!config.name || !config.title || !config.layout) {
    throw new Error(
      'Generated config is missing required fields (name, title, layout)'
    )
  }

  // Save to disk for caching
  const filePath = path.join(CONFIGS_DIR, `${docCode}.json`)
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
  console.log(`Generated and saved config: ${docCode}`)

  return config
}
