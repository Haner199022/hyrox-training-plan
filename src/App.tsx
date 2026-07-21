import { Flame, RotateCcw } from 'lucide-react'
import { useAppState } from '@/hooks/useAppState'
import { HeroDashboard } from '@/sections/HeroDashboard'
import { ProfileSection } from '@/sections/ProfileSection'
import { HeartRateSection } from '@/sections/HeartRateSection'
import { BreakdownSection } from '@/sections/BreakdownSection'
import { NutritionSection } from '@/sections/NutritionSection'
import { TrackingSection } from '@/sections/TrackingSection'
import { RaceDaySection } from '@/sections/RaceDaySection'
import { PlanSection } from '@/sections/PlanSection'
import { DataSection } from '@/sections/DataSection'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'

export default function App() {
  const app = useAppState()

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-wide">
              HYROX 北京 · <span className="text-primary">SUB-1:20</span> 训练计划
            </div>
            <div className="text-[11px] text-muted-foreground">
              8 × (1km 跑 + 站点) · 数据仅存于本机浏览器
            </div>
          </div>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  重置数据
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认重置全部数据？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将清除个人信息、分段调整与全部训练打卡记录，并恢复为默认 1:20:00 目标方案。此操作不可撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={app.resetAll}>确认重置</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6">
        <HeroDashboard {...app} />
        <Separator />
        <ProfileSection {...app} />
        <Separator />
        <HeartRateSection {...app} />
        <Separator />
        <BreakdownSection {...app} />
        <Separator />
        <NutritionSection {...app} />
        <Separator />
        <TrackingSection {...app} />
        <Separator />
        <RaceDaySection {...app} />
        <Separator />
        <PlanSection {...app} />
        <Separator />
        <DataSection {...app} />

        <footer className="pb-8 pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          本工具的训练与减重建议为基于公开 HYROX 赛制与通用运动科学规则的估算，不构成医疗建议。
          如有健康疑虑请咨询专业医师或教练。
        </footer>
      </main>
    </div>
  )
}
