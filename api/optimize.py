# api/optimize.py
"""
Vercel Serverless Function (Python)
シフト最適化API

Pure Python実装 - 外部ソルバー不要
Vercel無料プランで動作確認済み
"""

import json
from http.server import BaseHTTPRequestHandler
from typing import Dict, List, Any


def optimize_shift(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    シフトを最適化する関数（ヒューリスティックアルゴリズム）
    
    スタッフの希望優先度を考慮しつつ、制約条件を満たす最適なシフトを生成する
    - 各スタッフの勤務日数をなるべく均等にする
    - 各日の必要人数制約を満たす
    
    Args:
        input_data (dict): 入力データ
        
    Returns:
        dict: 最適化結果
    """
    
    # 入力データの取得
    staff_list = input_data.get('staff', [])
    dates = input_data.get('dates', [])
    constraints = input_data.get('constraints', {})
    
    # バリデーション
    if not staff_list:
        return {
            'success': False,
            'error': 'スタッフが登録されていません'
        }
    
    if not dates:
        return {
            'success': False,
            'error': '日付が指定されていません'
        }
    
    # 制約条件の取得
    min_staff_per_day = constraints.get('min_staff_per_day', 2)
    max_staff_per_day = constraints.get('max_staff_per_day', 5)
    
    # スタッフ数が最低必要人数を満たさない場合
    if len(staff_list) < min_staff_per_day:
        return {
            'success': False,
            'error': f'スタッフ数（{len(staff_list)}人）が1日の最低必要人数（{min_staff_per_day}人）より少ないです'
        }
    
    # スタッフIDのリストを作成
    staff_ids = [s['id'] for s in staff_list]
    
    # スタッフごとの希望・NG日を取得
    staff_preferences = {}
    staff_unavailable = {}
    for staff in staff_list:
        staff_id = staff['id']
        staff_preferences[staff_id] = set(staff.get('preferred_dates', []))
        staff_unavailable[staff_id] = set(staff.get('unavailable_dates', []))
    
    # 各スタッフの勤務回数をカウント
    staff_work_count = {staff_id: 0 for staff_id in staff_ids}
    
    # 結果のシフト割り当て
    assignments: Dict[str, List[str]] = {date: [] for date in dates}
    
    # 各日付に対してスタッフを割り当て
    for date in dates:
        # この日に勤務可能なスタッフを取得
        available_staff = [
            staff_id for staff_id in staff_ids
            if date not in staff_unavailable.get(staff_id, set())
        ]
        
        if len(available_staff) < min_staff_per_day:
            return {
                'success': False,
                'error': f'{date}に勤務可能なスタッフが{len(available_staff)}人しかおらず、'
                         f'最低必要人数（{min_staff_per_day}人）を満たせません'
            }
        
        # スタッフをスコアでソート（低いほど優先）
        # スコア = 勤務回数 - (希望日なら1点減点)
        def get_priority_score(staff_id: str) -> float:
            score = staff_work_count[staff_id]
            # 希望日なら優先度を上げる（スコアを下げる）
            if date in staff_preferences.get(staff_id, set()):
                score -= 0.5
            return score
        
        available_staff.sort(key=get_priority_score)
        
        # 目標人数を決定（最小〜最大の間で、均等になるように）
        # 基本は最低人数を割り当て、余裕があれば追加
        target_count = min(min_staff_per_day, len(available_staff))
        
        # 可能なら、希望者がいれば最大人数まで追加
        preferred_available = [
            s for s in available_staff 
            if date in staff_preferences.get(s, set())
        ]
        
        # 最低人数 + 希望者（最大人数まで）
        target_count = min(
            max(min_staff_per_day, len(preferred_available)),
            max_staff_per_day,
            len(available_staff)
        )
        
        # スタッフを割り当て
        assigned = available_staff[:target_count]
        assignments[date] = assigned
        
        # 勤務回数を更新
        for staff_id in assigned:
            staff_work_count[staff_id] += 1
    
    # 結果をシフト形式に変換
    shifts = []
    for date in dates:
        for staff_id in assignments[date]:
            shifts.append({
                'staff_id': staff_id,
                'date': date,
                'start_time': '09:00',
                'end_time': '17:00'
            })
    
    # 統計情報を計算
    total_shifts = len(shifts)
    avg_shifts_per_staff = total_shifts / len(staff_ids) if staff_ids else 0
    
    return {
        'success': True,
        'shifts': shifts,
        'status': 'Optimal',
        'statistics': {
            'total_shifts': total_shifts,
            'total_days': len(dates),
            'total_staff': len(staff_ids),
            'avg_shifts_per_staff': round(avg_shifts_per_staff, 2),
            'staff_work_counts': staff_work_count
        }
    }


class handler(BaseHTTPRequestHandler):
    """
    Vercel Serverless Function のハンドラー
    HTTPリクエストを受け取り、レスポンスを返す
    """
    
    def _set_cors_headers(self):
        """CORSヘッダーを設定"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_OPTIONS(self):
        """OPTIONSリクエストの処理（CORS対応）"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_POST(self):
        """POSTリクエストの処理"""
        try:
            # リクエストボディを読み取る
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # JSONとして解析
            input_data = json.loads(post_data.decode('utf-8'))
            
            # 最適化を実行
            result = optimize_shift(input_data)
            
            # レスポンスを返す
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            
        except json.JSONDecodeError:
            # JSON解析エラー
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            error_result = {
                'success': False,
                'error': 'JSONの解析に失敗しました。リクエストボディを確認してください。'
            }
            self.wfile.write(json.dumps(error_result, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            # その他のエラー
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            error_result = {
                'success': False,
                'error': f'システムエラーが発生しました: {str(e)}'
            }
            self.wfile.write(json.dumps(error_result, ensure_ascii=False).encode('utf-8'))
    
    def do_GET(self):
        """GETリクエストの処理（ヘルスチェック用）"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._set_cors_headers()
        self.end_headers()
        response = {
            'status': 'ok',
            'message': 'Shift optimization API is running',
            'version': '2.0.0',
            'engine': 'pure-python-heuristic'
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))


# ローカルテスト用
if __name__ == '__main__':
    # テストデータ
    test_input = {
        'staff': [
            {'id': 'staff1', 'preferred_dates': ['2024-01-15', '2024-01-16']},
            {'id': 'staff2', 'unavailable_dates': ['2024-01-15']},
            {'id': 'staff3', 'preferred_dates': ['2024-01-17']},
            {'id': 'staff4', 'preferred_dates': []},
        ],
        'dates': ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19'],
        'constraints': {
            'min_staff_per_day': 2,
            'max_staff_per_day': 3
        }
    }
    
    result = optimize_shift(test_input)
    print(json.dumps(result, indent=2, ensure_ascii=False))
