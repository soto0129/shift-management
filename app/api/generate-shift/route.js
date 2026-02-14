// app/api/generate-shift/route.js
import { NextResponse } from 'next/server'

/**
 * シフト最適化関数（直接実行）
 */
function optimizeShift(inputData) {
  const { staff: staffList = [], dates = [], constraints = {} } = inputData;

  if (!staffList || staffList.length === 0) {
    return { success: false, error: 'スタッフが登録されていません' };
  }
  if (!dates || dates.length === 0) {
    return { success: false, error: '日付が指定されていません' };
  }

  const minStaff = constraints.min_staff_per_day ?? 1;
  const maxStaff = constraints.max_staff_per_day ?? staffList.length;

  const schedule = {};
  dates.forEach(date => { schedule[date] = []; });
  
  const staffWorkCount = {};
  const staffInfo = {};

  staffList.forEach(staff => {
    const staffId = staff.id || staff.name || `staff_${Math.random().toString(36).slice(2, 8)}`;
    staffInfo[staffId] = {
      preferredDates: new Set(staff.preferred_dates || []),
      unavailableDates: new Set(staff.unavailable_dates || []),
      maxDays: staff.max_days ?? dates.length,
    };
    staffWorkCount[staffId] = 0;
  });

  for (const date of dates) {
    const availableStaff = [];

    for (const [staffId, info] of Object.entries(staffInfo)) {
      if (info.unavailableDates.has(date)) continue;
      if (staffWorkCount[staffId] >= info.maxDays) continue;

      let score = staffWorkCount[staffId] * 10;
      if (info.preferredDates.has(date)) score -= 100;

      availableStaff.push({ id: staffId, score });
    }

    availableStaff.sort((a, b) => a.score - b.score);

    let assignedCount = 0;
    for (const { id: staffId } of availableStaff) {
      if (assignedCount >= maxStaff) break;
      schedule[date].push(staffId);
      staffWorkCount[staffId]++;
      assignedCount++;
    }
  }

  const resultSchedule = [];
  const warnings = [];

  for (const date of dates) {
    const assigned = schedule[date];
    resultSchedule.push({ date, staff: assigned, count: assigned.length });
    if (assigned.length < minStaff) {
      warnings.push(`${date}: 最低人数 ${minStaff}人を満たせません（${assigned.length}人）`);
    }
  }

  const totalAssignments = Object.values(staffWorkCount).reduce((sum, count) => sum + count, 0);

  return {
    success: true,
    schedule: resultSchedule,
    stats: {
      total_assignments: totalAssignments,
      staff_distribution: staffWorkCount,
      average_per_staff: staffList.length > 0 ? Math.round((totalAssignments / staffList.length) * 10) / 10 : 0,
      days_with_shortage: warnings.length,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * POSTリクエストハンドラー
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { staff, dates, constraints } = body
    
    if (!staff || !Array.isArray(staff) || staff.length === 0) {
      return NextResponse.json(
        { success: false, error: 'スタッフ情報が不正です' },
        { status: 400 }
      )
    }
    
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { success: false, error: '日付が不正です' },
        { status: 400 }
      )
    }
    
    const requestData = {
      staff: staff.map(s => ({
        id: s.id,
        name: s.name,
        preferred_dates: s.preferred_dates || [],
        unavailable_dates: s.unavailable_dates || [],
        max_days: s.max_days,
      })),
      dates: dates,
      constraints: constraints || {}
    }
    
    // 直接関数を呼び出し（HTTPリクエストなし）
    const result = optimizeShift(requestData)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }
    
  } catch (error) {
    console.error('シフト生成エラー:', error)
    return NextResponse.json(
      { success: false, error: 'システムエラーが発生しました' },
      { status: 500 }
    )
  }
}
