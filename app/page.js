// app/page.js
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">シフト自動調整システム</h1>
        
        <p className="mb-8 text-lg">
          制約条件に基づいてスタッフのシフトを自動生成するシステムです。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/staff" 
            className="p-6 border rounded-lg hover:bg-gray-100 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">スタッフ管理</h2>
            <p className="text-gray-600">スタッフの登録・編集・削除</p>
          </Link>

          <Link 
            href="/shifts" 
            className="p-6 border rounded-lg hover:bg-gray-100 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">シフト作成</h2>
            <p className="text-gray-600">シフトの自動生成と表示</p>
          </Link>

          <Link 
            href="/analytics" 
            className="p-6 border rounded-lg hover:bg-gray-100 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">工数分析</h2>
            <p className="text-gray-600">労働時間と人件費の可視化</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
