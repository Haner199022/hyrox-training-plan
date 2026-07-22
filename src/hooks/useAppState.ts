// 全局状态 Hook：profile / splits / completed + 派生数据 + Gist 云同步
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, NutritionPrefs, Profile, Segment, WeightEntry } from '@/types'
import { DEFAULT_EXCLUDED_FOODS, DEFAULT_NUTRITION, DEFAULT_SYNC } from '@/types'
import { clearState, defaultState, importState, loadState, saveState } from '@/lib/storage'
import { refreshSpecs, scaleSplits } from '@/lib/hyrox'
import { estimateRace, assessFeasibility } from '@/lib/raceModel'
import { weightVerdict, weightTrajectory } from '@/lib/body'
import { generatePlan } from '@/lib/plan'
import { targetPaceSecPerKm } from '@/lib/hyrox'
import { calorieTarget, macrosFor, fuelingGuide, raceWeekStrategy } from '@/lib/nutrition'
import { todayISO } from '@/lib/tracking'
import { computeZones, effectiveHRmax, raceHRStrategy } from '@/lib/heartrate'
import { applyHealthAutoActions, pullHealth } from '@/lib/health'
import { mergeHealthPayload } from '@/lib/healthImport'
import type { HealthDay } from '@/types'
import {
  SyncError,
  clearSyncToken,
  findOrCreateGist,
  loadSyncToken,
  pullState,
  pushState,
  saveSyncToken,
  syncErrorMessage,
  validateToken,
} from '@/lib/gistSync'

export interface SyncStatus {
  phase: 'off' | 'idle' | 'syncing' | 'ok' | 'error'
  message?: string
  login?: string
  /** 最近一次云端操作结果的提示（如“已从云端同步”） */
  note?: string
}

