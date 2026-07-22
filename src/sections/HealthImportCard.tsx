import { useRef, useState } from 'react'
import JSZip from 'jszip'
import { FileUp, Loader2, ShieldCheck } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  LARGE_FILE_THRESHOLD,
  aggregateXml,
  formatBytes,
  type ImportSummary,
} from '@/lib/healthImport'
import { addDays, todayISO } from '@/lib/tracking'

type Phase = 'idle' | 'unzipping' | 'parsing' | 'merging' | 'done' | 'error'

const RANGE_OPTIONS = [
  { value: '30', label: '最近 30 天' },
  { value: '90', label: '最近 90 天（默认）' },
  { value: '365', label: '最近 365 天' },
  { value: 'all', label: '全部' },
]

export function HealthImportCard(app: AppStateHook) {
  const { importHealthDays } = app
  const fileRef = useRef<HTMLInputElement>(null)
  const [range, setRange] = useState('90')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingLarge, setPendingLarge] = useState<{ file: File; size: number } | null>(null)

  const minDate = range === 'all' ? null : addDays(todayISO(), -Number(range))

  const processFile = async (file: File) => {
    setPhase('unzipping')
    setProgress(0)
    setSummary(null)
    setError(null)
    try {
      let xml: string
      if (/\.zip$/i.test(file.name)) {
        const zip = await JSZip.loadAsync(file)
        const entry =
          zip.file('apple_health_export/export.xml') ??
          Object.values(zip.files).find((f) => /(^|\/)export\.xml$/i.test(f.name))
        if (!entry) throw new Error('压缩包中未找到 apple_health_export/export.xml')
        xml = await entry.async('string')
      } else {
        xml = await file.text()
      }
      setPhase('parsing')
      const { days, summary: s } = await aggregateXml(xml, {
        minDate,
        onProgress: (f) => setProgress(Math.round(f * 100)),
      })
      if (s.dayCount === 0) throw new Error('未解析到所选时间范围内的健康数据')
      setPhase('merging')
      await new Promise((r) => setTimeout(r, 30))
      importHealthDays(days)
      setSummary(s)
      setPhase('done')
    } catch (e) {
      setPhase('error')
      setError(
        e instanceof Error
          ? e.message
          : '解析失败：文件过大或格式异常。可缩小时间范围重试，或将导出文件发给 AI 助手离线解析后导入。',
      )
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onPicked = (file: File | undefined) => {
    if (!file) return
    if (!/\.(zip|xml)$/i.test(file.name)) {
      setPhase('error')
      setError('请选择「导出.zip」或 export.xml 文件')
      return
    }
    // 大文件先确认（zip 按文件本身大小估算，xml 按实际大小）
    if (file.size > LARGE_FILE_THRESHOLD) {
      setPendingLarge({ file, size: file.size })
      return
    }
    void processFile(file)
  }

  const busy = phase === 'unzipping' || phase === 'parsing' || phase === 'merging'
  const phaseLabel =
    phase === 'unzipping'
      ? '解压中…'
      : phase === 'parsing'
        ? `解析中… ${progress}%`
        : phase === 'merging'
          ? '合并中…'
          : ''

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <FileUp className="h-4 w-4 text-primary" />
            Apple 健康导入
          </div>
          <span className="flex-1 text-xs text-muted-foreground">
            iPhone「健康 → 导出所有健康数据」得到的「导出.zip」，随时在任意设备导入；日常更新仍走快捷指令。
          </span>
          <Select value={range} onValueChange={setRange} disabled={busy}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
            选择文件
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.xml,application/zip,text/xml"
            className="hidden"
            onChange={(e) => onPicked(e.target.files?.[0])}
          />
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-xs text-sky-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {phaseLabel}
          </div>
        )}
        {phase === 'done' && summary && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
            导入完成：{summary.dayCount} 天数据（{summary.dateRange?.[0]} ~ {summary.dateRange?.[1]}），
            含体重 {summary.weightCount} 条、训练 {summary.workoutCount} 条。
            历史体重已自动写入体重曲线，历史训练已按规则自动打卡。
          </p>
        )}
        {phase === 'error' && error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
            {error}
          </p>
        )}
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
          文件只在浏览器本地解析，不上传到任何服务器；合并规则：快捷指令已推送的数据优先，导入只补充缺失的字段与日期。
        </p>

        <AlertDialog open={pendingLarge !== null} onOpenChange={(o) => !o && setPendingLarge(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>文件较大（{pendingLarge ? formatBytes(pendingLarge.size) : ''}）</AlertDialogTitle>
              <AlertDialogDescription>
                解析超大导出文件可能耗时较长并占用较多内存。建议选择更小的时间范围，或确认继续。若解析失败，可将文件发给 AI 助手离线解析后再导入。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const p = pendingLarge
                  setPendingLarge(null)
                  if (p) void processFile(p.file)
                }}
              >
                继续解析
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
