import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = 3001
const CONFIGS_DIR = path.resolve(__dirname, '../configs')

app.use(express.json())
app.use(cors())

app.get('/api/configs', async (_req, res) => {
  const files = await fs.readdir(CONFIGS_DIR)
  const configs = files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
  res.json(configs)
})

app.get('/api/configs/:name', async (req, res) => {
  const filePath = path.join(CONFIGS_DIR, `${req.params.name}.json`)

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    res.json(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    res.status(404).json({ error: `Config "${req.params.name}" not found` })
  }
})

app.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${String(PORT)}`)
})
