import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateConfig } from './generate-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT ?? 3001
const CONFIGS_DIR = path.resolve(__dirname, '../configs')

const VALID_TYPES = new Set(['documents', 'dictionaries'])

const getTypeDir = (type: unknown): string => {
  const t =
    typeof type === 'string' && VALID_TYPES.has(type) ? type : 'documents'
  return path.join(CONFIGS_DIR, t)
}

app.use(express.json())
app.use(cors())

app.get('/api/configs', async (req, res) => {
  const dir = getTypeDir(req.query.type)
  try {
    const files = await fs.readdir(dir)
    const configs = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
    res.json(configs)
  } catch {
    res.json([])
  }
})

app.get('/api/configs/:name', async (req, res) => {
  const type =
    typeof req.query.type === 'string' && VALID_TYPES.has(req.query.type)
      ? req.query.type
      : 'documents'
  const dir = getTypeDir(type)
  const filePath = path.join(dir, `${req.params.name}.json`)

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    res.json(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    try {
      const domain =
        typeof req.query.domain === 'string' ? req.query.domain : undefined
      const config = await generateConfig(req.params.name, type, domain)
      res.json(config)
    } catch (genErr) {
      console.error(`Generation failed for ${req.params.name}:`, genErr)
      res.status(500).json({
        error: `Config "${req.params.name}" not found and generation failed`,
      })
    }
  }
})

app.listen(PORT, () => {
  console.log(`Form configs server running on http://localhost:${String(PORT)}`)
})
