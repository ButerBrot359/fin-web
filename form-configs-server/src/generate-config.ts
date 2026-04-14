import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchDocumentAttributes,
  fetchUniversalTypeAttributes,
} from './document-types-api.js'
import { buildPrompt, type ExampleConfig } from './prompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIGS_DIR = path.resolve(__dirname, '../configs')

interface FormConfig {
  name: string
  title: string
  layout: unknown
}

async function loadExamples(type: string): Promise<ExampleConfig[]> {
  const dir = path.join(CONFIGS_DIR, type)

  let files: string[]
  try {
    files = await fs.readdir(dir)
  } catch {
    // Fallback to documents examples if type dir is empty
    try {
      files = await fs.readdir(path.join(CONFIGS_DIR, 'documents'))
    } catch {
      return []
    }
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json'))
  if (jsonFiles.length === 0) {
    // No examples in target dir — try documents
    if (type !== 'documents') {
      return loadExamples('documents')
    }
    return []
  }

  const baseDir =
    jsonFiles.length > 0 && type !== 'documents'
      ? path.join(CONFIGS_DIR, type)
      : path.join(CONFIGS_DIR, type)

  const fileSizes = await Promise.all(
    jsonFiles.map(async (f) => {
      const stat = await fs.stat(path.join(baseDir, f))
      return { name: f.replace('.json', ''), size: stat.size }
    })
  )

  fileSizes.sort((a, b) => a.size - b.size)

  const smallest = fileSizes[0]
  const largest = fileSizes[fileSizes.length - 1]
  const selected =
    smallest.name === largest.name ? [smallest] : [smallest, largest]

  return Promise.all(
    selected.map(async (s) => {
      const content = await fs.readFile(
        path.join(baseDir, `${s.name}.json`),
        'utf-8'
      )
      return { name: s.name, json: content }
    })
  )
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed)
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim())
    }
    throw new Error('Failed to parse AI response as JSON')
  }
}

export async function generateConfig(
  code: string,
  type: string,
  domain?: string
): Promise<FormConfig> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const { title, attributes } =
    type === 'dictionaries' && domain
      ? await fetchUniversalTypeAttributes(domain, code)
      : await fetchDocumentAttributes(code)

  const examples = await loadExamples(type)
  const prompt = buildPrompt(code, title, attributes, examples)

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

  const dir = path.join(CONFIGS_DIR, type)
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${code}.json`)
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
  console.log(`Generated and saved config: ${type}/${code}`)

  return config
}
