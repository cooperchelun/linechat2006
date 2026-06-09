from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

def get_genshin_character(char_name):
    name_map = {
        "胡桃": "hu-tao",
        "神里綾華": "ayaka",
        "鍾離": "zhongli",
        "雷電將軍": "raiden",
        "納西妲": "nahida",
        "芙寧娜": "furina"
    }
    
    eng_name = name_map.get(char_name)
    if not eng_name:
        return f"目前我的資料庫還沒有「{char_name}」的資料，請試試看問：胡桃、鍾離、雷電將軍。"
        
    try:
        url = f"https://api.genshin.dev/characters/{eng_name}"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            reply = f"【角色情報：{data['name']}】\n"
            reply += f" 元素屬性：{data['vision']}\n"
            reply += f" 使用武器：{data['weapon']}\n"
            reply += f" 所屬地區：{data['nation']}\n"
            reply += f" 簡介：{data['description']}"
            return reply
        else:
            return "找不到該角色的資料，請確認名字是否正確。"
    except Exception as e:
        return "連線到原神資料庫失敗，請稍後再試。"

# 💡 注意：這裡的路由配合 Vercel 的 Serverless 路由
@app.route('/api/index', methods=['POST'])
def webhook():
    req = request.get_json(silent=True, force=True)
    intent_name = req.get('queryResult').get('intent').get('displayName')
    
    if intent_name == 'genshin.character_search':
        parameters = req.get('queryResult').get('parameters')
        char_name = parameters.get('genshin_character')
        reply_text = get_genshin_character(char_name)
    else:
        reply_text = "我還不懂這個原神指令，還在努力跟派蒙學習中！"
        
    return jsonify({
        "fulfillmentMessages": [{"text": {"text": [reply_text]}}]
    })

# 💡 Vercel 不需要 app.run()，只要把 app 暴露出來即可
