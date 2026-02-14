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
from collections import defaultdict


def optimize_shift(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    シフトを最適化する関数（ヒューリスティックアルゴリズム）
    
    スタッフの希望優先度を考慮しつつ、制約条件を満たす最適なシフトを生成する
    - 各スタッフの勤務日数をなるべく均等にする
    - 各日の必要人数制約を満たす
    - 希望日を優先、NG日を除外
    """
    
    # 入力データの取得
    staff_list = input_data.get('staff', [])
    dates = input_data.get('dates', [])
    constraints = input_data.get('constraints', {})
    
    # バリデーション
    if not staff_list:
        return {'success': False, 'error': 'スタッフが登録されていません'}
    if not dates:
        return {'success': False, 'error': '日付が指定されていません'}
    
    # 制約条件
    min_staff = constraints.get('min_staff_per_day', 1)
    max_staff = constraints.get('max_staff_per_day', len(staff_list))
    
    # 結果格納用
    schedule = {date: [] for date in dates}
    staff_work_count = defaultdict(int)
    
    # スタッフ情報を整理
    staff_info = {}
    for staff in staff_list:
        staff_id = staff.get('id') or staff.get('name')
        staff_info[staff_id] = {
            'preferred_dates': set(staff.get('preferred_dates', [])),
            'unavailable_dates': set(staff.get('unavailable_dates', [])),
            'max_days': staff.get('max_days', len(dates)),
            'min_days': staff.get('min_days', 0)
        }
    
    # 各日付に対してスタッフを割り当て
    for date in dates:
        # その日に勤務可能なスタッフをスコア付きでリストアップ
        available_staff = []
        
        for staff_id, info in staff_info.items():
            # NG日は除外
            if date in info['unavailable_dates']:
                continue
            
            # 最大勤務日数を超えていたら除外
            if staff_work_count[staff_id] >= info['max_days']:
                continue
            
            # スコア計算（低いほど優先）
            score = staff_work_count[staff_id] * 10  # 勤務回数が少ない人を優先
            
            # 希望日なら優先度を上げる
            if date in info['preferred_dates']:
                score -= 100
            
            available_staff.append((staff_id, score))
        
        # スコアでソート（低い順）
        available_staff.sort(key=lambda x: x[1])
        
        # 必要人数分を割り当て
        assigned_count = 0
        for staff_id, _ in available_staff:
            if assigned_count >= max_staff:
                break
            
            schedule[date].append(staff_id)
            staff_work_count[staff_id] += 1
            assigned_count += 1
        
        # 最低人数を満たしているかチェック
        if assigned_count < min_staff:
            # 人数不足の場合、既に割り当て済みのスタッフからも追加検討
            pass  # 警告は後で出す
    
    # 結果を整形
    result_schedule = []
    warnings = []
    
    for date in dates:
        assigned = schedule[date]
        result_schedule.append({
            'date': date,
            'staff': assigned,
            'count': len(assigned)
        })
        
        if len(assigned) < min_staff:
            warnings.append(f'{date}: 最低人数 {min_staff}人を満たせません（{len(assigned)}人）')
    
    # 統計情報
    stats = {
        'total_assignments': sum(staff_work_count.values()),
        'staff_distribution': dict(staff_work_count),
        'average_per_staff': round(sum(staff_work_count.values()) / len(staff_list), 1) if staff_list else 0,
        'days_with_shortage': len(warnings)
    }
    
    return {
        'success': True,
        'schedule': result_schedule,
        'stats': stats,
        'warnings': warnings if warnings else None
    }


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function Handler"""
    
    def _set_cors_headers(self):
        """CORS ヘッダーを設定"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_OPTIONS(self):
        """CORS プリフライトリクエスト対応"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_POST(self):
        """POST: シフト最適化を実行"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            input_data = json.loads(body.decode('utf-8'))
            
            result = optimize_shift(input_data)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            error = {'success': False, 'error': 'Invalid JSON'}
            self.wfile.write(json.dumps(error).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._set_cors_headers()
            self.end_headers()
            error = {'success': False, 'error': str(e)}
            self.wfile.write(json.dumps(error).encode('utf-8'))
    
    def do_GET(self):
        """GET: ヘルスチェック"""
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
