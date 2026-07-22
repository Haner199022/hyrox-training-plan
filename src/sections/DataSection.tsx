import { useRef, useState } from 'react'
import { Cloud, CloudOff, DatabaseBackup, Download, Loader2, RefreshCw, Upload } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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
import { relativeTime, syncErrorMessage } from '@/lib/gistSync'
import { cn } from '@/lib/utils'

export function DataSection(app: AppStateHook) {
  const { state, replaceState, syncInfo, syncStatus, enableSync, disableSync, syncNow } = app
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncErr, setSyncErr] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

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

  const handleEnable = async () => {
    setSyncBusy(true)
    setSyncErr(null)
    try {
      await enableSync(tokenInput)
      setTokenInput('')
    } catch (e) {
      setSyncErr(syncErrorMessage(e))
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncBusy(true)
    setSyncErr(null)
    try {
      await syncNow()
    } catch (e) {
      setSyncErr(syncErrorMessage(e))
    } finally {
      setSyncBusy(false)
    }
  }

  const enabled = syncInfo.enabled && syncInfo.gistId !== null

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
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
        </div>

        <Separator />

        {/* ── 云端同步 ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              {enabled ? (
                <Cloud className="h-4 w-4 text-emerald-400" />
              ) : (
                <CloudOff className="h-4 w-4 text-muted-foreground" />
              )}
              云端同步（GitHub Gist）
            </div>
            <span
              className={cn(
                'text-xs',
                syncStatus.phase === 'error'
                  ? 'text-red-400'
                  : syncStatus.phase === 'syncing'
                    ? 'text-sky-400'
                    : enabled
                      ? 'text-emerald-400'
                      : 'text-muted-foreground',
              )}
            >
              {!enabled && '未启用'}
              {enabled && syncStatus.phase === 'syncing' && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  同步中…
                </span>
              )}
              {enabled && syncStatus.phase === 'error' && `同步失败（${syncStatus.message ?? '未知原因'}）`}
              {enabled &&
                (syncStatus.phase === 'ok' || syncStatus.phase === 'idle') &&
                `已连接${syncStatus.login ? ` GitHub 账号 ${syncStatus.login}` : ' GitHub'} · 上次同步 ${relativeTime(syncInfo.lastSyncedAt)}`}
              {enabled && syncStatus.note && (
                <span className="ml-2 text-sky-400">· {syncStatus.note}</span>
              )}
            </span>
          </div>

          {!enabled ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="粘贴 GitHub Personal Access Token"
                  className="h-9 max-w-sm font-mono text-xs"
                  autoComplete="off"
                />
                <Button size="sm" onClick={handleEnable} disabled={syncBusy || !tokenInput.trim()}>
                  {syncBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  启用同步
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                步骤：1. 打开{' '}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  github.com/settings/personal-access-tokens/new
                </a>{' '}
                2. 权限只勾 Gists: Read and write 3. 生成后粘贴到这里。
                Token 仅保存在本浏览器，不会上传或写入任何文件；数据存于你自己的私密 Gist。
                多设备同时修改时以最后同步为准。
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncBusy}>
                {syncBusy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                立即同步
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(true)}>
                <CloudOff className="mr-1.5 h-3.5 w-3.5" />
                断开同步
              </Button>
              <span className="text-[11px] text-muted-foreground">
                任何修改会在 2 秒后自动同步；多设备同时修改时以最后同步为准。
              </span>
            </div>
          )}
          {syncErr && <p className="text-xs text-red-400">{syncErr}</p>}
        </div>

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

        <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认断开云同步？</AlertDialogTitle>
              <AlertDialogDescription>
                将清除本浏览器保存的 Token 与云端关联信息；本地数据与云端 Gist 中的数据都会保留，可随时重新启用同步。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  disableSync()
                  setConfirmDisconnect(false)
                }}
              >
                确认断开
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
