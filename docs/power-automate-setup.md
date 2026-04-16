# Power Automate 설정 가이드

AI Study Crew 점심 메뉴 알림을 MS Teams에 자동 전송하기 위한 Power Automate 플로우 설정 방법입니다.

---

## 사전 준비

- Microsoft 365 계정 (Power Automate 접근 가능)
- MS Teams 채팅방 또는 채널 (알림을 보낼 대상)

---

## Step 1: Power Automate 플로우 생성

1. [Power Automate](https://make.powerautomate.com/) 접속
2. **만들기** > **인스턴트 클라우드 흐름** 선택
3. 흐름 이름: `AI Study Crew 점심 알림`
4. 트리거 선택: **HTTP 요청을 받을 때** (When an HTTP request is received)
5. **만들기** 클릭

---

## Step 2: HTTP 트리거 설정

1. **HTTP 요청을 받을 때** 트리거 클릭
2. **요청 본문 JSON 스키마** 에 아래 내용 입력:

```json
{
    "type": "object",
    "properties": {
        "meetingDate": {
            "type": "string"
        },
        "restaurant": {
            "type": "string"
        },
        "restaurantIcon": {
            "type": "string"
        },
        "menuList": {
            "type": "string"
        },
        "lunchAppUrl": {
            "type": "string"
        },
        "memberCount": {
            "type": "integer"
        },
        "totalMembers": {
            "type": "integer"
        }
    }
}
```

3. 저장하면 **HTTP POST URL**이 자동 생성됩니다
4. 이 URL을 복사해두세요 (Apps Script의 `POWER_AUTOMATE_WEBHOOK_URL`에 입력)

---

## Step 3: Teams 메시지 전송 액션 추가

1. **새 단계** > **Microsoft Teams** 검색
2. 아래 중 상황에 맞는 액션 선택:

### 옵션 A: 채널에 메시지 게시
- 액션: **채널에 메시지 게시** (Post message in a channel)
- 팀: `[AI Study Crew 팀 선택]`
- 채널: `[알림 채널 선택]`

### 옵션 B: 그룹 채팅에 메시지 전송
- 액션: **채팅 또는 채널에서 메시지 게시** (Post message in a chat or channel)
- 게시 위치: **그룹 채팅**
- 그룹 채팅: `[채팅방 선택]`

3. **메시지** 내용 입력 (아래 내용 복사):

```
🍽️ [AI 스터디 크루] 오늘 점심 메뉴 신청!

🏪 오늘의 식당: [동적 콘텐츠: restaurantIcon] [동적 콘텐츠: restaurant]
📅 모임일: [동적 콘텐츠: meetingDate]
👥 참석 예정: [동적 콘텐츠: memberCount]명 / [동적 콘텐츠: totalMembers]명

📋 메뉴 목록:
[동적 콘텐츠: menuList]

👉 메뉴 선택하기: [동적 콘텐츠: lunchAppUrl]

⏰ 11시까지 선택 부탁드립니다!
```

> **동적 콘텐츠 사용법**: 메시지 작성 시 `[동적 콘텐츠: xxx]` 부분을 클릭하면
> 오른쪽에 동적 콘텐츠 패널이 열립니다. 여기서 `restaurant`, `menuList`, `meetingDate` 등을
> 선택하면 실제 데이터가 자동으로 채워집니다.

---

## Step 4: 저장 및 테스트

1. 오른쪽 상단 **저장** 클릭
2. HTTP 트리거의 **HTTP POST URL**을 복사
3. Google Apps Script의 `Code.gs` 파일에서 `POWER_AUTOMATE_WEBHOOK_URL` 값을 교체
4. Apps Script에서 `testWebhook()` 함수 실행
5. Teams에서 메시지가 수신되는지 확인

---

## 전체 연동 순서 요약

```
1. Google Sheets 생성 & ID 복사
2. Google Apps Script 프로젝트 생성 & Code.gs 붙여넣기
3. Power Automate 플로우 생성 & Webhook URL 복사
4. Apps Script CONFIG에 값 입력:
   - SPREADSHEET_ID
   - POWER_AUTOMATE_WEBHOOK_URL
   - LUNCH_WEB_APP_URL
5. Apps Script 웹 앱 배포 & URL 복사
6. index.html의 LUNCH_SCRIPT_URL에 배포 URL 입력
7. index.html을 GitHub Pages에 배포
8. Apps Script에서 initializeSheets() 실행 (시트 초기화)
9. Apps Script에서 setupTrigger() 실행 (자동 트리거 설정)
10. testWebhook()으로 Teams 알림 테스트
11. testCheckMeetingDay()로 모임일 판별 테스트
```

---

## 문제 해결

### Teams 메시지가 안 오는 경우
- Power Automate 실행 기록 확인 (좌측 메뉴 > 내 흐름 > 실행 기록)
- Webhook URL이 올바른지 확인
- Apps Script 로그 확인 (보기 > 실행)

### 모임일이 아닌 날에도 알림이 오는 경우
- Apps Script에서 `testCheckMeetingDay()` 실행하여 로그 확인
- 스터디 앱에서 투표가 완료되었는지 확인

### CORS 오류가 발생하는 경우
- Apps Script 배포 시 **액세스 권한**이 "모든 사용자"로 설정되었는지 확인
- 웹 앱 URL이 `/exec`으로 끝나는지 확인 (`/dev`가 아님)
