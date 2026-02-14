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
    const staffId = staff.id || staff.name;
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

  // フロントエンドが期待する形式に変換
  // { staff_id, date, start_time, end_time } の配列
  const shifts = [];
  for (const date of dates) {
    const assignedStaff = schedule[date];
    for (const staffId of assignedStaff) {
      shifts.push({
        staff_id: staffId,
        date: date,
        start_time: '09:00',
        end_time: '17:00',
      });
    }
  }

  return {
    success: true,
    shifts: shifts,
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
    
    // 直接関数を呼び出し
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
