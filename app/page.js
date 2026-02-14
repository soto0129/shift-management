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
            <div className="text-3xl font-bold text-white">{stats.staffCount}</div>
            <div className="text-sm text-slate-400">登録スタッフ</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">{stats.thisMonthShifts}</div>
            <div className="text-sm text-slate-400">今月のシフト</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">
              {new Date().getMonth() + 1}月
            </div>
            <div className="text-sm text-slate-400">現在</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">稼働中</div>
            <div className="text-sm text-slate-400">システム状態</div>
          </div>
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-6 transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:shadow-xl"
            >
              {/* グラデーションアクセント */}
              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.color}`} />
              
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl shadow-lg`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {item.description}
                  </p>
                </div>
                <div className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all">
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* クイックアクション */}
        <div className="mt-10 text-center">
          <p className="text-slate-500 text-sm mb-4">クイックアクション</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/shifts"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-blue-500/30 transition-all"
            >
              🚀 今すぐシフトを作成
            </Link>
            <Link
              href="/staff"
              className="px-6 py-3 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition-all"
            >
              + スタッフを追加
            </Link>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="mt-16 border-t border-white/10 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>Shift Management System - Portfolio Project</p>
        </div>
      </footer>
    </div>
  )
}
