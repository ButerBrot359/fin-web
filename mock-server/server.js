import express from 'express'
import cors from 'cors'
import { schemaV1 } from './schemas/v1-flat.js'
import { schemaV2 } from './schemas/v2-nested-layout.js'
import { schemaV3 } from './schemas/v3-action-driven.js'

const app = express()
app.use(cors())
app.use(express.json())

// =====================================================
// Вариант 1: Плоская структура (flat)
// Простой подход — массив полей + отдельно описание действий
// =====================================================
app.get('/api/v1/pages/cash-receipt-order', (_req, res) => {
  res.json(schemaV1.listPage)
})

app.get('/api/v1/pages/cash-receipt-order/create-action', (_req, res) => {
  res.json(schemaV1.createAction)
})

app.get('/api/v1/pages/cash-receipt-order/:id', (_req, res) => {
  res.json(schemaV1.formPage)
})

// =====================================================
// Вариант 2: Вложенная структура с layout (nested)
// Layout-driven — сервер описывает сетку и расположение
// =====================================================
app.get('/api/v2/pages/cash-receipt-order', (_req, res) => {
  res.json(schemaV2.listPage)
})

app.get('/api/v2/pages/cash-receipt-order/create-action', (_req, res) => {
  res.json(schemaV2.createAction)
})

app.get('/api/v2/pages/cash-receipt-order/:id', (_req, res) => {
  res.json(schemaV2.formPage)
})

// =====================================================
// Вариант 3: Action-driven (ориентирован на действия)
// Каждый компонент знает свои actions, бэк управляет поведением
// =====================================================
app.get('/api/v3/pages/cash-receipt-order', (_req, res) => {
  res.json(schemaV3.listPage)
})

app.get('/api/v3/pages/cash-receipt-order/create-action', (_req, res) => {
  res.json(schemaV3.createAction)
})

app.get('/api/v3/pages/cash-receipt-order/:id', (_req, res) => {
  res.json(schemaV3.formPage)
})

// =====================================================
// Данные для таблицы (общие для всех вариантов)
// =====================================================
app.get('/api/data/cash-receipt-orders', (_req, res) => {
  res.json({
    items: [
      {
        id: '1',
        date: '2024-08-14T14:32:15',
        number: 'AAC00-00d...',
        organization: 'Демонстра...',
        subdivision: '-',
        operationType: 'Оплата от п...',
        counterparty: 'AS ER GRAD...',
        fundingSource: 'Особые рас...',
        fkr: '-',
        paymentCode: '-',
        spec: '0000',
        comment: '-',
        responsible: 'Sulushash T...',
        link: 'Инв-12457',
      },
      {
        id: '2',
        date: '2024-03-02T09:17:53',
        number: 'AAC00-00d...',
        organization: 'Демонстра...',
        subdivision: '-',
        operationType: 'Оплата от п...',
        counterparty: 'AS ER GRAD...',
        fundingSource: 'Особые рас...',
        fkr: '-',
        paymentCode: '-',
        spec: '0000',
        comment: '-',
        responsible: 'Sulushash T...',
        link: 'ПКО-96874',
      },
    ],
    total: 7,
    page: 1,
    pageSize: 20,
  })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`)
  console.log('')
  console.log('Endpoints:')
  console.log('  V1 (flat):           GET /api/v1/pages/cash-receipt-order')
  console.log('  V1 create action:    GET /api/v1/pages/cash-receipt-order/create-action')
  console.log('  V1 form:             GET /api/v1/pages/cash-receipt-order/:id')
  console.log('')
  console.log('  V2 (nested layout):  GET /api/v2/pages/cash-receipt-order')
  console.log('  V2 create action:    GET /api/v2/pages/cash-receipt-order/create-action')
  console.log('  V2 form:             GET /api/v2/pages/cash-receipt-order/:id')
  console.log('')
  console.log('  V3 (action-driven):  GET /api/v3/pages/cash-receipt-order')
  console.log('  V3 create action:    GET /api/v3/pages/cash-receipt-order/create-action')
  console.log('  V3 form:             GET /api/v3/pages/cash-receipt-order/:id')
  console.log('')
  console.log('  Data:                GET /api/data/cash-receipt-orders')
})
