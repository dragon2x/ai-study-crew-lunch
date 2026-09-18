# 점심 앱 checkTodayMeeting 시험: ① 오늘(모임일) 칩 켜짐 ② 모임일 아닌 요일로 가정 시 칩 꺼짐 ③ 콘솔 오류 없음
import time
from playwright.sync_api import sync_playwright
URL = 'http://127.0.0.1:8765/index.html'
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context()
    for label, init in [('① 오늘 그대로', None), ('② getTodayKey→wed 가정', "window.addEventListener('DOMContentLoaded',()=>{ window.getTodayKey = () => 'wed'; });"), ('②-2 getTodayKey→null(주말) 가정', "window.addEventListener('DOMContentLoaded',()=>{ window.getTodayKey = () => null; });")]:
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if init: pg.add_init_script(init)
        t0 = time.time(); pg.goto(URL)
        pg.wait_for_function("document.getElementById('meetingChipText').textContent !== '확인 중'", timeout=15000)
        dt = time.time() - t0
        txt = pg.evaluate("document.getElementById('meetingChipText').textContent")
        off = pg.evaluate("document.getElementById('meetingChip').classList.contains('off')")
        time.sleep(1.5)
        print(f"{label}: 칩 '{txt}' off={off} ({dt*1000:.0f} ms) 콘솔 오류: {errs or '없음'}")
        pg.close()
    b.close()
