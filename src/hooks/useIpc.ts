import { useEffect, useMemo } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAccounts } from './useAccounts'
import { type Comment, useAutoReply } from './useAutoReply'
import { useLiveControl } from './useLiveControl'
import { useToast } from './useToast'

// 需要全局监听的 ipc 事件

export function useIpc() {
  const { handleComment } = useAutoReply()
  const { setIsConnected } = useLiveControl()
  const { accounts, currentAccountId } = useAccounts()
  const { toast } = useToast()

  const currentAccountName = useMemo(
    () => accounts.find(account => account.id === currentAccountId)?.name,
    [accounts, currentAccountId],
  )

  useEffect(() => {
    if (currentAccountName) {
      window.ipcRenderer.invoke(IPC_CHANNELS.account.switch, currentAccountName)
    }
  }, [currentAccountName])

  useEffect(() => {
    const removeListeners: (() => void)[] = [
      window.ipcRenderer.on(
        IPC_CHANNELS.tasks.autoReply.showComment,
        (comment: Comment) => {
          handleComment(comment)
        },
      ),
      window.ipcRenderer.on(
        IPC_CHANNELS.tasks.liveControl.disconnect,
        () => {
          setIsConnected(false)
          toast.error('直播控制台已断开连接')
        },
      ),
    ]

    return () => {
      removeListeners.forEach(removeListener => removeListener())
    }
  }, [handleComment, setIsConnected, toast])
}
