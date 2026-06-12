# KGU System — Korean Guild Union (한길련)

World of Warcraft 길드 연합 레이드 신청/관리 플랫폼.

- **Stack**: React (Vite) · Tailwind CSS · Firebase Auth · Firestore
- **Deploy**: GitHub Pages (GitHub Actions 자동 배포)
- **Docs**: [SETUP_GUIDE.md](./SETUP_GUIDE.md) — 최초 설치 가이드

## Scripts

```bash
npm install     # 의존성 설치
npm run dev     # 로컬 개발 서버
npm run build   # 프로덕션 빌드 (dist/)
```

## Structure

```
src/
  firebase.js          # Firebase 초기화 (config 교체 필요)
  lib/                 # 상수·유틸·인증·DB 헬퍼
  context/             # 전역 상태 (세션, 게임데이터, 길드)
  components/          # UI 컴포넌트
  pages/               # 로그인 / 메인 / 레이드 상세 / 시스템 관리
firestore.rules        # Firestore 보안 규칙 (콘솔에 붙여넣기)
```
