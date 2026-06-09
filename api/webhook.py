from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
import urllib.parse

app = Flask(__name__)

def crawl_genshin_search(user_question):
    """
    通用爬蟲：將使用者的問題當作關鍵字，前往資料最齊全的 Fandom Wiki 進行內部搜尋，
    並抓取搜尋結果第一條的詳細內容。
    """
    # 將中文或關鍵字進行 URL 編碼 (例如：芙寧娜 -> %E8%8A%99%E5%AF%A7%E5%A8%9C)
    encoded_query = urllib.parse.quote(user_question)
    
    # 這裡以 Genshin Impact Fandom Wiki 的搜尋功能為例
    search_url = f"https://genshin-impact.fandom.com/zh/wiki/Special:%E6%90%9C%E7%B4%A2?query={encoded_query}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        # 1. 先去搜尋頁面
        search_res = requests.get(search_url, headers=headers, timeout=10)
        if search_res.status_code != 200:
            return "抱歉，暫時無法連線到原神資料庫。"
            
        search_soup = BeautifulSoup(search_res.text, 'html.parser')
        
        # 2. 找到搜尋結果的第一個連結
        result_link_element = search_soup.find('a', class_='unified-search__result__title')
        
        if not result_link_element or not result_link_element.get('href'):
            return f"在資料庫中找不到與「{user_question}」相關的內容，小助手下次會更努力！"
            
        target_url = result_link_element['href']
        
        # 3. 前往該詳細頁面爬取真正真正的答案
        detail_res = requests.get(target_url, headers=headers, timeout=10)
        if detail_res.status_code == 200:
            detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
            
            # 抓取頁面的主要內文段落
            mw_parser = detail_soup.find('div', class_='mw-parser-output')
            if mw_parser:
                paragraphs = mw_parser.find_all('p', recursive=False)
                
                # 收集前幾個有內容的段落，組合成回答
                reply_content = ""
                for p in paragraphs:
                    text = p.text.strip()
                    if text:
                        reply_content += text + "\n"
                    if len(reply_content) > 400: # 避免字數太多超過 LINE/網頁限制
                        break
                        
                if reply_content:
                    return f"【即時爬蟲回報】\n\n{reply_content[:400]}...\n\n🔗 詳細來源：{target_url}"
                    
            return "找到了相關網頁，但小助手點進去沒看到文字內容。"
        else:
            return "點進詳細資料頁面時失敗了。"
            
    except Exception as e:
        return f"爬蟲運作時發生未預期的錯誤: {str(e)}"

@app.route('/api/webhook', methods=['POST'])
def webhook():
    # 接收來自 Dialogflow 的 JSON 資料
    req = request.get_json(silent=True, force=True)
    
    # 解析使用者「真正說的那句話」
    query_result = req.get('queryResult', {})
    user_text = query_result.get('queryText', '') # 這是使用者在 LINE 或網頁上打的原始文字
    intent_name = query_result.get('intent', {}).get('displayName', '')
    
    # 只要觸發了我們設定的查詢意圖，就直接啟動通用爬蟲
    if intent_name == "SearchCharacter" or user_text:
        # 呼叫強大的通用爬蟲，直接用使用者打的字去查
        crawler_result = crawl_genshin_search(user_text)
        reply_text = crawler_result
    else:
        reply_text = "小助手在線中！你想查詢什麼關於原神的事情呢？"

    # 回傳給 Dialogflow 的標準格式
    response_payload = {
        "fulfillmentText": reply_text
    }
    
    return jsonify(response_payload)

if __name__ == '__main__':
    app.run(debug=True)
