// ============================================================
// AI Study Crew - 점심 메뉴 자동 신청 Google Apps Script
// ============================================================
// 설정 방법:
// 1. https://script.google.com 에서 새 프로젝트 생성
// 2. 이 코드를 Code.gs에 붙여넣기
// 3. 아래 CONFIG 섹션의 값들을 실제 값으로 교체
// 4. 배포 > 새 배포 > 웹 앱 > 액세스 권한: "모든 사용자"
// 5. 배포된 URL을 index.html의 LUNCH_SCRIPT_URL에 입력
// 6. 시간 트리거 설정: setupTrigger() 함수 실행
// ============================================================

// ===== 설정 =====
const CONFIG = {
  SPREADSHEET_ID: '1PnHhKZpUES1aINmQMaa3F7RIpn1BU-ptgjwmQEGf2jU',
  LUNCH_SHEET_NAME: '점심메뉴',
  MEMBERS_SHEET_NAME: '멤버',
  STUDY_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz2CCEL-5_-BHuSrVxEzSyQGmoFEfXyPGniQ_spVDmeBmtxoBajTboZuo_xK9ngyHIv7A/exec',
  POWER_AUTOMATE_WEBHOOK_URL: 'YOUR_POWER_AUTOMATE_WEBHOOK_URL_HERE',
  LUNCH_WEB_APP_URL: 'YOUR_LUNCH_WEB_APP_URL_HERE',
  DEFAULT_MEMBERS: ['김근아', '나희진', '이상용', '이예진', '이용성', '조인주', '황성욱']
};

// ===== 식당 & 메뉴 데이터 (프론트엔드와 동일) =====
const RESTAURANTS = {
  mcdonalds: {
    name: '맥도날드 울산옥현점',
    icon: '🍔',
    menus: [
      { id: 'bigmac', name: '빅맥 세트', price: '9,000원' },
      { id: 'shanghai', name: '맥스파이시 상하이버거 세트', price: '9,100원' },
      { id: '1955', name: '1955 버거 세트', price: '9,800원' },
      { id: 'bulgogi', name: '불고기버거 세트', price: '6,900원' },
      { id: 'double_bulgogi', name: '더블 불고기버거 세트', price: '8,200원' },
      { id: 'shushu', name: '슈슈버거 세트', price: '7,400원' },
      { id: 'mcchicken', name: '맥치킨 세트', price: '7,000원' },
      { id: 'mcchicken_mozz', name: '맥치킨 모짜렐라 세트', price: '8,700원' }
    ]
  },
  ssamai: {
    name: '쌈마이닭쌈밥 무거점',
    icon: '🍚',
    menus: [
      { id: 'roast', name: '쌈마이 닭쌈밥 백반도시락', price: '8,900원' },
      { id: 'yangnyeom', name: '양념 닭쌈밥 백반도시락', price: '9,500원' },
      { id: 'fire', name: '핵불닭쌈밥 백반도시락', price: '9,500원' },
      { id: 'garlic', name: '마늘닭쌈밥 백반도시락', price: '9,500원' },
      { id: 'gobabi', name: '고바비 백반도시락 (2인분)', price: '18,500원' }
    ]
  }
};

// ===== 유틸리티 =====

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getLunchSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.LUNCH_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LUNCH_SHEET_NAME);
    sheet.appendRow(['weekId', 'memberName', 'menuChoice', 'customMenu', 'restaurant', 'timestamp']);
  }
  return sheet;
}

function getMembersSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.MEMBERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.MEMBERS_SHEET_NAME);
    sheet.appendRow(['members']);
    sheet.appendRow([JSON.stringify(CONFIG.DEFAULT_MEMBERS)]);
  }
  return sheet;
}

function getMembers() {
  const sheet = getMembersSheet();
  const data = sheet.getRange(2, 1).getValue();
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return CONFIG.DEFAULT_MEMBERS;
    }
  }
  return CONFIG.DEFAULT_MEMBERS;
}

function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return year + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
}

function getCurrentWeekId() {
  const today = new Date();
  const currentDay = today.getDay();
  const mon = new Date(today);
  if (currentDay === 0) {
    mon.setDate(today.getDate() - 6);
  } else {
    mon.setDate(today.getDate() + (1 - currentDay));
  }
  return getISOWeekString(mon);
}

function getTodayDayKey() {
  const dayMap = { 3: 'wed', 4: 'thu', 5: 'fri' };
  const today = new Date();
  return dayMap[today.getDay()] || null;
}

