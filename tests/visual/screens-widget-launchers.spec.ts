import { expect, test } from '@playwright/test'
import { mockApi } from './helpers/mock-api'

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} header launches existing AI and support without calls`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(`
      localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only');
      localStorage.setItem('sidebar-settings', JSON.stringify({isCollapsed:true}));
      localStorage.setItem('webbuh.auth.user', JSON.stringify({id:1,login:'Тест',displayName:'Тест',userKind:'INTERNAL',language:'Ru',supportAgent:false}));
      window.__mediaRequests = 0;
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__mediaRequests++; return Promise.reject(new Error('Media must not start')); };
    `)
    await mockApi(page, {
      'POST /api/view#OPEN': {},
      'GET /api/settings/modules': { data: [], success: true },
      'GET /api/tasks/active': [],
      'GET /api/support/calls/active': { __status: 204, __body: null },
      'GET /api/ai-assistant/settings': {
        data: { enabled: true, capabilities: [] },
        success: true,
      },
      'GET /api/ai-assistant/conversations': { data: [], success: true },
      'GET /api/ai-assistant/conversations/page': {
        data: { conversations: [], hasMore: false, nextBeforeId: null },
        success: true,
      },
    })
    const mutations: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/(support\/calls|ai-assistant\/ask)/.test(request.url())
      )
        mutations.push(request.url())
    })
    await page.goto('/modules/Main/ai-history')
    const ai = page.getByRole('button', {
      name: 'Открыть ИИ-помощника',
      exact: true,
    })
    const support = page.getByRole('button', {
      name: 'Позвонить в поддержку',
      exact: true,
    })
    await expect(ai).toHaveCount(1)
    await expect(support).toHaveCount(1)
    await expect(ai).toBeInViewport()
    await expect(support).toBeInViewport()
    const languageBox = await page
      .getByRole('button', { name: 'Switch language' })
      .boundingBox()
    const aiBox = await ai.boundingBox()
    const supportBox = await support.boundingBox()
    expect(aiBox!.x).toBeGreaterThan(languageBox!.x)
    expect(supportBox!.x).toBeGreaterThan(aiBox!.x)
    await page.screenshot({
      path: `/tmp/widget-launchers-${mobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    })
    await ai.click()
    await page.getByRole('button', { name: 'История', exact: true }).click()
    await expect(page).toHaveURL(/\/ai-history$/)
    await support.click()
    await expect(
      page.getByRole('button', { name: 'Позвонить', exact: true })
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(mutations).toEqual([])
    expect(await page.evaluate<number>('window.__mediaRequests')).toBe(0)
  })
}
