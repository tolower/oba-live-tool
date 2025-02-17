import type { Browser, BrowserContext, Page } from 'playwright'
import type { BaseConfig, Scheduler } from './tasks/scheduler'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from './logger'
import windowManager from './windowManager'

interface Context {
  page: Page
  browser: Browser
  browserContext: BrowserContext
  tasks: Record<string, Scheduler>
}

export interface Account {
  name: string
  id: string
}

export class PageManager {
  private static instance: PageManager
  private contexts: Map<string, Context> = new Map()
  private currentId: string = 'default'
  private accountNames: Account[] = []
  private logger = createLogger('PageManager')
  private constructor() {}

  static getInstance() {
    if (!PageManager.instance)
      PageManager.instance = new PageManager()
    return PageManager.instance
  }

  switchContext(id: string) {
    this.currentId = id
    this.logger.info(`Switched to context <${this.currentAccountName}>`)
  }

  updateAccountNames(names: Account[]) {
    this.accountNames = names
  }

  get currentAccountName() {
    return this.accountNames.find(name => name.id === this.currentId)?.name || ''
  }

  setContext(context: Omit<Context, 'tasks'>) {
    const idSnapShot = this.currentId
    context.page.on('close', () => {
      windowManager.sendToWindow('main', IPC_CHANNELS.tasks.liveControl.disconnect, idSnapShot)
    })
    const previousContext = this.contexts.get(this.currentId) ?? { ...context, tasks: {} }
    this.contexts.set(this.currentId, { ...previousContext, ...context })
    this.logger.info(`Set context <${this.currentAccountName}>`)
  }

  getContext() {
    return this.contexts.get(this.currentId)
  }

  getPage() {
    const context = this.contexts.get(this.currentId)
    if (!context)
      throw new Error('Context not initialized')
    if (!context.page)
      throw new Error('Page not initialized')
    return context.page
  }

  register(
    taskName: string,
    creator: (page: Page, account: Account) => Scheduler,
  ) {
    const context = this.contexts.get(this.currentId)
    if (!context)
      throw new Error(`Context <${this.currentId}> not initialized`)
    if (context.tasks[taskName]?.isRunning) {
      this.logger.warn(`Task ${taskName} is already running - <${this.currentId}>`)
      return
    }

    if (context.tasks[taskName]) {
      context.tasks[taskName].stop()
      delete context.tasks[taskName]
    }

    const scheduler = creator(
      context.page,
      {
        id: this.currentId,
        name: this.currentAccountName,
      },
    )
    context.tasks[taskName] = scheduler
  }

  contains(taskName: string) {
    const context = this.contexts.get(this.currentId)
    if (!context)
      throw new Error(`Context <${this.currentId}> not initialized`)
    return context.tasks[taskName] !== undefined
  }

  cleanup() {
    for (const context of this.contexts.values()) {
      for (const task of Object.values(context.tasks))
        task.stop()
      context.tasks = {}
    }
  }

  startTask(taskName: string) {
    const context = this.contexts.get(this.currentId)
    if (!context)
      throw new Error(`Context <${this.currentId}> not initialized`)
    if (!context.tasks[taskName])
      throw new Error(`Task ${taskName} not found`)
    if (context.tasks[taskName].isRunning)
      return

    this.logger.info(`Starting task ${taskName} - <${this.currentId}>`)
    context.tasks[taskName].start()
  }

  stopTask(taskName: string) {
    const context = this.contexts.get(this.currentId)
    if (!context)
      throw new Error(`Context <${this.currentId}> not initialized`)
    if (!context.tasks[taskName])
      throw new Error(`Task ${taskName} not found`)
    this.logger.info(`Stopping task ${taskName} - (${this.currentId})`)
    context.tasks[taskName].stop()
  }

  updateTaskConfig(taskName: string, newConfig: BaseConfig) {
    const context = this.contexts.get(this.currentId)
    if (!context)
      throw new Error(`Context <${this.currentId}> not initialized`)
    if (!context.tasks[taskName])
      throw new Error(`Task ${taskName} not found`)
    context.tasks[taskName].updateConfig(newConfig)
  }
}

export const pageManager = PageManager.getInstance()

ipcMain.handle(IPC_CHANNELS.account.switch, async (_, { accountId, accountNames }: { accountId: string, accountNames: Account[] }) => {
  pageManager.switchContext(accountId)
  pageManager.updateAccountNames(accountNames)
})
