import { useAutoReplyStore } from '@/hooks/useAutoReply'
import { SendHorizontalIcon } from 'lucide-react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ScrollArea } from '../ui/scroll-area'

import { Separator } from '../ui/separator'

export default function PreviewList({ setHighLight }: { setHighLight: (commentId: string | null) => void }) {
  const { replies, comments } = useAutoReplyStore()

  const handleSendReply = async (replyContent: string, _commentId: string) => {
    try {
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoReply.sendReply, replyContent)
      // removeReply(commentId)
    }
    catch (error) {
      console.error('发送回复失败:', error)
    }
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>回复预览</CardTitle>
        <CardDescription>AI 生成的回复内容</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent>
        <ScrollArea className="py-2 h-[600px]">
          <div className="space-y-1">
            {replies.length === 0
              ? (
                  <div className="text-center text-muted-foreground py-8">
                    暂无回复数据
                  </div>
                )
              : replies.map((reply) => {
                  const relatedComment = comments.find(c => c.id === reply.commentId)
                  return (
                    <div
                      key={reply.commentId}
                      className="group px-3 py-1.5 text-sm hover:bg-muted/50 rounded-lg transition-colors"
                      onMouseEnter={() => setHighLight(reply.commentId)}
                      onMouseLeave={() => setHighLight(null)}
                    >
                      <div className="flex flex-col gap-1">
                        {relatedComment && (
                          <div className="text-xs text-muted-foreground">
                            回复：
                            {relatedComment.nickname}
                            {' '}
                            -
                            {' '}
                            {relatedComment.content}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-700 flex-1">{reply.replyContent}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="invisible group-hover:visible h-6 w-6"
                            onClick={() => handleSendReply(reply.replyContent, reply.commentId)}
                          >
                            <SendHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
