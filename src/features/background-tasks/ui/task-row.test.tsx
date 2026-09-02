import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import type { AsyncTask } from '@/entities/async-task'

import { TaskRow } from './task-row'

/**
 * Заголовок задачи — ссылка на её объект.
 *
 * Дефект (02.09.2026): панель показывала «Проведение: Регламентная операция
 * ABZ00-00001 — Ошибки заполнения документа», но открыть документ, чтобы понять,
 * ЧТО не заполнено, было нельзя — строка была обычным текстом. Данные для перехода
 * (targetTypeCode/targetEntryId) бэк присылал с самого начала, ими просто никто
 * не пользовался.
 */
describe('TaskRow — переход к объекту задачи', () => {
  // Автоочистки в проекте нет: без cleanup узлы прошлого теста остаются в DOM,
  // и «ссылки быть не должно» ловило бы ссылку предыдущего случая.
  afterEach(cleanup)

  const baseTask: AsyncTask = {
    id: 't-1',
    kind: 'DOCUMENT_POST',
    title: 'Проведение: Регламентная операция ABZ00-00001',
    status: 'FAILED',
  }

  const renderRow = (task: AsyncTask, onNavigate?: () => void) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TaskRow task={task} now={0} onNavigate={onNavigate} />
        </MemoryRouter>
      </QueryClientProvider>
    )

  it('документ с id — заголовок ведёт на плоский маршрут карточки', () => {
    renderRow({
      ...baseTask,
      targetDomainKind: 'DOCUMENT',
      targetTypeCode: 'ReglamentnayaOperatsiya',
      targetEntryId: 27856215,
    })

    expect(
      screen.getByRole('link', { name: baseTask.title }).getAttribute('href')
    ).toBe('/documents/ReglamentnayaOperatsiya/27856215')
  })

  /** Построение отчёта идёт без объекта (target=null#null) — вести некуда. */
  it('задача без объекта остаётся текстом, а не битой ссылкой', () => {
    renderRow({ ...baseTask, kind: 'REPORT_BUILD', title: 'Отчёт' })

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Отчёт')).toBeTruthy()
  })

  /**
   * У справочников и регистров свои маршруты — плоский путь документа увёл бы
   * в пустоту. Пока такие задачи не заводятся, но контракт допускает домен.
   */
  it('объект не-документного домена ссылкой не становится', () => {
    renderRow({
      ...baseTask,
      targetDomainKind: 'DICTIONARY',
      targetTypeCode: 'Kassy',
      targetEntryId: 49339,
    })

    expect(screen.queryByRole('link')).toBeNull()
  })
})
