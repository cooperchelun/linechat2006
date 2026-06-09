import requests
from bs4 import BeautifulSoup

def crawl_genshin_wiki(character_name):
    """
    簡單的爬蟲示範：前往原神 Wiki 抓取特定角色的簡介
    (這裡以某個公開的中文 Wiki 或資料庫為例，網址需根據實際目標調整)
    """
    # 這裡以假設的 Wiki 網址為例，實際開發時要找穩定的來源
    url = f"https://genshin-builds.com/zh/character/{character_name}" 
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            # 假設我們要抓取頁面上的主要文字描述
            main_content = soup.find('div', class_='character-info')
            if main_content:
                return main_content.text.strip()
            else:
                return "找到了網頁，但沒找到角色的詳細區塊。"
        return "找不到該角色的網頁。"
    except Exception as e:
        return f"爬取失敗: {str(e)}"

# --- 測試爬蟲功能 ---
if __name__ == "__main__":
    print("正在幫你查『芙寧娜』的網頁資料...")
    # 實際上需要對應 Wiki 的英文或特定拼音，這裡僅為邏輯示範
    web_data = crawl_genshin_wiki("furina") 
    print("\n[爬取到的原始資料截段]:")
    print(web_data[:200] + "...") 
    
    print("\n下一步：我們會把這段資料丟給 AI，讓它用溫柔的語氣回答旅行者！")