export function useAppState() {
  // 首次使用时将计划开始日期默认为今天（在惰性初始化中完成并随下次保存持久化）
  const [state, setState] = useState<AppState>(() => {
    const s = loadState()
    return s.planStartDate ? s : { ...s, planStartDate: todayISO() }
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ phase: 'idle' })

  // 已推送/已应用的状态引用：等于它时跳过自动推送，防止“推送后写回 lastSyncedAt”造成循环
  const lastSyncedRef = useRef<AppState>(state)

  useEffect(() => {
    saveState(state)
  }, [state])

  /** 应用远端载荷到本地（updatedAt 较新时），返回是否应用了远端数据 */
  const applyRemoteIfNewer = useCallback(
    (payloadStateJson: string, remoteAt: string) => {
      try {
        const remote = importState(payloadStateJson)
        const localAt = state.sync.lastSyncedAt
        if (localAt && remoteAt <= localAt) return false
        const next: AppState = {
          ...remote,
          sync: { gistId: state.sync.gistId, enabled: true, lastSyncedAt: remoteAt },
        }
        lastSyncedRef.current = next
        setState(next)
        return true
      } catch {
        return false
      }
    },
    [state.sync.gistId, state.sync.lastSyncedAt],
  )

  // ── 启动时拉取（仅一次）──
  const stateRef = useRef(state)
  stateRef.current = state

  /** 拉取 Apple 健康数据并执行幂等自动动作（静默失败：文件不存在/网络问题不影响主流程） */
  const pullHealthNow = useCallback(async () => {
    const token = loadSyncToken()
    const { gistId, enabled } = stateRef.current.sync
    if (!token || !enabled || !gistId) return
    try {
      const payload = await pullHealth(token, gistId)
      if (!payload) return
      setState((prev) => {
        if (JSON.stringify(prev.health.payload) === JSON.stringify(payload)) return prev
        const withPayload: AppState = {
          ...prev,
          health: { ...prev.health, payload, lastPulledAt: new Date().toISOString() },
        }
        return applyHealthAutoActions(withPayload)
      })
    } catch {
      // 健康文件缺失或网络问题：静默，下次拉取重试
    }
  }, [])

  useEffect(() => {
    const token = loadSyncToken()
    const sync = stateRef.current.sync
    if (!token || !sync.enabled || !sync.gistId) return
    let cancelled = false
    setSyncStatus({ phase: 'syncing' })
    ;(async () => {
      try {
        const login = await validateToken(token)
        const payload = await pullState(token, sync.gistId as string)
        if (cancelled) return
        if (payload) {
          const applied = applyRemoteIfNewer(JSON.stringify(payload.state), payload.updatedAt)
          setSyncStatus({
            phase: 'ok',
            login,
            note: applied ? '已从云端同步' : undefined,
          })
        } else {
          setSyncStatus({ phase: 'ok', login })
        }
        // 主数据拉取成功后，顺带拉取健康数据
        void pullHealthNow()
      } catch (e) {
        if (!cancelled) setSyncStatus({ phase: 'error', message: syncErrorMessage(e) })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 变更后防抖自动推送 ──
  useEffect(() => {
    if (state === lastSyncedRef.current) return
    const token = loadSyncToken()
    if (!token || !state.sync.enabled || !state.sync.gistId) return
    const gistId = state.sync.gistId
    setSyncStatus((s) => ({ ...s, phase: 'syncing' }))
    const timer = setTimeout(() => {
      ;(async () => {
        try {
          const payload = await pushState(token, gistId, state)
          setState((prev) => {
            const next: AppState = {
              ...prev,
              sync: { ...prev.sync, lastSyncedAt: payload.updatedAt },
            }
            lastSyncedRef.current = next
            return next
          })
          setSyncStatus((s) => ({ ...s, phase: 'ok', note: undefined }))
        } catch (e) {
          // gist 被删 → 自动重建一次并重试
          if (e instanceof SyncError && e.kind === 'notfound') {
            try {
              const newId = await findOrCreateGist(token, state)
              const payload = await pushState(token, newId, state)
              setState((prev) => {
                const next: AppState = {
                  ...prev,
                  sync: { ...prev.sync, gistId: newId, lastSyncedAt: payload.updatedAt },
                }
                lastSyncedRef.current = next
                return next
              })
              setSyncStatus((s) => ({ ...s, phase: 'ok', note: '云端数据已重建' }))
              return
            } catch (e2) {
              setSyncStatus({ phase: 'error', message: syncErrorMessage(e2) })
              return
            }
          }
          setSyncStatus({ phase: 'error', message: syncErrorMessage(e) })
        }
      })()
    }, 2000)
    return () => clearTimeout(timer)
  }, [state])

  /** 导入 Apple 健康导出数据：与既有健康数据合并（既有字段优先），再走幂等自动动作管道 */
  const importHealthDays = useCallback((importedDays: Record<string, HealthDay>) => {
    setState((prev) => {
      const merged = mergeHealthPayload(prev.health.payload, importedDays)
      const withPayload: AppState = {
        ...prev,
        health: { ...prev.health, payload: merged },
      }
      return applyHealthAutoActions(withPayload)
    })
  }, [])

  // ── 同步操作 ──
  const enableSync = useCallback(async (token: string): Promise<void> => {
    const trimmed = token.trim()
    if (!trimmed) throw new SyncError('unauthorized', 'empty token')
    setSyncStatus({ phase: 'syncing' })
    const login = await validateToken(trimmed)
    const gistId = await findOrCreateGist(trimmed, stateRef.current)
    saveSyncToken(trimmed)
    setState((prev) => {
      const next: AppState = {
        ...prev,
        sync: { gistId, enabled: true, lastSyncedAt: prev.sync.lastSyncedAt },
      }
      return next
    })
    // 若 gist 已存在且有数据，尝试拉取较新的远端数据
    try {
      const payload = await pullState(trimmed, gistId)
      if (payload) {
        setState((prev) => {
          const localAt = prev.sync.lastSyncedAt
          if (localAt && payload.updatedAt <= localAt) return prev
          try {
            const remote = importState(JSON.stringify(payload.state))
            const next: AppState = {
              ...remote,
              sync: { gistId, enabled: true, lastSyncedAt: payload.updatedAt },
            }
            lastSyncedRef.current = next
            return next
          } catch {
            return prev
          }
        })
      }
    } catch {
      // 拉取失败不阻塞启用
    }
    setSyncStatus({ phase: 'ok', login, note: '云同步已启用' })
    void pullHealthNow()
  }, [pullHealthNow])

  const disableSync = useCallback(() => {
    clearSyncToken()
    setState((prev) => ({ ...prev, sync: { ...DEFAULT_SYNC } }))
    setSyncStatus({ phase: 'off' })
  }, [])

  const syncNow = useCallback(async (): Promise<void> => {
    const token = loadSyncToken()
    const gistId = stateRef.current.sync.gistId
    if (!token || !gistId) throw new SyncError('unauthorized', 'sync not enabled')
    setSyncStatus((s) => ({ ...s, phase: 'syncing' }))
    try {
      const payload = await pushState(token, gistId, stateRef.current)
      setState((prev) => {
        const next: AppState = {
          ...prev,
          sync: { ...prev.sync, lastSyncedAt: payload.updatedAt },
        }
        lastSyncedRef.current = next
        return next
      })
      setSyncStatus((s) => ({ ...s, phase: 'ok', note: '已同步到云端' }))
    } catch (e) {
      setSyncStatus({ phase: 'error', message: syncErrorMessage(e) })
      throw e
    }
  }, [])

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((prev) => {
      const nextProfile = { ...prev.profile, ...patch }
      let splits = prev.splits
      // 性别/组别变化 → 刷新站点规格文案
      if (
        (patch.sex && patch.sex !== prev.profile.sex) ||
        (patch.division && patch.division !== prev.profile.division)
      ) {
        splits = refreshSpecs(splits, nextProfile.sex, nextProfile.division)
      }
      // 目标时间变化 → 等比缩放分段并保证总和精确
      if (patch.targetSec && patch.targetSec !== prev.profile.targetSec) {
        splits = scaleSplits(splits, patch.targetSec)
      }
      return { ...prev, profile: nextProfile, splits }
    })
  }, [])

  const updateSegment = useCallback((id: string, targetSec: number) => {
    setState((prev) => ({
      ...prev,
      splits: prev.splits.map((s) => (s.id === id ? { ...s, targetSec } : s)),
    }))
  }, [])

  const rescaleSplits = useCallback((target: number) => {
    setState((prev) => ({ ...prev, splits: scaleSplits(prev.splits, target) }))
  }, [])

  const replaceSplits = useCallback((segs: Segment[]) => {
    setState((prev) => ({ ...prev, splits: scaleSplits(segs, prev.profile.targetSec) }))
  }, [])

  const toggleSession = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      completed: { ...prev.completed, [key]: !prev.completed[key] },
    }))
  }, [])

  const updateNutrition = useCallback((patch: Partial<NutritionPrefs>) => {
    setState((prev) => ({
      ...prev,
      nutrition: { ...prev.nutrition, ...patch },
    }))
  }, [])

  const toggleMeal = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      mealsDone: { ...prev.mealsDone, [key]: !prev.mealsDone[key] },
    }))
  }, [])

  const resetNutrition = useCallback(() => {
    setState((prev) => ({
      ...prev,
      nutrition: { ...DEFAULT_NUTRITION },
      mealsDone: {},
      excludedFoods: [...DEFAULT_EXCLUDED_FOODS],
    }))
  }, [])

  const toggleFoodExcluded = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      excludedFoods: prev.excludedFoods.includes(id)
        ? prev.excludedFoods.filter((x) => x !== id)
        : [...prev.excludedFoods, id],
    }))
  }, [])

  const setFoodsExcluded = useCallback((ids: string[], excluded: boolean) => {
    setState((prev) => {
      const set = new Set(prev.excludedFoods)
      ids.forEach((id) => (excluded ? set.add(id) : set.delete(id)))
      return { ...prev, excludedFoods: [...set] }
    })
  }, [])

  const addWeightEntry = useCallback((entry: WeightEntry) => {
    setState((prev) => {
      const rest = prev.weightLog.filter((e) => e.date !== entry.date)
      return { ...prev, weightLog: [...rest, entry] }
    })
  }, [])

  const removeWeightEntry = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      weightLog: prev.weightLog.filter((e) => e.date !== date),
    }))
  }, [])

  const setPlanStartDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, planStartDate: date }))
  }, [])

  const toggleRaceCheck = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      raceDayChecks: { ...prev.raceDayChecks, [id]: !prev.raceDayChecks[id] },
    }))
  }, [])

  const addCustomItem = useCallback((groupId: string, label: string) => {
    setState((prev) => {
      const list = prev.customItems[groupId] ?? []
      if (!label.trim() || list.includes(label.trim())) return prev
      return { ...prev, customItems: { ...prev.customItems, [groupId]: [...list, label.trim()] } }
    })
  }, [])

  const removeCustomItem = useCallback((groupId: string, label: string) => {
    setState((prev) => {
      const list = (prev.customItems[groupId] ?? []).filter((x) => x !== label)
      const checks = { ...prev.raceDayChecks }
      delete checks[`custom-${groupId}-${label}`]
      return { ...prev, customItems: { ...prev.customItems, [groupId]: list }, raceDayChecks: checks }
    })
  }, [])

  const setRaceStartTime = useCallback((time: string) => {
    setState((prev) => ({ ...prev, raceStartTime: time }))
  }, [])

  const resetRaceDay = useCallback(() => {
    setState((prev) => ({
      ...prev,
      raceDayChecks: {},
      customItems: {},
      raceStartTime: '09:00',
    }))
  }, [])

  const setHrMaxOverride = useCallback((v: number | null) => {
    setState((prev) => ({ ...prev, hrMaxOverride: v }))
  }, [])

  const setRestingHr = useCallback((v: number | null) => {
    setState((prev) => ({ ...prev, restingHr: v }))
  }, [])

  const toggleStretchStep = useCallback((dayKey: string, stepId: string) => {
    setState((prev) => {
      const list = prev.stretchDone[dayKey] ?? []
      return {
        ...prev,
        stretchDone: {
          ...prev.stretchDone,
          [dayKey]: list.includes(stepId) ? list.filter((x) => x !== stepId) : [...list, stepId],
        },
      }
    })
  }, [])

  const resetAll = useCallback(() => {
    clearState()
    clearSyncToken()
    setSyncStatus({ phase: 'off' })
    setState(defaultState())
  }, [])

  const replaceState = useCallback((next: AppState) => {
    setState(next)
  }, [])

  // ── 派生数据 ──────────────────────────────────────────────
  const derived = useMemo(() => {
    const estimate = estimateRace(state.profile)
    const feasibility = assessFeasibility(estimate, state.profile)
    const verdict = weightVerdict(state.profile)
    const trajectory = weightTrajectory(state.profile, verdict)
    const paceSec = targetPaceSecPerKm(state.splits)
    // 减重窗口：需要减重时按安全速率所需周数
    const cuttingWeeks = verdict.needCut ? Math.min(verdict.weeksNeeded + 1, state.profile.weeksToRace - 2) : 0
    const plan = generatePlan(state.profile, paceSec, cuttingWeeks)
    // ── 营养派生 ──
    const calTarget = calorieTarget(state.profile, verdict, state.nutrition)
    const macros = macrosFor(calTarget.kcal, state.profile, state.nutrition)
    const fueling = fuelingGuide(state.profile)
    const raceWeek = raceWeekStrategy(state.profile)
    // ── 心率派生 ──
    const { hrmax, isOverride: hrmaxIsOverride } = effectiveHRmax(state.profile, state.hrMaxOverride)
    const zoneResult = computeZones(hrmax, state.restingHr)
    const raceHR = raceHRStrategy(hrmax)
    return {
      estimate, feasibility, verdict, trajectory, paceSec, plan, cuttingWeeks,
      calTarget, macros, fueling, raceWeek,
      hrmax, hrmaxIsOverride, zoneResult, raceHR,
    }
  }, [state.profile, state.splits, state.nutrition, state.hrMaxOverride, state.restingHr])

  return {
    state,
    profile: state.profile,
    splits: state.splits as Segment[],
    completed: state.completed,
    nutrition: state.nutrition,
    mealsDone: state.mealsDone,
    excludedFoods: state.excludedFoods,
    weightLog: state.weightLog,
    planStartDate: state.planStartDate,
    raceDayChecks: state.raceDayChecks,
    customItems: state.customItems,
    raceStartTime: state.raceStartTime,
    hrMaxOverride: state.hrMaxOverride,
    restingHr: state.restingHr,
    stretchDone: state.stretchDone,
    syncInfo: state.sync,
    syncStatus,
    health: state.health,
    refreshHealth: pullHealthNow,
    importHealthDays,
    updateProfile,
    updateSegment,
    rescaleSplits,
    replaceSplits,
    toggleSession,
    updateNutrition,
    toggleMeal,
    resetNutrition,
    toggleFoodExcluded,
    setFoodsExcluded,
    addWeightEntry,
    removeWeightEntry,
    setPlanStartDate,
    toggleRaceCheck,
    addCustomItem,
    removeCustomItem,
    setRaceStartTime,
    resetRaceDay,
    setHrMaxOverride,
    setRestingHr,
    toggleStretchStep,
    replaceState,
    enableSync,
    disableSync,
    syncNow,
    resetAll,
    ...derived,
  }
}

export type AppStateHook = ReturnType<typeof useAppState>
