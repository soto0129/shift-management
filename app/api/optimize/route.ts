// app/api/optimize/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface Staff {
  id?: string;
  name?: string;
  preferred_dates?: string[];
  unavailable_dates?: string[];
  max_days?: number;
  min_days?: number;
}

interface Constraints {
  min_staff_per_day?: number;
  max_staff_per_day?: number;
}

interface InputData {
  staff: Staff[];
  dates: string[];
  constraints?: Constraints;
}

interface ScheduleItem {
  date: string;
  staff: string[];
  count: number;
}

interface OptimizeResult {
  success: boolean;
  schedule?: ScheduleItem[];
  stats?: {
    total_assignments: number;
    staff_distribution: Record<string, number>;
    average_per_staff: number;
    days_with_shortage: number;
  };
  warnings?: string[];
  error?: string;
}

function optimizeShift(inputData: InputData): OptimizeResult {
  const { staff: staffList, dates, constraints = {} } = inputData;

  // バリデーション
  if (!staffList || staffList.length === 0) {
    return { success: false, error: 'スタッフが登録されていません' };
  }
  if (!dates || dates.length === 0) {
    return { success: false, error: '日付が指定されていません' };
  }

  // 制約条件
  const minStaff = constraints.min_staff_per_day ?? 1;
  const maxStaff = constraints.max_staff_per_day ?? staffList.length;

  // 結果格納用
  const schedule: Record<string, string[]> = {};
  dates.forEach(date => { schedule[date] = []; });
  
  const staffWorkCount: Record<string, number> = {};

  // スタッフ情報を整理
  const staffInfo: Record<string, {
    preferredDates: Set<string>;
    unavailableDates: Set<string>;
    maxDays: number;
    minDays: number;
  }> = {};

  staffList.forEach(staff => {
    const staffId = staff.id || staff.name || `staff_${Math.random().toString(36).slice(2, 8)}`;
    staffInfo[staffId] = {
      preferredDates: new Set(staff.preferred_dates || []),
      unavailableDates: new Set(staff.unavailable_dates || []),
      maxDays: staff.max_days ?? dates.length,
      minDays: staff.min_days ?? 0,
    };
    staffWorkCount[staffId] = 0;
  });

  // 各日付に対してスタッフを割り当て
  for (const date of dates) {
    // その日に勤務可能なスタッフをスコア付きでリストアップ
    const availableStaff: { id: string; score: number }[] = [];

    for (const [staffId, info] of Object.entries(staffInfo)) {
      // NG日は除外
      if (info.unavailableDates.has(date)) {
        continue;
      }

      // 最大勤務日数を超えていたら除外
      if (staffWorkCount[staffId] >= info.maxDays) {
        continue;
      }

      // スコア計算（低いほど優先）
      let score = staffWorkCount[staffId] * 10; // 勤務回数が少ない人を優先

      // 希望日なら優先度を上げる
      if (info.preferredDates.has(date)) {
        score -= 100;
      }

      availableStaff.push({ id: staffId, score });
    }

    // スコアでソート（低い順）
    availableStaff.sort((a, b) => a.score - b.score);

    // 必要人数分を割り当て
    let assignedCount = 0;
    for (const { id: staffId } of availableStaff) {
      if (assignedCount >= maxStaff) {
        break;
      }

      schedule[date].push(staffId);
      staffWorkCount[staffId]++;
      assignedCount++;
    }
  }

  // 結果を整形
  const resultSchedule: ScheduleItem[] = [];
  const warnings: string[] = [];

  for (const date of dates) {
    const assigned = schedule[date];
    resultSchedule.push({
      date,
      staff: assigned,
      count: assigned.length,
    });

    if (assigned.length < minStaff) {
      warnings.push(`${date}: 最低人数 ${minStaff}人を満たせません（${assigned.length}人）`);
    }
  }

  // 統計情報
  const totalAssignments = Object.values(staffWorkCount).reduce((sum, count) => sum + count, 0);
  const stats = {
    total_assignments: totalAssignments,
    staff_distribution: staffWorkCount,
    average_per_staff: staffList.length > 0 
      ? Math.round((totalAssignments / staffList.length) * 10) / 10 
      : 0,
    days_with_shortage: warnings.length,
  };

  return {
    success: true,
    schedule: resultSchedule,
    stats,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const inputData: InputData = await request.json();
    const result = optimizeShift(inputData);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Shift optimization API is running',
    version: '2.0.0',
    engine: 'typescript-heuristic',
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
