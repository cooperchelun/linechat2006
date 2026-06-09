from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

def crawl_genshin_info(keyword):
    """
    極速原神爬蟲：前往 Wiki 直接抓取資料，若失敗則提供預設回覆
    """
    if not keyword:
        return "想要查詢什麼原神資料呢？請輸入關鍵字，例如『芙寧娜』或『鍾離』。"

    # 這裡使用一個對爬蟲極度友善且網址規律的中文 Wiki 作為示範來源
    url = f"https://wiki.biligame.com/ys/{keyword}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=8)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # 嘗試抓取 Wiki 頁面的第一段導言
            mw_output = soup.find('div', class_='mw-parser-output')
            if mw_output:
                # 找到第一個有字數的段落
                paragraphs = mw_output.find_all('p')
                text_content = ""
                for p in paragraphs:
                    p_text = p.text.strip()
                    if p_text and len(p_text) > 10:
                        text_content += p_text + "\n"
                    if len(text_content) > 300:
                        break
                
                if text_content:
                    return f"✨【提瓦特情報局】✨\n\n為您找到關於「{keyword}」的資料：\n\n{text_content[:350]}...\n\n🔗 詳細攻略查看：{url}"
            
            return f"🔍 找到了「{keyword}」的頁面，但目前無法解析出文字，建議直接前往查看：\n{url}"
        else:
            # 如果找不到精確匹配，嘗試改用通用搜尋網址引導使用者
            search_url = f"https://wiki.biligame.com/ys/index.php?search={keyword}"
            return f"🧭 提瓦特地圖查無此地... 找不到精確的「{keyword}」資料。\n\n你可以嘗試到這裡搜尋看看：\n{search_url}"
            
    except Exception as e:
        # 防爆機制：即使爬蟲掛了，也會回傳文字，不會讓前端變空白
        return f"🤖 系統小感冒，暫時無法聯絡派蒙。您可以先到這裡看看：\nhttps://wiki.biligame.com/ys/{keyword}"

@app.route('/api/webhook', methods=['POST'])
def webhook():
    try:
        req = request.get_json(silent=True, force=True)
        if not req:
            return jsonify({"fulfillmentText": "後端未收到有效的 JSON 資料。"})

        query_result = req.get('queryResult', {})
        user_text = query_result.get('queryText', '').strip()
        intent_name = query_result.get('intent', {}).get('displayName', '')

        # 如果是用戶點擊了 Dialogflow 預設的按鈕（例如點了芙寧娜按鈕）
        if user_text == "芙寧娜" or intent_name == "SearchCharacter" or user_text:
            reply_text = crawl_genshin_info(user_text)
        else:
            reply_text = "歡迎來到提瓦特情報局！請輸入你想查詢的角色或物品名稱。"

    except Exception as e:
        reply_text = f"Webhook 執行錯誤: {str(e)}"

    # 嚴格符合 Dialogflow 標準的格式回傳
    response_payload = {
        "fulfillmentText": reply_text
    }
    
    return jsonify(response_payload)

if __name__ == '__main__':
    app.run(debug=True)
