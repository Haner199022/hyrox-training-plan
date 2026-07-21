// 全局状态 Hook：profile / splits / completed + 派生数据
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppState, NutritionPrefs, Profile, Segment, WeightEntry } from '@/types'
import { DEFAULT_EXCLUDED_FOODS, DEFAULT_NUTRITION } from '@/types'
import { clearState, defaultState, loadState, saveState } from '@/lib/storage'
import { refreshSpecs, scaleSplits } from '@/lib/hyrox'
import { estimateRace, assessFeasibility } from '@/lib/raceModel'
import { weightVerdict, weightTrajectory } from '@/lib/body'
import { generatePlan } from '@/lib/plan'
import { targetPaceSecPerKm } from '@/lib/hyrox'
import { calorieTarget, macrosFor, fuelingGuide, raceWeekStrategy } from '@/lib/nutrition'
import { todayISO } from '@/lib/tracking'
import { computeZones, effectiveHRmax, raceHRStrategy } from '@/lib/heartrate'

export function useAppState() {
  // 首次使用时将计划开始日期默认为今天（在惰性初始化中完成并随下次保存持久化）
  const [state, setState] = useState<AppState>(() => {
    const s = loadState()
    return s.planStartDate ? s : { ...s, planStartDate: todayISO() }
  })

  useEffect(() => {
    saveState(state)
  }, [state])

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
    resetAll,
    ...derived,
  }
}

export type AppStateHook = ReturnType<typeof useAppState>
