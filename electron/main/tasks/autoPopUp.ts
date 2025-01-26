import type { RequiredWith } from '#/utils'
import type { ElementHandle, Page } from 'playwright'
import type { BaseConfig, Scheduler } from './scheduler'
import { GOODS_ACTION_SELECTOR, GOODS_ITEM_SELECTOR } from '#/constants'
import { createLogger } from '#/logger'
import { randomInt } from '#/utils'
import { merge } from 'lodash-es'
import { createScheduler } from './scheduler'

const TASK_NAME = '自动弹窗'

export interface PopUpConfig extends BaseConfig {
  goodsIds: number[]
  random?: boolean
}

const DEFAULT_CONFIG: RequiredWith<PopUpConfig, 'scheduler'> = {
  scheduler: {
    name: TASK_NAME,
    interval: [30000, 45000],
  },
  goodsIds: [1, 2],
  random: false,
}

export function createAutoPopUp(page: Page, userConfig: Partial<PopUpConfig> = {}): Scheduler {
  const logger = createLogger(TASK_NAME)
  let config = merge(DEFAULT_CONFIG, userConfig)
  let currentGoodIndex = 0

  async function execute() {
    try {
      logger.debug(`开始执行「${TASK_NAME}」`)

      const goodsId = getNextGoodsId()
      logger.debug(`准备讲解商品 ID: ${goodsId}`)

      const goodsItem = await getGoodsItem(goodsId)
      await togglePresentation(goodsItem)
    }
    catch (error) {
      if (error instanceof Error) {
        logger.error(`「${TASK_NAME}」执行失败: ${error.message}`)
      }
    }
  }

  const scheduler = createScheduler(execute, config.scheduler)

  function validateConfig() {
    if (config.goodsIds.length === 0) {
      throw new Error('商品配置验证失败: 必须提供至少一个商品ID')
    }
    logger.info(`商品配置验证通过，共加载 ${config.goodsIds.length} 个商品`)
  }

  function getNextGoodsId(): number {
    if (config.random) {
      currentGoodIndex = randomInt(0, config.goodsIds.length - 1)
    }
    else {
      currentGoodIndex = (currentGoodIndex + 1) % config.goodsIds.length
    }
    return config.goodsIds[currentGoodIndex]
  }

  async function getGoodsItem(id: number) {
    const items = await page.$$(GOODS_ITEM_SELECTOR)
    // 商品 ID 从 1 开始
    // 商品 ID 就是和 items 的索引对应的，所以不用验证 ID 是否对应 item
    if (id <= 0 || id > items.length) {
      throw new Error(`商品 ${id} 不存在`)
    }
    return items[id - 1]
  }

  async function togglePresentation(item: ElementHandle) {
    const actionPanel = await item.$(GOODS_ACTION_SELECTOR)
    const presBtnWrap = actionPanel && await actionPanel.$(`div[class*="wrapper"]:has(button)`)

    if (await isPresenting(presBtnWrap)) {
      await clickActionButton(presBtnWrap!, '取消讲解')
      await waitForStateChange(presBtnWrap!)
    }

    await clickActionButton(presBtnWrap!, '讲解')
  }

  async function isPresenting(element: ElementHandle | null) {
    if (!element)
      return false
    const activeBtn = await element.$('button[class*="active"]')
    return !!activeBtn && (await activeBtn.textContent()) === '取消讲解'
  }

  async function clickActionButton(element: ElementHandle, expectedText: string) {
    const button = await element.$('button')
    if (!button) {
      logger.error('操作按钮查找失败: 找不到操作按钮')
      throw new Error('找不到操作按钮')
    }

    const actualText = await button.textContent()
    if (actualText !== expectedText) {
      throw new Error(`按钮状态不一致，期望: ${expectedText}，实际: ${actualText}`)
    }

    await button.click()
    logger.success(`${expectedText} 商品 | ID: ${currentGoodIndex + 1} | 总商品数: ${config.goodsIds.length}`)
  }

  async function waitForStateChange(element: ElementHandle) {
    await element.waitForSelector(
      `button:not([class*="active"])`,
      { timeout: 10000 },
    )
  }

  validateConfig()

  return {
    start: () => scheduler.start(),
    stop: () => scheduler.stop(),
    updateConfig: (newConfig: Partial<PopUpConfig>) => {
      if (newConfig.scheduler) {
        scheduler.updateConfig(newConfig)
      }
      config = merge(config, newConfig)
    },

    get isRunning() {
      return scheduler.isRunning
    },
  }
}
