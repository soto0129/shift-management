from pulp import *
import json

def handler(request):
    """
    Vercel Serverless Function
    シフト最適化API
    """
    # POSTリクエストのみ受け付け
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # リクエストボディを取得
        body = request.body
        if isinstance(body, bytes):
            body = body.decode('utf-8')
        
        input_data = json.loads(body) if isinstance(body, str) else body
        
        # データ取得
        staff_list = input_data.get('staff', [])
        dates = input_data.get('dates', [])
        constraints = input_data.get('constraints', {})
        
        # 制約条件
        min_staff_per_day = constraints.get('min_staff_per_day', 2)
        max_staff_per_day = constraints.get('max_staff_per_day', 3)
        
        # スタッフIDリスト
        staff_ids = [st['id'] for st in staff_list]
        
        # 最適化問題を作成
        prob = LpProblem("ShiftScheduling", LpMaximize)
        
        # 決定変数を作成
        x = {}
        for staff_id in staff_ids:
            x[staff_id] = {}
            for date in dates:
                x[staff_id][date] = LpVariable(f"x_{staff_id}_{date}", cat='Binary')
        
        # 目的関数（公平性を最大化）
        prob += 0
        
        # 制約1: 各日の最低・最大人数
        for date in dates:
            prob += lpSum([x[staff_id][date] for staff_id in staff_ids]) >= min_staff_per_day
            prob += lpSum([x[staff_id][date] for staff_id in staff_ids]) <= max_staff_per_day
        
        # 制約2: 各スタッフの週最大勤務日数
        for staff in staff_list:
            staff_id = staff['id']
            max_days = staff.get('max_hours_per_week', 40) // 8
            prob += lpSum([x[staff_id][date] for date in dates]) <= max_days
        
        # 求解
        prob.solve(PULP_CBC_CMD(msg=0))
        
        # 結果を取得
        result = []
        for date in dates:
            for staff in staff_list:
                staff_id = staff['id']
                if x[staff_id][date].varValue == 1:
                    result.append({
                        'staff_id': staff_id,
                        'staff_name': staff['name'],
                        'date': date,
                        'start_time': '09:00',
                        'end_time': '18:00'
                    })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'shifts': result
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
