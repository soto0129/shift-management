// app/page.js
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [stats, setStats] = useState({ staffCount: 0, thisMonthShifts: 0 })

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    // スタッフ数
    const { count: staffCount } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })

    // 今月のシフト数
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    
    const { count: shiftCount } = await supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    setStats({ staffCount: staffCount || 0, thisMonthShifts: shiftCount || 0 })
  }

  const menuItems = [
    {
      href: '/shifts/calendar',
      icon: '📅',
      title: 'シフトカレンダー',
      description: '月間シフトの確認・編集',
      color: 'from-blue-500 to-blue-600',
    },
    {
      href: '/shifts',
      icon: '⚡',
      title: 'シフト自動生成',
      description: 'AIが最適なシフトを作成',
      color: 'from-purple-500 to-purple-600',
    },
    {
      href: '/staff',
      icon: '👥',
      title: 'スタッフ管理',
      description: 'スタッフの登録・編集',
      color: 'from-green-500 to-green-600',
    },
    {
      href: '/analytics',
      icon: '📊',
      title: '勤務統計',
      description: '勤務時間・出勤日数の集計',
      color: 'from-orange-500 to-orange-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ヘッダー */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🗓️</span>
            <div>
              <h1 className="text-xl font-bold text-white">シフト管理システム</h1>
              <p className="text-sm text-slate-400">Shift Management System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* ウェルカムセクション */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            シフト管理をもっとシンプルに
          </h2>
          <p className="text-slate-400 text-lg">
            自動生成・カレンダー表示・統計分析をひとつに
          </p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-whit
