// 영문판(*-en.html) 전용 — 화면에 뜨는 한국어를 영어로 바꿔 보여 준다(11/03, 영상 촬영용).
// 원본 화면 · 공용 JS 는 그대로 두고, 이 파일을 불러오는 영문판 HTML 에서만 동작한다.
// 순서: 문장 통째(EXACT) → 틀(RULES, 숫자 끼운 문장) → 낱말(WORDS, 긴 것부터 바꿈).
// 데이터 · 판단은 한국어 그대로 두고 화면 글자만 바꾸므로, 공용 JS 가 읽는 data-* 값은 건드리지 않는다.
(function () {
  "use strict";
  var KO = /[가-힣]/;

  // ── 문장 통째 ─────────────────────────────────────────
  var EXACT = {
    "v6 · 통합 관제 메인 — APRISM": "APRISM — Integrated Monitoring",
    "오래된 순 · 위험 우선": "Critical first",
    "위험 3건, 주의 9건이 있어요.": "3 critical, 9 warnings.",
    "N₂ 압력계부터 확인하세요.": "Check the N₂ pressure gauge first.",
    "이 미션 위험 2, 다른 미션 위험 1": "This mission 2 critical, other missions 1",
    "위험 3건 포함 12건 누적": "12 in total, incl. 3 critical",
    "위험 3건부터 조치": "Act on 3 critical first",
    "주의 9건 묶어서 확인": "Review 9 warnings together",
    "현장 점검 한꺼번에 요청": "Request field checks at once",
    "대가 있어 로그아웃할 수 없습니다.": "robot(s) running, so you can't log out.",
    "현재 수행 중인 로봇": "Robots currently running",
    "교대 중에 로봇 임무는 중단되지 않습니다.": "Robot missions continue during the handover.",
    "계정 발급 · 잠금 해제 문의 : 설비운영팀 내선 2400": "Account issue · unlock: Facility Ops, ext. 2400",
    "ⓒ 2026 APRISM · 모든 접속 기록은 감사 로그에 저장됩니다.": "ⓒ 2026 APRISM · All access is recorded in the audit log.",
    "로그아웃할까요?": "Log out?",
    "세션이 종료되고 로그인 화면으로 돌아갑니다.": "Your session ends and you return to the login screen.",
    "진행 중인 정기 순회 #248은 중단되지 않으며, 다시 로그인하면 이어서 관제할 수 있습니다.": "Routine Patrol #248 keeps running. Log in again to continue monitoring.",
    "을": "",
    "중지하시겠습니까?": "Stop this robot?",
    "긴급중지시 로봇의 즉시 모터 전원이 차단됩니다. 미션 재개시 시스템 관리자의 로봇 자세 / 안전 점검 확인이 필요합니다.": "E-stop cuts motor power immediately. Resuming the mission requires a system admin to check the robot's posture and safety.",
    "중지하기": "Stop",
    "을 자동복귀 하시겠습니까?": "Send back to dock?",
    "확인 시 진행 중인 미션이 즉시 중단되고 로봇이 시작지점(도킹 스테이션)으로 복귀합니다. 복귀 중에는 자동복귀 버튼이 비활성화됩니다.": "The current mission stops and the robot returns to its start point (docking station). The Return button is disabled while returning.",
    "자동복귀 시작": "Start return",
    "연결된 로봇 11대 · 이름으로 검색해 선택합니다": "11 robots connected · search by name",
    "찾는 이름이 없습니다.": "No matching name.",
    "지도 모델을 불러오는 중": "Loading map model",
    "수행 중인 로봇이 있어 로그아웃할 수 없습니다 — 관제사 교대를 쓰세요": "Robots are running, so you can't log out — use Operator handover",
    "끌어서 너비 조절 · 두 번 눌러 처음 너비로": "Drag to resize · double-click to reset",
    "예) 현장 작업자 대피 확인, 안전 요원 배치 후 재가동 준비": "e.g. Workers evacuated, safety staff on site, prepare restart",
    "마지막 지점 뒤에서는 자동복귀가 의미 없어요": "Return to dock isn't needed after the last point",
    "마지막 지점을 지나 충전 스테이션으로 가는 중이에요": "Past the last point, heading to the charging station",
    "미션 중단, 충전 스테이션으로 복귀 중": "Mission stopped, returning to charging station",
    "미션이 끝났어요": "Mission finished",
    "일시정지 중, 남은 시간 멈춤": "Paused, remaining time on hold",
    "점검 끝, 충전 스테이션으로 이동 중": "Inspection done, heading to charging station",
    "통신이 돌아오면 다시 계산": "Recalculated when connection returns",
    "긴급정지로 멈춤": "Stopped by E-stop",
    "긴급정지, 모터 전원 차단": "E-stop, motor power cut",
    "현장 복구 필요, 이 지점 인근": "On-site recovery needed, near this point",
    "충전 스테이션으로 복귀": "Return to charging station",
    "마지막 통신 2분 전": "Last contact 2 min ago",
    "마지막 통신 11:16:42, 2분 전. 아래 목록은 그 시점 기준이다.": "Last contact 11:16:42, 2 min ago. The list below is as of then.",
    "가스, 열화상 2종 기준 초과": "Gas, thermal: 2 over limit",
    "위치 확인 중": "Locating",
    "자동복귀 중": "Returning to dock",
    "이 미션이 지나지 않는 층": "Floor not on this mission",
    "배정된 미션 없음": "No mission assigned",
    "확인이 필요한 것": "Needs attention",
    "Delta가 답을 쓰는 중": "Delta is writing",
    "보내기는 Delta가 할 수 없어요. 보고서 화면에서 보내 주세요.": "Delta can't send it. Please send it from the Reports screen.",
    "요청을 정리해 두었어요. 실제 전송은 아직 연결되지 않은 시안입니다 — 화면에서는 확인 처리 전까지 알림이 그대로 남아요.": "Request drafted. Sending isn't connected in this prototype — the alert stays until it's marked as checked.",
    "원인 후보는 아직 정리되지 않았어요.": "No likely causes yet.",
    "이 미션에는 Robot 01 한 대가 배정돼 있어요. 지금 WP-04 를 점검 중이고 배터리는 78% 입니다.": "Robot 01 is assigned to this mission. It's inspecting WP-04 now, battery at 78%.",
    "이 알림은 측정 추세 기록이 없어요.": "No trend data for this alert.",
    "점검 순서는 아직 정리되지 않았어요. 알림을 열어 조치를 고르세요.": "No inspection order yet. Open an alert to choose an action.",
    "지금은 알림이 없어요.": "No alerts right now.",
    "지금은 확인할 알림이 없어요.": "Nothing to check right now.",
    "지하발전소 B3 터빈 2 의 N₂ 배관 압력계(WP-04)에서 Spiral Casing 압력이 90 으로 기준 87 을 넘었어요. 최근 3회 측정이 잇달아 올랐습니다. 현장 무전으로 작업을 멈추고 점검을 요청하는 것을 권해요.": "At the N₂ line pressure gauge (WP-04), Turbine 2, B3, Spiral Casing pressure is 90, above the 87 limit. The last 3 readings rose in a row. We recommend stopping work by radio and requesting a field check.",
    "판독 오류보다 실제 이상 쪽으로 보여요.": "Looks like a real anomaly rather than a reading error.",
    "판독 오류일 수도 있어요. 근거를 같이 보세요.": "Could be a reading error. Check the evidence together.",
    "가능한 원인(현장 확인 전 추정)": "Possible causes (estimate before field check)",
    "주의 알림에 대해 물어보세요": "Ask about the warnings",
    "현장이나 로봇 상황을 물어보세요": "Ask about the site or robots",
    "원인이나 조치를 물어보세요": "Ask about causes or actions",
    "Robot 01 다음 지점은?": "Robot 01's next point?",
    "위험 알림 설명해 줘": "Explain the critical alert",
    "점검 계획 초안 만들어 줘": "Draft an inspection plan",
    "알림 몇 개야": "How many alerts?",
    "위험 몇 개야": "How many critical?",
    "주의만 목록에서 보기": "Show warnings only",
    "새 위험 — 비상정지 발동": "New critical — emergency stop triggered",
    "네, 이동해 주세요": "Yes, go there",
    "이어서 물어보세요": "Ask a follow-up",
    "더 알고 싶은 것": "What else to know",
    "보고서 화면으로": "Go to Reports",
    "작업 중지 요청": "Request work stop",
    "현장 무전 연락 요청": "Request radio contact",
    "재측정 후 판단": "Decide after re-measure",
    "현장 점검 순서": "Field check order",
    "같은 설비 이력": "Same equipment history",
    "무엇을 보고 판단했는지": "What it was based on",
    "순회 경로 지켜보는 중...": "Watching the patrol route...",
    "답변 정리 중...": "Writing the answer...",
    "Delta 에게 묻기": "Ask Delta",
    "Delta 에게 묻기 열기": "Open Ask Delta",
    "Delta 창 닫기": "Close Delta",
    "Delta 창 너비": "Delta panel width",
    "Delta와 대화": "Chat with Delta",
    "Delta AI 요약": "Delta AI summary",
    "안전진단에서 이 알림의 감지 결과 보기": "View this alert's detection in Safety",
    "위치 · 감지 · 로봇 정보": "Location · detection · robot",
    "20단계 중 7단계 완료": "7 of 20 steps done",
    "로봇 이름 · 상태로 검색": "Search by robot name or status",
    "사번 또는 아이디를 입력하세요": "Enter employee no. or ID",
    "비밀번호를 입력하세요": "Enter password",
    "LIVE · 카메라": "LIVE · Camera",
    "위치 (odom)": "Position (odom)",
    "메모 (선택)": "Note (optional)",
    "DELTA 조치 제안": "DELTA suggested action",
    "지하발전소 B3 터빈 2 NG 1건 발견": "1 NG found, Turbine 2, B3",
    "지하발전소 터빈 2 NG 1건 발견": "1 NG found, Turbine 2",
    "터빈 2 NG 1건 발견": "1 NG found, Turbine 2",
    "감지 · 측정 항목 + 값": "Detection · item + value",

    // 알림 상세(monitor.js 데이터) — 요약 · 권고 · 조치
    "N₂ 배관 압력 0.86 MPa 로 정상 범위(0.60 ~ 0.80)를 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.": "N₂ line pressure is 0.86 MPa, above the normal range (0.60–0.80). The last 3 readings rose in a row, so it was judged NG.",
    "Spiral Casing Pr. 측정값 90 이 기준값 87 을 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.": "Spiral Casing Pr. reading 90 exceeded the limit of 87. The last 3 readings rose in a row, so it was judged NG.",
    "현장에 무전으로 작업 중지를 요청하세요.": "Radio the site to stop work.",
    "현장 무전 연락 · 작업 중지 요청": "Radio site · request work stop",
    "로봇 정지 · 현장 점검 요청": "Stop robot · request field check",
    "밸브 이음부에서 누출 의심도 62% 로 기준 55% 를 넘었습니다. 연속 2프레임에서 나왔습니다.": "Leak likelihood at the valve joint is 62%, above the 55% limit. Seen in 2 consecutive frames.",
    "밸브 이음부에서 누출 패턴이 신뢰도 0.87 로 검출됐습니다. 임계 0.70 을 넘었고 연속 2프레임에서 나왔습니다.": "A leak pattern was detected at the valve joint with 0.87 confidence, above the 0.70 threshold, in 2 consecutive frames.",
    "구역 출입을 통제하고 설비팀에 밸브 확인을 요청하세요.": "Restrict access to the area and ask the facility team to check the valve.",
    "밸브 이음부 현장 점검을 요청하세요.": "Request a field check of the valve joint.",
    "구역 출입 통제": "Restrict area access",
    "설비팀 밸브 확인 요청": "Ask facility team to check valve",
    "현장 확인": "Check on site",
    "이상 점수 20.4 로 기준 19.0 을 넘었습니다. 저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷합니다.": "Anomaly score 20.4 exceeds the 19.0 limit. Low-frequency energy is up, similar to a bearing wear pattern.",
    "이상 점수 21.6 으로 기준 19.0 을 넘었습니다. 저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷합니다.": "Anomaly score 21.6 exceeds the 19.0 limit. Low-frequency energy is up, similar to a bearing wear pattern.",
    "진동 정밀 측정을 요청하세요.": "Request a detailed vibration measurement.",
    "진동 정밀 측정 요청": "Request vibration measurement",
    "설비 정지 검토 요청": "Request shutdown review",
    "펌프 하우징 최고 48.6℃ 로 기준 40℃ 를 넘었습니다. 평소 36.2℃ 보다 12.4℃ 높습니다.": "Pump housing max is 48.6℃, above the 40℃ limit — 12.4℃ higher than the usual 36.2℃.",
    "부하를 줄이고 점검을 요청하세요.": "Reduce the load and request an inspection.",
    "부하 감소 요청": "Request load reduction",
    "설비 점검 요청": "Request equipment check",
    "CH1 이상 점수 9.05 로 기준 8.60 을 넘었습니다. CH2 · CH3 은 정상 범위입니다.": "CH1 anomaly score 9.05 exceeds the 8.60 limit. CH2 · CH3 are in the normal range.",
    "이상 점수 9.41 로 임계 9.23 을 넘었습니다. PRPD 패턴이 코로나 방전 유형과 일치합니다.": "Anomaly score 9.41 exceeds the 9.23 threshold. The PRPD pattern matches corona discharge.",
    "재진단을 예약해 PRPD 패턴을 다시 확인하세요.": "Schedule a re-diagnosis to recheck the PRPD pattern.",
    "절연 진단을 요청하세요.": "Request an insulation diagnosis.",
    "절연 진단 요청": "Request insulation diagnosis",
    "감시 강화": "Increase monitoring",
    "재진단 예약": "Schedule re-diagnosis",
    "고소 작업 발판에서 안전벨트를 매지 않은 작업자 1명이 신뢰도 0.91 로 검출됐습니다.": "1 worker without a safety harness was detected on the elevated work platform (confidence 0.91).",
    "작업자에게 즉시 착용을 안내하세요.": "Tell the worker to put on a harness now.",
    "작업자 즉시 착용 안내": "Tell worker to wear harness",
    "고소 작업 일시 중지": "Pause elevated work",
    "안전관리팀 전달": "Notify safety team",
    "진동 RMS 4.8 mm/s 로 주의 기준 4.5 를 넘었습니다. 최근 3회 측정에서 계속 오르고 있습니다.": "Vibration RMS 4.8 mm/s exceeds the 4.5 warning level and has risen over the last 3 readings.",
    "베어링 점검을 요청하세요.": "Request a bearing check.",
    "베어링 점검 요청": "Request bearing check",
    "베어링 표면 온도 68.4℃ 로 주의 기준 65℃ 를 넘었습니다. 주변 온도보다 31℃ 높습니다.": "Bearing surface temp 68.4℃ exceeds the 65℃ warning level — 31℃ above ambient.",
    "윤활 상태 점검을 요청하세요.": "Request a lubrication check.",
    "윤활 상태 점검 요청": "Request lubrication check",
    "열화상 재촬영": "Retake thermal image",
    "토출 압력 7.9 bar 로 정상 범위(8.2~8.8) 아래입니다. 흡입 필터가 막혔을 가능성이 있습니다.": "Discharge pressure 7.9 bar is below the normal range (8.2–8.8). The intake filter may be clogged.",
    "흡입 필터 점검을 요청하세요.": "Request an intake filter check.",
    "필터 점검 요청": "Request filter check",
    "재측정 예약": "Schedule re-measure",
    "차압 312 Pa 로 교체 기준 250 Pa 를 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.": "Diff. pressure 312 Pa exceeds the 250 Pa replacement level. The last 3 readings rose in a row, so it was judged NG.",
    "필터 교체와 현장 점검을 요청하세요.": "Request a filter replacement and field check.",
    "필터 교체 요청": "Request filter replacement",
    "압력 0.62 MPa 로 정상 범위(0.65~0.75) 아래입니다. 최근 2회 측정에서 조금씩 내려가고 있습니다.": "Pressure 0.62 MPa is below the normal range (0.65–0.75) and has dropped slightly over the last 2 readings.",
    "배관 연결부 누설 점검을 요청하세요.": "Request a leak check of the pipe joints.",
    "누설 점검 요청": "Request leak check",
    "모터 전원이 차단되었습니다. 현장 안전을 확인한 뒤 해제 절차를 진행하세요.": "Motor power is cut. Confirm site safety, then follow the release procedure.",
    "현장 무전 연락 · 안전 확인": "Radio site · confirm safety",
    "해제 절차 진행": "Start release procedure",
    "로봇 회수 요청": "Request robot recovery",
    "비상정지 발동 · 로봇 구동 차단": "Emergency stop · robot drive cut",
    "현장 안전부터 확인하세요.": "Check site safety first.",
    "AI 추천": "AI pick", "고정 풀기": "Unpin", "메모 접기": "Collapse note",
    "안전진단 화면 준비 중": "Safety screen in preparation",

    // Delta 위젯 · 대화
    "Robot 01 이 정기 순회를 진행하고 있어요. 지금은 특이사항이 없습니다.": "Robot 01 is on its routine patrol. Nothing unusual so far.",
    "홍길동 님, Robot 01 과 정기 순회를 함께 보고 있어요. 지금까지는 특이사항이 없어요. 궁금한 게 있으면 편하게 물어보세요.": "Gildong, I'm watching the routine patrol with Robot 01. Nothing unusual so far. Ask me anything.",
    "인계된 알림 3건과 진행 예정인 미션 1건이 있어요. 먼저 살펴볼까요?": "You have 3 handed-over alerts and 1 upcoming mission. Take a look first?",
    "먼저 확인하는 것을 추천드릴게요.": "I recommend checking it first.",
    "추세 한 번에 보기": "View trends together",
    "처리 순서 알려 줘": "Tell me the action order",
    "네, 보여 주세요": "Yes, show me",
    "구동 차단됨": "Drive cut",
    "순회 경로 지켜보는 중": "Watching the patrol route",
    "위험 알림만 목록에 걸렀어요.": "Filtered the list to critical alerts.",
    "인계 알림을 목록에 펼쳤어요.": "Expanded the handed-over alerts in the list.",
    "확인할 알림은 없어요.": "No alerts to check.",
    "WP-04 압력계가 NG예요.": "WP-04 pressure gauge is NG.",
    "작업 중지부터 요청하세요.": "Request a work stop first.",
    "WP-07 작업자가 안전벨트 미착용이에요.": "A worker at WP-07 has no safety harness.",
    "즉시 착용부터 안내하세요.": "Tell them to put it on now.",
    "WP-02 차압계가 NG예요.": "WP-02 diff. gauge is NG.",
    "필터 교체부터 요청하세요.": "Request a filter replacement first.",
    "현장 점검부터 요청하세요.": "Request a field check first.",
    "감압 밸브 설정부터 보는 게 가장 빨라요.": "Checking the pressure-reducing valve setting is fastest.",
    "작업자 위치부터 확인하는 게 가장 빨라요.": "Locating the worker is fastest.",
    "필터 오염 상태부터 보는 게 가장 빨라요.": "Checking filter contamination is fastest.",
    "감압 밸브 설정 이상": "Pressure-reducing valve misset", "하류 밸브 닫힘": "Downstream valve closed", "주변 온도 상승": "Ambient temperature rise",
    "감압 밸브 설정값 확인(기준 0.80)": "Check reducing valve setting (limit 0.80)", "하류 밸브 열림 확인": "Check downstream valve is open", "계속 오르면 공급 밸브 잠금": "If it keeps rising, close the supply valve",
    "고소 작업 중 벨트 미체결": "Harness not fastened during elevated work", "착용 안내 누락": "No harness briefing",
    "작업자 위치 확인": "Locate the worker", "벨트 착용 안내": "Tell them to wear a harness", "착용 확인 뒤 작업 재개": "Resume work after checking",
    "필터 막힘": "Clogged filter", "흡입구 이물질": "Debris in intake", "팬 풍량 설정 변경": "Fan airflow setting changed",
    "필터 오염 상태 확인": "Check filter contamination", "흡입구 이물질 제거": "Clear intake debris", "기준을 넘으면 필터 교체": "Replace filter if over limit",
    "최근 3회 측정 계속 오름": "Rising over the last 3 readings",
    "연속 2프레임에서 검출": "Detected in 2 consecutive frames",
    "작업자 착용 안내": "Tell worker to wear harness",
    "진동 정밀 측정 요청 ": "Request vibration measurement",
    "근거 — ": "Evidence — ",
    "자동복귀까지": "Return in", "요약 접기": "Collapse summary"
  };

  // ── 숫자 끼운 문장 ─────────────────────────────────────
  var RULES = [
    // Delta 대화 · 위젯 문형(delta-chat.js · monitor.js 가 조각을 이어 만든 문장)
    [/^(위험|주의|알림)[은는] (\d+)건이에요\.$/, "$1: $2."],
    [/^위험 (\d+)건, 주의 (\d+)건이에요\. 이 순서로 보세요\.$/, "$1 critical, $2 warnings. Go in this order."],
    [/^위험 (\d+)건이에요\. 이 순서로 보세요\.$/, "$1 critical. Go in this order."],
    [/^주의 (\d+)건이에요\. 이 순서로 보세요\.$/, "$1 warnings. Go in this order."],
    [/^위험 (\d+)건, 주의 (\d+)건이 있어요\.$/, "$1 critical, $2 warnings."],
    [/^위험 (\d+)건이 있어요\.$/, "$1 critical."],
    [/^(.+)부터 확인하세요\.$/, "Check $1 first."],
    [/^가장 급한 것은 (.+?)(?:이에요|예요)\.$/, "Most urgent: $1."],
    [/^가장 그럴듯한 원인은 (.+?)(?:이에요|예요)\.$/, "Most likely cause: $1."],
    [/^(.+) 현장 점검이 먼저예요\.$/, "Field-check $1 first."],
    [/^(.+) 최근 (\d+)회예요\.$/, "$1: last $2 readings."],
    [/^(\d+)회 측정 (.+), 계속 오름$/, "$1 readings $2, rising"],
    [/^(\d+)회 (.+) \(기준 (.+)\)$/, "#$1 $2 (limit $3)"],
    [/^(\d+)회 (.+)$/, "#$1 $2"],
    [/^오늘 (.+)의 다른 조치 기록은 없어요\.$/, "No other actions on $1 today."],
    [/^안녕하세요\. 지금 위험이 (\d+)건 있어요\.$/, "Hello. $1 critical right now."],
    [/^안녕하세요\. 지금 알림이 (\d+)건 있어요\.$/, "Hello. $1 alerts right now."],
    [/^안녕하세요\. 지금은 알림이 없어요\.$/, "Hello. No alerts right now."],
    [/^안녕하세요\. (.+) 님$/, "Hello, $1"],
    [/^네, 말씀하세요\. 지금은 위험 (\d+)건을 포함해 알림 (\d+)건이 쌓여 있어요\. 위험 알림부터 보시겠어요\?$/, "Sure. $2 alerts so far, incl. $1 critical. Start with the critical ones?"],
    [/^네, 말씀하세요\. 지금은 알림 (\d+)건이 쌓여 있어요\.$/, "Sure. $1 alerts so far."],
    [/^주의 (\d+)건이 쌓여 있어요\. .+$/, "$1 warnings so far. Coolant valve leak · switchgear partial discharge · cooling pump vibration · air compressor pressure deviation are clustered on Robot 05's route — planning one inspection cuts travel."],
    [/^주의 (\d+)건 묶어서 정리해 줘$/, "Summarize $1 warnings together"],
    [/^주의 (\d+)건 묶어 보기$/, "View $1 warnings together"],
    [/^(위험|알림) (\d+)건 보기$/, "View $2 $1"],
    [/^(\d+)건 더 보기$/, "$1 more"],
    [/^위험 (\d+)건을 모두 처리했어요\. 다음은 주의 (\d+)건이에요\.$/, "All $1 critical handled. Next: $2 warnings."],
    [/^위험 (\d+)건을 모두 처리했어요\.$/, "All $1 critical handled."],
    [/^(\d+)\. 이 미션 위험: (.+)$/, "$1. This mission, critical: $2"],
    [/^(\d+)\. 다른 미션 위험: (.+)$/, "$1. Other mission, critical: $2"],
    [/^(\d+)\. 주의 (\d+)건\(이 미션 (\d+), 다른 미션 (\d+)\)$/, "$1. $2 warnings (this mission $3, other $4)"],
    [/^이 미션: (.+)$/, "This mission: $1"],
    [/^다른 미션: (.+)$/, "Other mission: $1"],
    [/^(\d+:\d+(?::\d+)?) 처리$/, "Done $1"],
    [/^상황이 바뀌었어요 — 지금 (.+) 단계$/, "Status changed — now $1"],
    [/^(.+) 조치를 요청했어요$/, "Action requested: $1"],
    [/^(.+) 추세$/, "$1 trend"],
    [/^(.+) 이력$/, "$1 history"],
    [/^오탐 가능성 (\S+) (\d+)%$/, "False-positive chance $1 $2%"],
    [/^오탐 가능성 (\d+)퍼센트$/, "False-positive chance $1%"],
    [/^(.+) — 검출 장면$/, "$1 — detection frame"],
    [/^(.+) — 라이브 뷰$/, "$1 — live view"],
    [/^먼저: (.+)$/, "First: $1"],
    [/^인계 알림 (\d+)건$/, "$1 handed-over alerts"],
    [/^인계 알림이 (\d+)건이에요\.$/, "$1 handed-over alerts."],
    [/^위험 (\d+)건부터 보세요\.$/, "Start with $1 critical."],
    [/^목록에서 하나씩 보세요\.$/, "Go through the list one by one."],
    [/^어서오세요 (.+)님$/, "Welcome, $1"],
    [/^(위험|알림) (\d+)건부터 보여 드릴까요\?$/, "Show the $2 $1 first?"],
    [/^다른 미션에 (위험|주의) 단계 알림이 있어요!$/, "Another mission has a $1 alert!"],
    [/^(위험|주의) 단계 미션으로 이동하기$/, "Go to the $1 mission"],
    [/^지금 미션에서 (\d+)건(?:, 다른 미션에서 (\d+)건)?의 확인해야 할 주의 단계 알림이 있어요\.$/, "$1 warning(s) to check in this mission."],
    [/^(.+)님!$/, "$1!"],
    [/^(.+)[이가] 미션을 완료했어요!$/, "$1 finished the mission!"],
    [/^(.+)[이가] 순회 중이에요\.$/, "$1 is on patrol."],
    [/^(.+)[이가] 멈췄어요\.$/, "$1 stopped."],
    [/^(.+?)(?:으로|로) 옮겼어요\. (.+)$/, "Moved to $1. $2"],
    [/^위험이 (\d+)건 있어요\.$/, "$1 critical."],
    [/^주의가 (\d+)건 있어요\.$/, "$1 warnings."],
    [/^(.+) · 현재 위치$/, "$1 · current location"],
    [/^(B\d) (?:(.+) 미션의 )?(.+?)(?:이에요|예요)\.$/, "$3, $1"],
    [/^(.+) 발생$/, "$1"],
    [/^약 (\d+)시간 (\d+)분 남음 · (\d+:\d+) 종료 예상$/, "About $1 h $2 min left · ends ~$3"],
    [/^약 (\d+)분 남음 · (\d+:\d+) 종료 예상$/, "About $1 min left · ends ~$2"],
    [/^도착 약 (\d+)분 (\d+)초$/, "Arrives in ~$1 min $2 s"],
    [/^도착 약 (\d+)분$/, "Arrives in ~$1 min"],
    [/^도착 약 (\d+)초$/, "Arrives in ~$1 s"],
    [/^(\d+)곳 중 이상 (\d+)곳$/, "$2 of $1 points abnormal"],
    [/^건너뜀 (\d+)곳$/, "Skipped $1"],
    [/^(\d+)대 배정$/, "$1 assigned"],
    [/^(\d+)대 수행중$/, "$1 running"],
    [/^(\d+)단계 중 (\d+)단계 완료$/, "$2 of $1 steps done"],
    [/^(.+) 판독$/, "Reading: $1"],
    [/^(.+) — 끌어서 순서 바꾸기$/, "$1 — drag to reorder"],
    [/^미션 완료 (\d+:\d+)$/, "Mission complete $1"],
    [/^오탐 가능성 (\d+)%$/, "False-positive chance $1%"],
    [/^알림 (\d+)$/, "Alerts $1"],
    [/^위험 (\d+)$/, "Critical $1"],
    [/^주의 (\d+)$/, "Warning $1"],
    [/^전체 (\d+)$/, "All $1"],
    [/^(\d+)건$/, "$1"],
    [/^(\d+)분$/, "$1 min"],
    [/^(\d+)초$/, "$1 s"],
    [/^(\d+)개$/, "$1"],
    [/^(\d+)명$/, "$1 person(s)"],
    [/^설비 (\d+)$/, "Equipment $1"]
  ];

  // ── 낱말(긴 것부터) ───────────────────────────────────
  var WORDS = {
    // 미션
    "전체 미션": "All missions", "미션 전체": "All missions",
    "정기 순회 점검": "Routine Patrol", "발전기실 설비 점검": "Generator Room Check",
    "전기실 열화상 점검": "Electrical Room Thermal", "야간 순회 점검": "Night Patrol",
    "공조 설비 순회": "HVAC Patrol", "유틸리티 순회": "Utility Patrol",
    "통합 순회 현황": "Integrated patrol status", "미션 고르기": "Select mission",
    "보는 범위": "View scope", "정기 순회": "Routine Patrol",
    // 사람 · 계정
    "홍길동": "Gildong Hong", "김현대": "Hyundae Kim", "관제운영": "Operator",
    "내 계정 정보": "My account", "비밀번호 변경": "Change password", "비밀번호 보기": "Show password",
    "로그아웃": "Log out", "관제사 교대": "Operator handover", "로그인": "Log in",
    "아이디": "ID", "비밀번호": "Password", "계정": "Account",
    // 내비
    "전역 내비게이션": "Global navigation", "관제 패널 접기": "Collapse panel",
    "안전진단": "Safety", "스케줄러": "Scheduler", "보고서": "Reports",
    "계정관리": "Accounts", "환경설정": "Settings", "관제": "Monitor",
    "라이트 모드로 바꾸기": "Switch to light mode", "다크 모드로 바꾸기": "Switch to dark mode",
    "라이트 모드": "Light mode", "다크 모드": "Dark mode", "통신 상태": "Connection",
    // 알림 목록
    "최신 알림": "Latest alerts", "전체보기": "View all", "위험도로 거르기": "Filter by severity",
    "오늘 확인 완료 접기": "Collapse checked today", "오늘 확인 완료 펼치기": "Expand checked today",
    "오늘 확인 완료": "Checked today", "진단 상세": "Diagnosis details", "처리 순서 보기": "View action order",
    "요약 펼치기": "Expand summary", "상세보기": "Details", "크게 보기": "Enlarge", "패널에 고정": "Pin to panel",
    // 감지 종류 · 측정
    "계기인식": "Gauge", "안전감지": "Safety", "누출감지": "Leak",
    "이상음향": "Acoustic", "온도감지": "Thermal", "부분방전": "Partial discharge",
    "안전벨트 미착용 1명": "No harness: 1", "안전벨트 미착용": "No harness", "누출 의심도": "Leak likelihood", "이상 점수": "Score",
    "최고 온도": "Max temp", "압력 편차": "Pressure deviation", "진동 상승": "Vibration rising",
    "차압 NG": "Diff. pressure NG", "과열": "Overheat", "계기 판독": "Gauge reading",
    "압력": "Pressure", "차압": "Diff. pressure", "누출": "Leak", "온도": "Temperature", "진동": "Vibration",
    // 처리
    "추이 관찰": "Trend watch", "다음 순회 재측정": "Recheck next round",
    "현장 점검 요청": "Field check", "이상 없음": "No issue", "청소 후 재측정": "Recheck after cleaning",
    "조치 요청": "Request action", "조치 내용": "Action", "메모 펼치기": "Expand note", "되돌리기": "Undo",
    "오탐 가능성": "False-positive chance",
    // 설비
    "N₂ 배관 압력계": "N₂ Line Pressure Gauge", "N₂ 압력계": "N₂ pressure gauge",
    "고소 작업 발판": "Elevated Work Platform", "냉각수 배관 밸브": "Coolant Line Valve",
    "냉각 펌프 P-2": "Cooling Pump P-2", "수배전반 MCC-1": "Switchgear MCC-1",
    "냉각수 열교환기 HX-1": "Coolant Heat Exchanger HX-1", "열교환기 출구 온도 측정": "Heat exchanger outlet temp",
    "FFU-01 토출구": "FFU-01 Outlet", "HEPA Filter 차압계": "HEPA Filter Diff. Gauge",
    "공기 압축기 C-1": "Air Compressor C-1", "발전기 베어링": "Generator bearing",
    "냉각수 밸브": "Coolant valve", "수배전반": "Switchgear", "냉각 펌프": "Cooling pump",
    "공기 압축기": "Air compressor", "작업 발판": "Work platform", "HEPA 차압계": "HEPA diff. gauge",
    "압력계": "pressure gauge", "차압계": "diff. gauge", "펌프 하우징": "Pump housing",
    "기준 초과": "over limit", "압력 낮음": "low pressure", "이상음": "abnormal sound", "벨트 미착용": "no harness",
    "진동감지": "Vibration", "정기 순회 진행 중": "Routine patrol in progress", "관제사": "Operator",
    "지하발전소": "Underground plant", "터빈 2": "Turbine 2", "설비 배치도": "Equipment layout",
    "도킹 스테이션": "Docking station", "충전 스테이션": "Charging station",
    // 로봇 패널
    "전체 로봇 보기": "View all robots", "로봇 상태 보기": "Robot status", "로봇 선택": "Select robot",
    "이전 로봇": "Previous robot", "다음 로봇": "Next robot", "로봇 검색": "Search robots", "로봇 목록": "Robot list",
    "현재 미션": "Current mission", "배터리": "Battery", "마지막 통신": "Last contact", "신호": "Signal",
    "수동조작": "Manual control", "최근 이벤트": "Recent events", "최근 점검": "Last checked", "담당 로봇": "Robot",
    "미션 진행도": "Mission progress",
    // 지도 · 시뮬레이션
    "움직임 시뮬레이션 접기": "Collapse motion sim", "움직임 시뮬레이션 펼치기": "Expand motion sim",
    "움직임 시뮬레이션": "Motion simulation", "지점 측정 중": "Measuring", "위험 감지": "Hazard",
    "일시정지": "Paused", "긴급정지": "E-stop", "통신 끊김": "Signal lost", "미션 완료": "Complete",
    "이동 중": "Moving", "측정 중": "Measuring", "지점 수": "Points", "영상 리플레이": "Video replay",
    "확대": "Zoom in", "축소": "Zoom out", "전체 보기": "Fit view", "탑뷰": "Top view",
    "자동복귀": "Return", "재생": "Play", "재개": "Resume", "멈춤": "Stopped", "건너뜀": "Skipped",
    // Delta
    "주의 묶어서 확인": "Review warnings together", "지도에서 보기": "View on map", "추세 보기": "View trend",
    "위험 알림 열기": "Open critical alert", "알림 열기": "Open alert", "보내기": "Send", "닫기": "Close",
    "더보기": "More", "묻기": "Ask", "이어서": "Follow-up", "목록": "List", "다음": "Next", "측정값": "Reading",
    "이 설비": "This equipment", "낮음": "low", "보통": "medium", "발견": "found",
    // 상태 · 일반
    "위험 알림 있음": "Critical alert", "주의 알림 있음": "Warning alert",
    "위험 알림": "critical alert", "주의 알림": "warning alert", "새 위험": "New critical",
    "수행중": "Running", "수행 중": "Running", "완료": "Done", "대기": "Idle", "끊김": "Lost",
    "위험": "Critical", "주의": "Warning", "정상": "Normal", "기타": "Other", "새로": "New",
    "전체": "All", "수행": "Active", "미션": "Mission", "로봇": "Robot", "층": "Floor",
    "위치": "Location", "감지": "Detection", "설비": "Equipment", "상태": "Status",
    "선택": "Select", "취소": "Cancel", "지점": "Points", "순회": "Patrol", "판독": "Reading"
  };
  var WORD_KEYS = Object.keys(WORDS).sort(function (a, b) { return b.length - a.length; });
  var WORD_RE = new RegExp(WORD_KEYS.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g");

  function words(s) {
    s = s.replace(WORD_RE, function (m) { return WORDS[m]; });
    // 숫자 + 한국어 단위 꼬리
    s = s.replace(/(\d+)\s?건/g, "$1").replace(/(\d+)\s?분/g, "$1 min").replace(/(\d+)\s?초/g, "$1 s")
         .replace(/(\d+)\s?명/g, "$1").replace(/(\d+)\s?대/g, "$1").replace(/(\d+)\s?개/g, "$1").replace(/(\d+)\s?곳/g, "$1")
         .replace(/(\d+)\s?회/g, "$1×").replace(/약\s?(?=\d)/g, "~");
    return s;
  }

  var cache = Object.create(null);
  function tr(raw) {
    if (!raw || !KO.test(raw)) { return raw; }
    if (raw in cache) { return cache[raw]; }
    if (/\n/.test(raw.trim())) { return (cache[raw] = raw.split("\n").map(tr).join("\n")); }   // Delta 요약처럼 줄바꿈으로 이은 글은 줄마다
    var lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0], s = raw.trim(), out = null;
    if (Object.prototype.hasOwnProperty.call(EXACT, s)) { out = EXACT[s]; }
    if (out === null) {
      var w = words(s);
      for (var i = 0; i < RULES.length && out === null; i++) {
        var g = RULES[i][0].exec(s);
        if (g) { out = words(RULES[i][1].replace(/\$(\d)/g, function (_, k) { return g[k] ? tr(g[k]) : ""; })); }
        else if (RULES[i][0].test(w)) { out = w.replace(RULES[i][0], RULES[i][1]); }
      }
      if (out === null) { out = w; }
    }
    out = lead + out + tail;
    cache[raw] = out;
    return out;
  }
  window.__tr = tr;

  // Delta 답은 한 글자씩 친다(delta-chat.js Array.from(r.lead) → textContent += ch). 쪼개기 전에 영어로 바꿔 영어가 쳐지게.
  var arrayFrom = Array.from;
  Array.from = function (src) {
    if (typeof src === "string" && KO.test(src)) { arguments[0] = tr(src); }
    return arrayFrom.apply(Array, arguments);
  };

  // Delta 에 영어로 물으면 — 답을 고르는 delta-chat.js 는 한국어 낱말을 본다. 보내기 직전 한국어 열쇠말로 바꾸고, 말풍선엔 친 영어를 그대로.
  var ASK = [
    [/\b(hello|hi|hey)\b/i, "안녕"], [/\b(why|reason|cause)/i, "왜"], [/\b(how|fix|solve)/i, "어떻게"],
    [/trend/i, "추세"], [/history/i, "이력"], [/\b(where|location)\b/i, "어디"],
    [/\b(order|first|guide|to ?do)\b/i, "순서"], [/\b(report|send|mail)/i, "보고서"],
    [/\bwarn/i, "주의"], [/\b(critical|danger|ng)\b/i, "위험"], [/\b(robot|battery)/i, "로봇"],
    [/n2|n₂/i, "N₂ 압력계"], [/hepa/i, "HEPA 차압계"], [/pump/i, "냉각 펌프"], [/valve/i, "냉각수 밸브"],
    [/switchgear|mcc/i, "수배전반"], [/platform|harness|belt/i, "작업 발판"]
  ];
  function askKo(input) {
    var q = input.value.trim();
    if (!q || KO.test(q)) { return; }
    var ko = ASK.filter(function (r) { return r[0].test(q); }).map(function (r) { return r[1]; }).join(" ");
    if (!ko) { return; }
    EXACT[ko] = q; delete cache[ko];
    input.value = ko;
  }
  function deltaInput(t) { return t && t.closest && t.closest("[data-delta3]") && /^(INPUT|TEXTAREA)$/.test(t.nodeName) ? t : null; }
  document.addEventListener("keydown", function (e) {
    var i = e.key === "Enter" && !e.isComposing && deltaInput(e.target);
    if (i) { askKo(i); }
  }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-delta3] button");
    var box = b && b.closest("[data-delta3]");
    var i = box && box.querySelector("input[type=text], textarea");
    if (i && i.value) { askKo(i); }
  }, true);

  var ATTRS = ["title", "placeholder", "aria-label", "data-tip", "alt"];
  function doText(n) {
    var p = n.parentNode;
    if (!p || p.nodeName === "SCRIPT" || p.nodeName === "STYLE") { return; }
    var v = n.nodeValue;
    if (v && KO.test(v)) { var t = tr(v); if (t !== v) { n.nodeValue = t; } }
  }
  function doEl(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v && KO.test(v)) { var t = tr(v); if (t !== v) { el.setAttribute(ATTRS[i], t); } }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) { return; }
    if (root.nodeType === 1) {
      if (root.nodeName === "SCRIPT" || root.nodeName === "STYLE") { return; }
      doEl(root);
    }
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) { doText(n); } else { doEl(n); } }
  }

  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "characterData") { doText(m.target); }
      else if (m.type === "attributes") { doEl(m.target); }
      else { for (var j = 0; j < m.addedNodes.length; j++) { walk(m.addedNodes[j]); } }
    }
    if (KO.test(document.title)) { document.title = tr(document.title); }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  document.documentElement.setAttribute("lang", "en");
  document.addEventListener("DOMContentLoaded", function () { walk(document.documentElement); document.title = tr(document.title); });
})();
