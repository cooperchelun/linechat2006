from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
import os
# 匯入 Google 官方最新的 GenAI SDK
from google import genai
from google.genai import types

app = Flask(__name__)

# ===============================================================
# 初始化 Gemini 客戶端
# 它會自動去讀取你在 Vercel 後台設定的 GEMINI_API_KEY 環境變數
# ===============================================================
client = genai.Client()

def ask_gemini_to_format(keyword, web_content=None):
    """
    結合 Gemini 的核心：
    - 如果有 web_content，叫 Gemini 依據網頁內容進行「去蕪存菁」的攻略整理。
    - 如果沒有 web_content（爬蟲失敗），叫 Gemini 直接用自身知識庫補足攻略。
    """
    # 嚴格的排版格式與角色設定，強迫 Gemini 吐出你想要的精美格式
    system_instruction = """
    你是一位精通《原神》的專業攻略大師，同時也是「提瓦特情報局」的 AI 秘書。
    你的任務是幫旅行者整理出精煉、美觀的角色攻略。
    
    請「嚴格依據」以下格式回覆，多運用 Emoji 裝飾，並且絕對不要附帶任何外部網頁連結或廢話：

    ✨【{角色/關鍵字名稱} 核心攻略特輯】✨

    ⚔️ 推薦武器：
    - 首選五星：[武器名稱] (簡述核心原因)
    - 四星平民替代：[武器名稱]

    🌸 聖遺物搭配：
    - 畢業套裝：[聖遺物套裝名稱4件套]
    - 主屬性推薦：時之沙([屬性]) / 空之杯([屬性]) / 理之冠([屬性])

    👥 推薦熱門配隊：
    1. [隊伍名稱]：隊員 A + 隊員 B + 隊員 C + 隊員 D
    
    💡 小叮嚀：[一句話簡述該角色的操作核心或培養建議]
    """

    # 根據爬蟲有沒有抓到資料，給 Gemini 不同的指令
    if web_content:
        prompt = f"請幫我閱讀以下關於「{keyword}」的網頁原始資料，並將其去蕪存菁，整理成規定的攻略格式：\n\n{web_content}"
    else:
        prompt = f"我的爬蟲沒有抓到「{keyword}」的網頁資料。請直接用你內建的最新原神知識庫，幫我生成一份「{keyword}」的完整攻略。"

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,  # 降低隨機性，確保專有名詞正確
            )
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini 處理失敗: {str(e)}")
        # 安全退回機制：如果 Gemini 呼叫失敗，有網頁文字就加減吐網頁文字，沒網頁文字就給對應提示
        if web_content:
            return f"✨【提瓦特情報局】✨\n\n（AI排版整理失敗，提供網頁原創內容）：\n\n{web_content[:300]}..."
        return f"🤖 提瓦特情報局 AI 核心受到干擾（可能是 Vercel 的 GEMINI_API_KEY 設定錯誤），請旅行者稍後再試！"


def crawl_genshin_info(keyword):
    """
    保留你原本的極速原神爬蟲，但將結果升級交給 Gemini 處理
    """
    if not keyword:
        return "想要查詢什麼原神資料呢？請輸入關鍵字，例如『芙寧娜』或『鍾離』。"

    url = f"https://wiki.biligame.com/ys/{keyword}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=8)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            mw_output = soup.find('div', class_='mw-parser-output')
            
            if mw_output:
                paragraphs = mw_output.find_all('p')
                text_content = ""
                for p in paragraphs:
                    p_text = p.text.strip()
                    if p_text and len(p_text) > 10:
                        text_content += p_text + "\n"
                    if len(text_content) > 800: # 稍微提高字數，給 Gemini 更多素材
                        break
                
                if text_content:
                    # 💡【結合點 1】爬蟲成功抓到網頁文字 ➔ 丟給 Gemini 重新排版
                    return ask_gemini_to_format(keyword, web_content=text_content)
            
            # 💡【結合點 2】網頁有抓到但沒解析出有用文字 ➔ 讓 Gemini 用自己的大腦回答
            return ask_gemini_to_format(keyword, web_content=None)
        else:
            # 💡【結合點 3】爬蟲找不到網頁（如芙寧娜 404） ➔ 以前會噴連結，現在直接讓 Gemini 用大腦補足
            return ask_gemini_to_format(keyword, web_content=None)
            
    except Exception as e:
        # 💡【結合點 4】網路超時或爬蟲掛掉 ➔ 一樣交給 Gemini 兜底
        return ask_gemini_to_format(keyword, web_content=None)


@app.route('/api/webhook', methods=['POST'])
def webhook():
    try:
        req = request.get_json(silent=True, force=True)
        if not req:
            return jsonify({"fulfillmentText": "後端未收到有效的 JSON 資料。"})

        query_result = req.get('queryResult', {})
        user_text = query_result.get('queryText', '').strip()

        # 只要使用者有輸入字，一律交給 crawl_genshin_info 處理（再由它去分流給 Gemini）
        if user_text:
            reply_text = crawl_genshin_info(user_text)
        else:
            reply_text = "歡迎來到提瓦特情報局！請輸入你想查詢的角色或物品名稱。"

    except Exception as e:
        reply_text = f"Webhook 執行錯誤: {str(e)}"

    return jsonify({"fulfillmentText": reply_text})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
