from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# ⚔️ 呼叫開源原神 API 取得角色資料
def get_genshin_character(char_name):
    # 將中文名字轉換為 API 認識的英文代號（實際專案建議建立一個對照字典）
    name_map = {
        "胡桃": "hu-tao",
        "神里綾華": "ayaka",
        "鍾離": "zhongli",
        "雷電將軍": "raiden"
    }
    
    eng_name = name_map.get(char_name)
    if not eng_name:
        return f"目前我的資料庫還沒有「{char_name}」的資料，請試試看問：胡桃、鍾離、雷電將軍。"
        
    try:
        # 請求開源的原神資料庫 API
        url = f"https://api.genshin.dev/characters/{eng_name}"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            
            # 解析並組合你要的資料
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

@app.route('/webhook', methods=['POST'])
def webhook():
    req = request.get_json(silent=True, force=True)
    intent_name = req.get('queryResult').get('intent').get('displayName')
    
    if intent_name == 'genshin.character_search':
        # 從 Dialogflow 抓取玩家提到的「角色名字」參數
        parameters = req.get('queryResult').get('parameters')
        char_name = parameters.get('genshin_character') # 這裡要跟 Dialogflow 欄位對應
        
        reply_text = get_genshin_character(char_name)
    else:
        reply_text = "我還不懂這個原神指令，還在努力跟派蒙學習中！"
        
    return jsonify({
        "fulfillmentMessages": [{"text": {"text": [reply_text]}}]
    })

if __name__ == '__main__':
    app.run(port=5000)
