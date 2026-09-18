# 로컬 서버(http://127.0.0.1:8765)에 올린 index.html 의 체감 속도를 잰다.
#  ① 열자마자 현황 표시(캐시 없음/있음)  ② 두 창 실시간 반영  ③ 「선택 완료」 소요
import sys, time, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/index.html'
TEST_MEMBER = '황성욱'   # 오늘 미선택 멤버로 저장·삭제 시험(끝나면 원래대로 되돌린다)

INIT_JS = """
window.__t0 = performance.now();
window.__firstData = null;
const target = () => document.getElementById('panelCount');
const obs = new MutationObserver(() => {
  const el = target();
  if (el && el.textContent.trim() !== '0' && window.__firstData === null) {
    window.__firstData = performance.now() - window.__t0;
  }
});
document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true, characterData: true }));
"""

def open_page(ctx, clear_cache):
    page = ctx.new_page()
    page.add_init_script(INIT_JS)
    if clear_cache:
        page.goto(URL); page.evaluate("localStorage.clear()")
    page.goto(URL)
    page.wait_for_function("window.__firstData !== null", timeout=15000)
    first = page.evaluate("window.__firstData")
    return page, first

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()

    # ① 캐시 없음(첫 방문) → 첫 현황 표시까지
    page_a, cold = open_page(ctx, clear_cache=True)
    print(f"① 첫 방문(캐시 없음) 현황 표시: {cold:.0f} ms")
    # ① 재방문(캐시 있음)
    page_a.close()
    page_a, warm = open_page(ctx, clear_cache=False)
    print(f"① 재방문(캐시 있음) 현황 표시: {warm:.0f} ms")

    # ② 두 창 실시간 반영 + ③ 선택 완료
    ctx2 = browser.new_context()
    page_b, _ = open_page(ctx2, clear_cache=True)
    before = page_a.evaluate("JSON.stringify(lunchData[%s] || null)" % json.dumps(TEST_MEMBER))
    print(f"   시험 멤버 {TEST_MEMBER} 기존 값: {before}")

    page_a.click(f".m-card:has-text('{TEST_MEMBER}')")
    page_a.click(".menu-card:has-text('빅맥 세트')")
    t0 = time.perf_counter()
    page_a.click("#submitBtn")
    page_a.wait_for_function("document.getElementById('submitBtn').textContent.includes('저장 완료')", timeout=10000)
    t_save = (time.perf_counter() - t0) * 1000
    print(f"③ 「선택 완료」 → 저장 완료 표시: {t_save:.0f} ms")

    page_b.wait_for_function(
        "() => { const d = lunchData[%s]; return d && d.menuChoice === 'bigmac'; }" % json.dumps(TEST_MEMBER), timeout=10000)
    t_sync = (time.perf_counter() - t0) * 1000
    print(f"② 다른 창에 반영(저장 시작 기준): {t_sync:.0f} ms")

    # ④ 기타(직접 입력) 저장
    page_a.wait_for_timeout(1700)
    page_a.click(f".m-card:has-text('{TEST_MEMBER}')")
    page_a.click(".menu-card:has-text('기타 (직접 입력)')")
    page_a.fill("#customMenuInput", "측정용 메뉴")
    page_a.click("#submitBtn")
    page_b.wait_for_function(
        "() => { const d = lunchData[%s]; return d && d.menuChoice === 'other' && d.customMenu === '측정용 메뉴'; }" % json.dumps(TEST_MEMBER), timeout=10000)
    print("④ 기타(직접 입력) 저장·반영: OK")
    # ④ 미선택 저장
    page_a.wait_for_timeout(1700)
    page_a.click(f".m-card:has-text('{TEST_MEMBER}')")
    page_a.click(".menu-card:has-text('미선택 (안 먹음)')")
    page_a.click("#submitBtn")
    page_b.wait_for_function(
        "() => { const d = lunchData[%s]; return d && d.menuChoice === 'skip'; }" % json.dumps(TEST_MEMBER), timeout=10000)
    print("④ 미선택 저장·반영: OK")

    # ⑤ 모임일 칩
    page_a.wait_for_function("document.getElementById('meetingChipText').textContent !== '확인 중'", timeout=15000)
    print("⑤ 모임일 칩:", page_a.evaluate("document.getElementById('meetingChipText').textContent"))

    # 시험 값 되돌리기 (원래 없던 값이면 삭제)
    page_a.evaluate("""async (prev) => {
      const r = fb.ref(fb.db, 'lunch/' + getCurrentWeekId() + '/' + %s);
      await fb.set(r, prev ? JSON.parse(prev) : null);
    }""" % json.dumps(TEST_MEMBER), before)
    page_b.wait_for_function(
        "(prev) => JSON.stringify(lunchData[%s] || null) === prev" % json.dumps(TEST_MEMBER), arg=before, timeout=10000)
    print(f"   되돌림 확인: {TEST_MEMBER} = {page_b.evaluate('JSON.stringify(lunchData[%s] || null)' % json.dumps(TEST_MEMBER))}")

    errors = page_a.evaluate("window.__errors || []")
    browser.close()
