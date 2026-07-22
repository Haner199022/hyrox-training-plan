import { useState } from 'react'
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
 * 动作演示 GIF（懒加载，点击弹出中文动作要领对话框）。
 * mediaKey 无映射时渲染 null（调用方保持纯文本回退）。
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
  if (!mediaKey) return null
  const media = EXERCISE_MEDIA[mediaKey]
  if (!media) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
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
          onError={(e) => {
            // GIF 加载失败时回退静态缩略图
            const img = e.currentTarget
            if (!img.src.endsWith(media.thumb)) img.src = exerciseUrl(media.thumb)
          }}
        />
      </button>

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
          <div className="flex justify-center">
            <img
              src={exerciseUrl(media.gif)}
              alt={media.zhName}
              width={180}
              height={180}
              loading="lazy"
              className="rounded-lg border"
              onError={(e) => {
                const img = e.currentTarget
                if (!img.src.endsWith(media.thumb)) img.src = exerciseUrl(media.thumb)
              }}
            />
          </div>
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
