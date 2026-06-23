# Stardew Helper - 유지보수 가이드 (Maintenance Guide)

이 문서는 추후 오버레이 프로그램(Tauri 앱)을 업데이트하거나 로직을 수정할 때 참고해야 할 **전체적인 아키텍처 및 하드코딩된 데이터의 관리 지침**입니다.

---

## 1. 데이터 파싱 로직 (Rust 백엔드)
**파일 위치:** `src-tauri/src/save_parser.rs`

### 1.1. 세이브 파일(XML) 구조의 함정 주의
- 스타듀밸리 세이브 파일에서 `<mailReceived>`, `<achievements>`, `<stats>` 데이터는 **반드시 `<player>` 태그 안쪽**에 존재합니다.
- 반면, 마을 회관 데이터인 **`<bundles>` 태그는 `<player>` 바깥쪽(최상단)**에 존재합니다.
- 따라서 파서(Parser)의 `if/else` 조건문을 짤 때, `<player>` 내부 전용 조건과 외부 전용 조건을 엄격히 분리하지 않으면 특정 데이터가 통째로 스킵되는 치명적인 버그가 발생합니다. (과거 조자마트 및 업적 누락 버그의 원인)

### 1.2. 신규 추적 데이터 추가 방법
스타듀밸리 업데이트로 새로운 스탯이 필요해질 경우 다음 3단계를 거칩니다.
1. `SaveData` 구조체에 변수(예: `pub new_stat: i32`) 추가.
2. `parse_save_file` 함수 내부에 상태 추적용 `boolean` 변수(예: `let mut in_new_stat = false;`) 추가.
3. XML `Event::Start`, `Event::End`, `Event::Text` 루프에 각각 파싱 로직 추가.

---

## 2. 프론트엔드 데이터 관리 (JS)

### 2.1. 도전과제 (Achievements)
**데이터 파일:** `src/achievements_data.js`
**검증 로직:** `src/main.js`

- **공식 업적 (0~44번):**
  - 세이브 파일의 `currentSaveData.achievements` 배열에 게임이 자동으로 공식 번호를 넣어줍니다. `achievements_data.js`에 **공식 ID와 똑같이 매핑**해두면 JS가 알아서 클리어 처리합니다.
  - (1.5버전의 '깊은 곳의 위험(41)', '무한한 힘(42)', '완벽(44)' 등도 공식 ID를 사용합니다.)
- **커스텀/숨겨진 업적 (100번대 이상):**
  - 게임 엔진이 숫자로 저장하지 않거나 Steam 전용으로 넘기는 업적들입니다. (예: 광산 120층, 스킬 만렙, 별방울 모두 획득 등)
  - 이 업적들은 `main.js` 내부의 반복문(`list = list.map(ach => ... )`)에서 스탯(예: `has_skull_key`, `max_stamina >= 508`)을 기반으로 **수동 `true` 처리(하드코딩)** 되어 있습니다. 향후 수치가 변경되면 `main.js`를 수정해야 합니다.

### 2.2. 모험가의 길드 토벌 목표 (Protector Of The Valley)
**검증 로직:** `src/main.js`의 `checkMonsterEradicationGoals()` 함수

- 107번 업적(Protector Of The Valley)은 세이브 파일의 `<specificMonstersKilled>` 딕셔너리를 Rust가 읽어온 뒤, JS에서 12가지 카테고리로 묶어서 직접 계산합니다.
- **유지보수 포인트:** 스타듀밸리 1.7 등에서 새로운 토벌 목표가 추가되거나 마릿수가 조정된다면, 반드시 `main.js`의 `checkMonsterEradicationGoals` 함수 내 임계값(Threshold)을 수정해야 합니다. (예: 슬라임 1000마리 등)

### 2.3. 마을 회관 꾸러미 (Community Center)
**데이터 파일:** `src/bundles_data.js`
**검증 로직:** `src/main.js`

- 게임 세이브 파일은 꾸러미 진행도를 `[참, 거짓, 참, ...]` 형태의 불리언(Boolean) 배열로만 저장합니다. (어떤 아이템인지 명시하지 않음)
- 따라서 `bundles_data.js`에 각 방(Room)별 인덱스 순서와 요구 아이템 정보가 하드코딩되어 있습니다. 업데이트로 번들 품목이나 순서가 바뀔 경우 이 파일을 1순위로 점검해야 합니다.

### 2.4. 조자마트 지역 개발 (Joja Development)
**검증 로직:** `src/main.js`

- 조자마트 개발 완료 여부는 `mailReceived` 내부의 특정 문자열 플래그로 판단합니다.
- **추적 문자열:** `jojaBoilerRoom`, `jojaFishTank`, `jojaCraftsRoom`, `jojaPantry`, `jojaVault`
- 오타나 대소문자가 틀리면 인식하지 못하므로, 플래그를 수정할 때 각별한 주의가 필요합니다.

---

## 3. 향후 아키텍처 전환 권장 사항 (SMAPI 연동)
현재의 로컬 XML 파일 폴링(Polling) 방식은 "잠을 자야만(다음 날이 되어야만) 화면이 갱신된다"는 치명적인 한계와, 멀티플레이 시 게스트 컴퓨터에서 작동하지 않는 제약이 있습니다.

- **차세대 아키텍처:** Tauri 앱 내부에 웹소켓(WebSocket) 서버를 띄우고, 스타듀밸리 인게임에 **C# 기반 SMAPI 모드**를 설치하여 메모리 직독(Direct Read) 방식으로 전환할 것을 강력히 권장합니다.
- 이로 전환 시 본 유지보수 가이드의 "Rust 세이브 파일 파싱" 부담이 완전히 사라지고, 실시간(초 단위) 연동과 완벽한 멀티플레이 게스트 지원이 가능해집니다.
