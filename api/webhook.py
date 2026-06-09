from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

def crawl_genshin_wiki(character_name):
    """
    原神爬蟲邏輯 (範例：前往 Fandom Wiki 抓取英文角色簡介，
    實務上你可以換成任何你想爬的中文網站)
    """
    # 這裡以 Fandom Wiki 為例，通常角色的網址都很規律
    url = f"https://genshin-impact.fandom.com/wiki/{character_name.title()}"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            # 抓取 Wiki 的第一段介紹
            mw_parser = soup.find('div', class_='mw-parser-output')
            if mw_parser:
                paragraphs = mw_parser.find_all('p', recursive=False)
                # 找到第一個有文字的段落
                for p in paragraphs:
                    if p.text.strip():
                        return p.text.strip()[:300] + "..." # 截取前300字
            return "找到了網頁，但沒能解析出角色介紹。"
        return f"找不到角色 '{character_name}' 的資料，請確認英文名稱是否正確。"
    except Exception as e:
        return f"爬取資料時發生錯誤: {str(e)}"

@app.route('/api/webhook', methods=['POST'])
def webhook():
    # 接收來自 Dialogflow 的 JSON 資料
    req = request.get_json(silent=True, force=True)
    
    # 解析 Dialogflow 傳過來的「意圖名稱」與「參數」
    query_result = req.get('queryResult', {})
    intent_name = query_result.get('intent', {}).get('displayName', '')
    parameters = query_result.get('parameters', {})
    
    # 假設你在 Dialogflow 設定了一個叫 "SearchCharacter" 的意圖
    # 並且裡面有一個參數叫 "genshin_char"
    if intent_name == "SearchCharacter":
        character = parameters.get('genshin_char', '')
        if character:
            # 執行爬蟲
            crawler_result = crawl_genshin_wiki(character)
            reply_text = f"【原神情報局】\n為您查詢 {character} 的資料：\n\n{crawler_result}"
        else:
            reply_text = "請輸入正確的角色名稱。"
    else:
        reply_text = "收到請求，但後端不知道怎麼處理這個意圖。"

    # 回傳給 Dialogflow 的標準 JSON 格式
    response_payload = {
        "fulfillmentText": reply_text
    }
    
    return jsonify(response_payload)

# 讓 Vercel 可以順利運行
if __name__ == '__main__':
    app.run(debug=True)
