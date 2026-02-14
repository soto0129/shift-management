// app/api/generate-shift/route.js
import { NextResponse } from 'next/server'

/**
 * シフト自動生成API
 * 
 * 環境による自動切り替え:
 * - Vercel環境: /api/optimize.py (Serverless Function) を呼び出し
 * - ローカル環境: 従来通りspawnでPythonスクリプトを実行
 * 
 * 環境判定: process.env.VERCEL === '1' で判定
 */

// Vercel環境かどうかを判定
const isVercel = process.env.VERCEL === '1'

/**
 * Vercel環境: Python Serverless Functionを呼び出し
 */
async function callVercelPythonAPI(data) {
  try {
    // 自身のドメインの /api/optimize を呼び出す
    // Vercelでは /api/*.py が自動的にServerless Functionになる
    const apiUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/optimize`
      : 'http://localhost:3000/api/optimize'
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.error('Vercel Python API エラー:', error)
    throw error
  }
}

/**
 * ローカル環境: spawnでPythonスクリプトを実行
 */
async function callLocalPython(data) {
  const { spawn } = await import('child_process')
  const path = await import('path')
  
  const scriptPath = path.join(process.cwd(), 'scripts', 'optimize_shift.py')
  const inputData = JSON.stringify(data)
  
  const pythonProcess = spawn('python3', [scriptPath])
  
  let stdout = ''
  let stderr = ''
  
  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString()
  })
  
  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString()
  })
  
  pythonProcess.stdin.write(inputData)
  pythonProcess.stdin.end()
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pythonProcess.kill()
      reject(new Error('TIMEOUT'))
    }, 30000)
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout)
      
      if (code !== 0) {
        console.error('Pythonエラー出力:', stderr)
        reject(new Error('PYTHON_ERROR'))
        return
      }
      
      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (err) {
        console.error('JSON解析エラー:', err)
        console.error('出力内容:', stdout)
        reject(new Error('JSON_PARSE_ERROR'))
      }
    })
    
    pythonProcess.on('error', (err) => {
      clearTimeout(timeout)
      console.error('プロセス起動エラー:', err)
      reject(new Error('PROCESS_ERROR'))
    })
  })
}

/**
 * POSTリクエストハンドラー
 */
export async function POST(request) {
  try {
    // リクエストボディを取得
    const body = await request.json()
    
    const { staff, dates, constraints } = body
    
    // バリデーション
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
    
    // 最適化APIに渡すデータ
    const requestData = {
      staff: staff.map(s => ({
        id: s.id,
        name: s.name,
        max_hours: s.max_hours || 40
      })),
      dates: dates,
      constraints: constraints || {}
    }
    
    // 環境に応じて実行方法を切り替え
    let result
    if (isVercel) {
      console.log('Vercel環境: Python Serverless Functionを呼び出します')
      result = await callVercelPythonAPI(requestData)
    } else {
      console.log('ローカル環境: spawnでPythonスクリプトを実行します')
      result = await callLocalPython(requestData)
    }
    
    // 成功した場合
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }
    
  } catch (error) {
    // エラーログには詳細情報を出力（サーバー側のみ）
    console.error('シフト生成エラー:', error)
    
    // ユーザーには一般的なエラーメッセージのみを返す
    let userMessage = 'システムエラーが発生しました'
    
    if (error.message === 'TIMEOUT') {
      userMessage = 'タイムアウトしました。条件を見直してください。'
    } else if (error.message === 'PYTHON_ERROR') {
      userMessage = 'シフト生成に失敗しました。条件を見直してください。'
    } else if (error.message === 'JSON_PARSE_ERROR') {
      userMessage = 'データ処理に失敗しました。'
    } else if (error.message === 'PROCESS_ERROR') {
      userMessage = 'Pythonの実行に失敗しました。環境を確認してください。'
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: userMessage
      },
      { status: 500 }
    )
  }
}
