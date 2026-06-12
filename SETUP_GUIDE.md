# KGU System 셋업 가이드 (대표님용)

> 순서대로 따라하면 됩니다. 소요시간 약 15분. 전부 무료입니다.

---

## STEP 1. Firebase 프로젝트 생성

1. https://console.firebase.google.com 접속 → Google 계정 로그인
2. **프로젝트 추가** 클릭
3. 프로젝트 이름: `kgusystem` (아무거나 OK) → 계속
4. Google 애널리틱스: **사용 안 함** 선택 → 프로젝트 만들기

## STEP 2. 웹 앱 등록 + 설정값 복사

1. 프로젝트 메인 화면에서 **`</>` (웹)** 아이콘 클릭
2. 앱 닉네임: `kgu-web` → 앱 등록 (Firebase 호스팅 체크 안 함)
3. 화면에 나오는 `firebaseConfig = { ... }` 블록을 복사
4. 프로젝트 폴더의 **`src/firebase.js`** 파일을 열고, `REPLACE_ME`로 된
   `firebaseConfig` 부분을 복사한 값으로 교체 → 저장
   - 이 값들은 공개돼도 안전한 식별자라 GitHub에 올려도 됩니다.

## STEP 3. Authentication 켜기

1. 왼쪽 메뉴 **빌드 > Authentication** → 시작하기
2. **이메일/비밀번호** 선택 → **사용 설정** ON → 저장
   - (이메일 링크는 OFF 그대로)

## STEP 4. Firestore 만들기 (⚠️ Realtime Database 아님!)

1. 왼쪽 메뉴 **빌드 > Firestore Database** → 데이터베이스 만들기
2. 위치: `asia-northeast3 (서울)` 선택
3. **프로덕션 모드**로 시작 → 만들기

## STEP 5. 보안 규칙 붙여넣기

1. Firestore 화면 상단 **규칙** 탭 클릭
2. 기존 내용 전부 지우고, 프로젝트 폴더의 **`firestore.rules`** 파일
   내용을 전체 복사해서 붙여넣기 → **게시**

## STEP 6. GitHub 레포 만들기 + 업로드

1. https://github.com/new → 레포 이름 **`kgusystem`** (정확히 이 이름) → Public → 생성
2. 프로젝트 폴더에서:
   ```bash
   git init
   git add .
   git commit -m "feat: initial KGU system"
   git branch -M main
   git remote add origin https://github.com/[유저명]/kgusystem.git
   git push -u origin main
   ```

## STEP 7. GitHub Pages 켜기

1. 레포 페이지 → **Settings > Pages**
2. Source: **GitHub Actions** 선택 (Deploy from a branch 아님!)
3. 끝. push할 때마다 자동 빌드+배포됩니다. (Actions 탭에서 진행 확인)
4. 주소: `https://[유저명].github.io/kgusystem/`

## STEP 8. 최초 실행 (중요 — 가장 먼저!)

1. 배포된 사이트에서 `https://[유저명].github.io/kgusystem/#/kga_adminnn` 접속
2. **슈퍼관리자 계정 생성** 화면이 자동으로 뜸 → 닉네임 + PIN 4자리 설정
   (이 화면은 최초 1회만 나타나며, 이후엔 로그인만 가능)
3. 로그인 후 **시스템 탭 > 초기 데이터 설치** 버튼 클릭 (1회)
   - 길드 / 클래스·특성 / 시너지 / 서버 목록이 자동 설치됨
4. 이제 일반 유저들이 메인 주소에서 가입할 수 있습니다.

---

## 운영 메모

- **관리자 지정**: 슈퍼관리자 페이지 > 유저 관리 > 유저 클릭 > 관리자 권한 체크
- **PIN 분실 유저**: 유저 관리 > 해당 유저 > 임시 PIN 입력 > 초기화
  - 초기화하면 Firebase 콘솔 Authentication 목록에 안 쓰는 계정이 하나
    남는데, 연결이 끊긴 껍데기라 무시해도 됩니다. (지우고 싶으면 콘솔에서 수동 삭제)
- **길드 로고**: PNG를 `public/logos/`에 넣고 커밋+push → 배포 후
  길드 관리에서 경로(`logos/파일명.png`) 입력
- **로컬에서 미리보기**: `npm install` 후 `npm run dev`
- **무료 한도**: Firestore 일일 읽기 5만/쓰기 2만 — 길드 연합 규모에선 충분합니다.
