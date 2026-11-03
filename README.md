# 강호초행 · Jianghu RPG

선택으로 성장하는 무협 RPG 웹앱입니다. 원본 `jianghu-fate.html`의 게임 흐름과 미술 자산을 유지하면서 Vite 기반 ES 모듈 프로젝트로 분리했습니다.

현재 플레이 범위는 **운명 생성 → 인물 생성 → 시작 기연 → 첫 7일(14회 행동)**입니다. 전투, 문파 가입, 2주차 이후 콘텐츠는 아직 구현하지 않았습니다.

## 로컬 실행

Node.js 22.12 이상(또는 24 LTS)을 사용합니다.

```bash
npm ci
npm run dev
```

터미널에 표시되는 주소를 브라우저에서 엽니다. ES 모듈을 사용하므로 `index.html`을 파일로 직접 열지 않고 개발 서버를 이용하세요.

```bash
npm test          # 추첨 규칙, 사건 데이터, 저장 검증
npm run build     # dist/ 생성
npm run preview   # 실제 배포 산출물 확인
```

브라우저 검사:

```bash
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

이미 설치된 Chromium을 쓰려면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`에 실행 파일 경로를 지정합니다. CI에서는 Playwright가 관리하는 Chromium을 사용합니다.

## 프로젝트 구조

```text
index.html                화면의 HTML 구조
src/app.js                화면 전환, 사용자 입력, 턴 진행, 수련, 이벤트 처리
src/game/data.js          출신·재능·기연·무공·돌발 사건 데이터
src/game/rules.js         난수, 능력치 추첨, 등급과 숙련 단계 규칙
src/game/storage.js       기존 저장 키를 유지하는 localStorage 입출력
src/styles/main.css       반응형 화면과 소환·각성 연출
src/assets/portraits.png  원본 초상화 이미지
tests/                   규칙 검사와 모바일·데스크톱 브라우저 검사
```

세부 구조와 후속 개발 항목은 [개발 문서](docs/DEVELOPMENT.md)를 참고하세요.

## 저장 방식

서버·계정·데이터베이스 없이 브라우저 `localStorage`에 자동 저장합니다. 원본의 `jianghu-fate-v1` 키와 저장 형식을 유지합니다. **같은 브라우저의 같은 출처(origin)**에서만 기존 저장을 읽을 수 있습니다. 로컬 HTML, localhost, 배포 도메인 간에는 저장이 자동 이전되지 않습니다. 브라우저 데이터를 삭제하면 진행도 삭제됩니다.

## 배포

정적 웹앱이므로 `npm run build` 결과인 `dist/`를 배포하면 됩니다. 별도 API 키나 환경 변수는 필요하지 않습니다. Google Fonts는 외부에서 불러오며, 연결되지 않으면 기본 글꼴을 사용합니다.

### Vercel

Vercel에서 이 GitHub 저장소를 Import한 뒤 아래 설정으로 배포합니다.

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages

1. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 설정합니다.
2. **Actions → Deploy to GitHub Pages → Run workflow**를 실행합니다.
3. 완료된 작업의 배포 URL을 확인합니다.

Pages 배포는 수동 실행으로 구성되어 있습니다. 일반 push/PR에서는 `Verify game`이 빌드와 게임 검사를 수행합니다. `base: './'` 설정으로 `/jianghurpg/` 같은 하위 경로에서도 자산을 불러올 수 있습니다.

## 현재 제한

- 첫 7일 이후 플레이와 전투는 미구현입니다.
- 일부 재능·약점은 설명만 있으며 실제 성장 보정에 연결되지 않았습니다.
- 성향은 기록·호칭에 반영되며 문파나 전투 규칙에는 아직 연결되지 않습니다.
- 저장 내보내기·불러오기, 새 게임 UI와 저장 데이터 전체 검증은 후속 작업입니다.

원본의 콘텐츠와 이미지 권리는 원저작자의 조건을 따릅니다. 이 저장소를 정리하면서 별도의 오픈소스 라이선스를 부여하지 않았습니다.