function formatDateForDay(dayKey) {
  const today = new Date();
  const currentDay = today.getDay();
  const dayMap = { 'wed': 3, 'thu': 4, 'fri': 5 };
  const targetDay = dayMap[dayKey];
  if (!targetDay) return dayKey;

  const diff = targetDay - currentDay;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);

  const dayNames = { 'wed': '수요일', 'thu': '목요일', 'fri': '금요일' };
  return (targetDate.getMonth() + 1) + '월 ' + targetDate.getDate() + '일 (' + dayNames[dayKey] + ')';
}

// 날짜 기반 랜덤 식당 선정 (프론트엔드와 동일한 알고리즘)
function hashString(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function selectTodayRestaurant() {
  var dateStr = new Date().toDateString();
  var hash = hashString(dateStr);
  var keys = Object.keys(RESTAURANTS);
  var index = hash % keys.length;
  var key = keys[index];
  return { key: key, restaurant: RESTAURANTS[key] };
}

// ===== 웹 앱 핸들러 =====

function doGet(e) {
  var action = e.parameter.action;
  var result;

  if (action === 'loadLunch') {
    result = handleLoadLunch(e.parameter.weekId);
  } else {
    result = { success: false, error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data;
  try {
    var rawBody = e.postData ? e.postData.contents : '';
    if (!rawBody) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Empty request body' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    data = JSON.parse(rawBody);
  } catch (err) {
    Logger.log('doPost parse error: ' + err.message + ' | body: ' + (e.postData ? e.postData.contents : 'null'));
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid JSON: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var result;

  if (data.action === 'saveLunch') {
    result = handleSaveLunch(data);
  } else {
    result = { success: false, error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleLoadLunch(weekId) {
  if (!weekId) weekId = getCurrentWeekId();

  var sheet = getLunchSheet();
  var data = sheet.getDataRange().getValues();
  var members = getMembers();
  var lunchData = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] === weekId) {
      lunchData[row[1]] = {
        menuChoice: row[2],
        customMenu: row[3] || '',
        restaurant: row[4] || '',
        timestamp: row[5] || ''
      };
    }
  }

  return {
    success: true,
    weekId: weekId,
    members: members,
    lunchData: lunchData
  };
}

function handleSaveLunch(data) {
  var weekId = data.weekId || getCurrentWeekId();
  var memberName = data.memberName;
  var menuChoice = data.menuChoice;
  var customMenu = data.customMenu || '';
  var restaurant = data.restaurant || '';
  var timestamp = new Date().toISOString();

  if (!memberName || !menuChoice) {
    return { success: false, error: 'Missing required fields' };
  }

  var sheet = getLunchSheet();
  var allData = sheet.getDataRange().getValues();

  var found = false;
  for (var i = 1; i < allData.length; i++) {
    if (allData[i][0] === weekId && allData[i][1] === memberName) {
      sheet.getRange(i + 1, 3).setValue(menuChoice);
      sheet.getRange(i + 1, 4).setValue(customMenu);
      sheet.getRange(i + 1, 5).setValue(restaurant);
      sheet.getRange(i + 1, 6).setValue(timestamp);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([weekId, memberName, menuChoice, customMenu, restaurant, timestamp]);
  }

  return { success: true };
}

// ===== 시간 트리거: 모임일 확인 및 Teams 알림 =====

function checkAndNotify() {
  var todayKey = getTodayDayKey();

  if (!todayKey) {
    Logger.log('오늘은 수/목/금이 아닙니다. 스킵.');
    return;
  }

  // 기존 스터디 앱에서 이번 주 투표 데이터 로드
  var weekId = getCurrentWeekId();
  var studyData;

  try {
    var response = UrlFetchApp.fetch(
      CONFIG.STUDY_SCRIPT_URL + '?action=load&weekId=' + encodeURIComponent(weekId),
      { muteHttpExceptions: true }
    );
    studyData = JSON.parse(response.getContentText());
  } catch (error) {
    Logger.log('스터디 데이터 로드 실패: ' + error.message);
    return;
  }

  if (!studyData.success) {
    Logger.log('스터디 데이터 로드 실패: ' + JSON.stringify(studyData));
    return;
  }

  var members = studyData.members || CONFIG.DEFAULT_MEMBERS;
  var availability = studyData.availability || {};

  // 최적 모임일 계산
  var allDates = ['wed', 'thu', 'fri'];
  var maxCount = 0;
  var bestDates = [];

  allDates.forEach(function(date) {
    var count = 0;
    members.forEach(function(member) {
      if (availability[date] && availability[date][member]) {
        count++;
      }
    });
    if (count > maxCount) {
      maxCount = count;
      bestDates = [date];
    } else if (count === maxCount && count > 0) {
      bestDates.push(date);
    }
  });

  Logger.log('최적 모임일: ' + bestDates.join(', ') + ' (참석: ' + maxCount + '명)');

  if (!bestDates.includes(todayKey)) {
    Logger.log('오늘은 최적 모임일이 아닙니다. 스킵.');
    return;
  }

  if (maxCount === 0) {
    Logger.log('참석 가능한 멤버가 없습니다. 스킵.');
    return;
  }

  // 오늘의 식당 랜덤 선정
  var selected = selectTodayRestaurant();
  var restaurantName = selected.restaurant.name;
  var restaurantIcon = selected.restaurant.icon;
  Logger.log('오늘의 식당: ' + restaurantIcon + ' ' + restaurantName);

  // 메뉴 목록 텍스트 생성
  var menuListText = selected.restaurant.menus.map(function(m) {
    return m.price ? (m.name + ' (' + m.price + ')') : m.name;
  }).join('\n');

  // Power Automate Webhook 호출
  var meetingDateStr = formatDateForDay(todayKey);
  var payload = {
    meetingDate: meetingDateStr,
    restaurant: restaurantName,
    restaurantIcon: restaurantIcon,
    menuList: menuListText,
    lunchAppUrl: CONFIG.LUNCH_WEB_APP_URL,
    memberCount: maxCount,
    totalMembers: members.length
  };

  try {
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var webhookResponse = UrlFetchApp.fetch(CONFIG.POWER_AUTOMATE_WEBHOOK_URL, options);
    Logger.log('Power Automate 호출 성공: ' + webhookResponse.getResponseCode());
  } catch (error) {
    Logger.log('Power Automate 호출 실패: ' + error.message);
  }
}

// ===== 트리거 설정 =====

function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'checkAndNotify') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('checkAndNotify')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(50)
    .create();

  Logger.log('트리거가 설정되었습니다. 매일 09:50경에 checkAndNotify()가 실행됩니다.');
}

function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'checkAndNotify') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log('checkAndNotify 트리거가 제거되었습니다.');
}

// ===== 테스트 함수 =====

function testCheckMeetingDay() {
  var todayKey = getTodayDayKey();
  Logger.log('오늘의 요일 키: ' + (todayKey || '수/목/금 아님'));
  Logger.log('현재 주차 ID: ' + getCurrentWeekId());

  var selected = selectTodayRestaurant();
  Logger.log('오늘의 식당: ' + selected.restaurant.icon + ' ' + selected.restaurant.name);
  Logger.log('메뉴: ' + selected.restaurant.menus.map(function(m) { return m.name; }).join(', '));

  try {
    var weekId = getCurrentWeekId();
    var response = UrlFetchApp.fetch(
      CONFIG.STUDY_SCRIPT_URL + '?action=load&weekId=' + encodeURIComponent(weekId),
      { muteHttpExceptions: true }
    );
    var data = JSON.parse(response.getContentText());
    Logger.log('스터디 데이터: ' + JSON.stringify(data));

    if (data.success) {
      var members = data.members || [];
      var availability = data.availability || {};
      var allDates = ['wed', 'thu', 'fri'];
      var maxCount = 0;
      var bestDates = [];

      allDates.forEach(function(date) {
        var count = 0;
        members.forEach(function(member) {
          if (availability[date] && availability[date][member]) {
            count++;
          }
        });
        Logger.log(date + ': ' + count + '명');
        if (count > maxCount) {
          maxCount = count;
          bestDates = [date];
        } else if (count === maxCount && count > 0) {
          bestDates.push(date);
        }
      });

      Logger.log('최적 모임일: ' + bestDates.join(', '));
      Logger.log('오늘이 모임일인가: ' + (bestDates.includes(todayKey) ? '예' : '아니오'));
    }
  } catch (error) {
    Logger.log('테스트 실패: ' + error.message);
  }
}

function testWebhook() {
  var selected = selectTodayRestaurant();
  var menuListText = selected.restaurant.menus.map(function(m) {
    return m.price ? (m.name + ' (' + m.price + ')') : m.name;
  }).join('\n');

  var payload = {
    meetingDate: '4월 16일 (목요일)',
    restaurant: selected.restaurant.name,
    restaurantIcon: selected.restaurant.icon,
    menuList: menuListText,
    lunchAppUrl: CONFIG.LUNCH_WEB_APP_URL || 'https://example.com/lunch',
    memberCount: 5,
    totalMembers: 7
  };

  try {
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(CONFIG.POWER_AUTOMATE_WEBHOOK_URL, options);
    Logger.log('Webhook 응답 코드: ' + response.getResponseCode());
    Logger.log('Webhook 응답: ' + response.getContentText());
  } catch (error) {
    Logger.log('Webhook 테스트 실패: ' + error.message);
  }
}

function initializeSheets() {
  getLunchSheet();
  getMembersSheet();
  Logger.log('시트가 초기화되었습니다.');
}
