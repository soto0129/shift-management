# api/optimize.py
"""
Vercel Serverless Function (Python)
シフト最適化API

Vercelの仕様：
- /api/*.py ファイルは自動的にServerless Functionになる
- PuLPなどの依存関係は requirements.txt で管理
- HTTPリクエスト/レスポンスで処理
"""

import json
from http.server import BaseHTTPRequestHandler
from pulp import LpProblem, LpVariable, LpMaximize, lpSum, value, LpStatus


def optimize_shift(input_data):
    """
    シフトを最適化する関数
    
    スタッフの希望優先度を考慮しつつ、制約条件を満たす最適なシフトを生成する
    
    Args:
        input_data (dict): 入力データ
        
    Returns:
        dict: 最適化結果
    """
    
    # 入力データの取得
    staff_list = input_data.get('staff', [])
    dates = input_data.get('dates', [])
    constraints = input_data.get('constraints', {})
    
    # 制約条件の取得
    min_staff_per_day = constraints.get('min_staff_per_day', 2)
    max_staff_per_day = constraints.get('max_staff_per_day', 5)
    
    # スタッフIDのリストを作成
    staff_ids = [s['id'] for s in staff_list]
    
    # 最適化問題を作成
    # LpMaximize: 目的関数を最大化する
    # スタッフの希望を最大限考慮するため、希望度のスコア合計を最大化
    prob = LpProblem("ShiftScheduling", LpMaximize)
    
    # 決定変数を作成
    # x[i][j] = スタッフiが日jに勤務する場合1、しない場合0（0-1整数変数）
    x = {}
    for staff_id in staff_ids:
        x[staff_id] = {}
        for date in dates:
            x[staff_id][date] = LpVariable(
                f"x_{staff_id}_{date}", 
                cat='Binary'
            )
    
    # 目的関数の設定
    # スタッフの希望を考慮した重み付け
    objective = lpSum([
        x[staff_id][date] * 1  # 重み: 将来的に希望優先度で変更可能
        for staff_id in staff_ids 
        for date in dates
    ])
    prob += objective
    
    # 制約条件1: 各日の最低必要人数
    for date in dates:
        prob += (
            lpSum([x[staff_id][date] for staff_id in staff_ids]) >= min_staff_per_day,
            f"MinStaff_{date}"
        )
    
    # 制約条件2: 各日の最大配置人数
    for date in dates:
        prob += (
            lpSum([x[staff_id][date] for staff_id in staff_ids]) <= max_staff_per_day,
            f"MaxStaff_{date}"
        )
    
    # ソルバーで最適化を実行
    prob.solve()
    
    # 解の状態をチェック
    status = LpStatus[prob.status]
    
    if status != 'Optimal':
        return {
            'success': False,
            'error': '制約条件を満たすシフトが見つかりませんでした。最低人数や最大人数を見直してください。',
            'status': status
        }
    
    # 最適解からシフトを生成
    shifts = []
    for staff_id in staff_ids:
        for date in dates:
            if value(x[staff_id][date]) == 1:
                shifts.append({
                    'staff_id': staff_id,
                    'date': date,
                    'start_time': '09:00',
                    'end_time': '17:00'
                })
    
    return {
        'success': True,
        'shifts': shifts,
        'status': status,
        'objective_value': value(prob.objective)
    }


class handler(BaseHTTPRequestHandler):
    """
    Vercel Serverless Function のハンドラー
    HTTPリクエストを受け取り、レスポンスを返す
    """
    
    def do_POST(self):
        """POSTリクエストの処理"""
        try:
            # リクエストボディを読み取る
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # JSONとして解析
            input_data = json.loads(post_data.decode('utf-8'))
            
            # 最適化を実行
            result = optimize_shift(input_data)
            
            # レスポンスを返す
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            
        except json.JSONDecodeError as e:
            # JSON解析エラー
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_result = {
                'success': False,
                'error': 'JSONの解析に失敗しました'
            }
            self.wfile.write(json.dumps(error_result).encode('utf-8'))
            
        except Exception as e:
            # その他のエラー
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_result = {
                'success': False,
                'error': 'システムエラーが発生しました'
            }
            self.wfile.write(json.dumps(error_result).encode('utf-8'))
    
    def do_GET(self):
        """GETリクエストの処理（ヘルスチェック用）"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {
            'status': 'ok',
            'message': 'Shift optimization API is running'
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
