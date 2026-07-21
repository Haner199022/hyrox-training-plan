import { useRef, useState } from 'react'
import { DatabaseBackup, Download, Upload } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { exportState, importState } from '@/lib/storage'

export function DataSection(app: AppStateHook) {
  const { state, replaceState } = app
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const doExport = () => {
    const json = exportState(state)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')
    a.href = url
    a.download = `hyrox-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    setError(null)
    setOkMsg('已导出备份文件')
  }

  const onFilePicked = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      // 先解析校验，通过后再弹确认框
      try {
        importState(text)
        setPendingImport(text)
        setError(null)
      } catch (e) {
        setPendingImport(null)
        setOkMsg(null)
        setError(e instanceof Error ? e.message : '无法解析该文件')
      }
    }
    reader.onerror = () => setError('读取文件失败')
    reader.readAsText(file)
  }

  const confirmImport = () => {
    if (!pendingImport) return
    try {
      const next = importState(pendingImport)
      replaceState(next)
      setOkMsg('导入成功，所有模块数据已更新')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
      setOkMsg(null)
    } finally {
      setPendingImport(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <DatabaseBackup className="h-4 w-4 text-primary" />
          数据管理
        </div>
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          数据保存在本浏览器，换设备时用导出/导入迁移。
        </p>
        <Button variant="outline" size="sm" onClick={doExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          导出数据
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          导入数据
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />
        {error && <p className="w-full text-xs text-red-400">导入失败：{error}</p>}
        {okMsg && !error && <p className="w-full text-xs text-emerald-400">{okMsg}</p>}

        <AlertDialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认导入备份数据？</AlertDialogTitle>
              <AlertDialogDescription>
                导入将覆盖当前浏览器中的全部数据（个人资料、训练打卡、饮食、体重记录、清单勾选）。文件已通过格式校验。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={confirmImport}>确认导入</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
