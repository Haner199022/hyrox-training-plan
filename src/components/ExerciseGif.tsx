import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EXERCISE_ATTRIBUTION, EXERCISE_MEDIA, exerciseUrl } from '@/data/exerciseMedia'
import { cn } from '@/lib/utils'

/**
 * 动作演示入口（懒加载，点击弹出中文动作要领对话框）。
 * - mediaKey 无映射 → 渲染 null（调用方保持纯文本）。
 * - GIF/缩略图加载失败（如公开部署环境无媒体文件）→ 自动降级为「要领」文字按钮，
 *   对话框内隐藏图片区，中文步骤说明（MIT 许可文本）始终可见。无裂图图标、无布局跳动。
 */
export function ExerciseGif({
  mediaKey,
  size = 64,
  className,
}: {
  mediaKey: string | undefined
  size?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [mediaOk, setMediaOk] = useState(true)
  if (!mediaKey) return null
  const media = EXERCISE_MEDIA[mediaKey]
  if (!media) return null

  const openDialog = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(true)
  }

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (!img.src.endsWith(media.thumb)) {
      // GIF 失败 → 尝试静态缩略图
      img.src = exerciseUrl(media.thumb)
    } else {
      // 缩略图也失败 → 该环境无媒体文件，整体降级为纯文本
      setMediaOk(false)
    }
  }

  return (
    <>
      {mediaOk ? (
        <button
          type="button"
          onClick={openDialog}
          className={cn(
            'shrink-0 overflow-hidden rounded-md border border-border transition-colors hover:border-primary/60',
            className,
          )}
          style={{ width: size, height: size }}
          title={`${media.zhName} · 点击查看动作要领`}
          aria-label={`查看 ${media.zhName} 动作演示`}
        >
          <img
            src={exerciseUrl(media.gif)}
            alt={media.zhName}
            width={size}
            height={size}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={handleImgError}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground',
            className,
          )}
          title={`${media.zhName} · 点击查看动作要领`}
          aria-label={`查看 ${media.zhName} 动作要领`}
        >
          <BookOpen className="h-3 w-3" />
          要领
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {media.zhName}
              <Badge variant="outline" className="text-[10px] font-normal">
                {media.enName}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              目标肌群：{media.targetMuscles} · 器械：{media.equipment}
            </DialogDescription>
          </DialogHeader>
          {mediaOk && (
            <div className="flex justify-center">
              <img
                src={exerciseUrl(media.gif)}
                alt={media.zhName}
                width={180}
                height={180}
                loading="lazy"
                className="rounded-lg border"
                onError={handleImgError}
              />
            </div>
          )}
          <ol className="max-h-56 list-decimal space-y-1 overflow-y-auto pl-5 text-sm leading-relaxed text-muted-foreground">
            {media.instructionsZh.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="text-[10px] text-muted-foreground/60">{EXERCISE_ATTRIBUTION}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
