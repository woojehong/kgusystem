# -*- coding: utf-8 -*-
"""한길련 사용 가이드 4종(PDF) 생성 — 일반/운영진 × 웹/디스코드."""
import os
from weasyprint import HTML

OUT = os.path.dirname(os.path.abspath(__file__))

BASE_CSS = """
@page { size: A4; margin: 16mm 15mm 14mm 15mm;
  @bottom-center { content: "한길련 · " counter(page) " / " counter(pages);
    font-family:'Noto Sans CJK KR'; font-size:8pt; color:#94a3b8; } }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif; color:#1e2530; font-size:10.3pt; line-height:1.5; }
.cover { background:VAR_GRAD; color:#fff; border-radius:14px; padding:20px 22px; margin-bottom:16px; }
.cover .ksub { font-size:9pt; letter-spacing:.25em; opacity:.85; font-weight:700; }
.cover h1 { font-size:21pt; font-weight:800; margin:5px 0 3px; letter-spacing:-.01em; }
.cover .tag { display:inline-block; margin-top:8px; background:rgba(255,255,255,.18);
  border:1px solid rgba(255,255,255,.35); padding:4px 12px; border-radius:999px; font-size:9pt; font-weight:700; }
.cover .lead { margin-top:10px; font-size:9.6pt; opacity:.95; line-height:1.45; }
.sec { margin-bottom:13px; break-inside:avoid; }
.sec .sh { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.sec .sh .ico { width:16px; height:16px; border-radius:5px; background:VAR_MAIN; flex:0 0 16px; }
.sec .sh h2 { font-size:12pt; font-weight:800; color:#16202e; }
.steps { list-style:none; }
.steps li { display:flex; gap:9px; padding:5px 0; border-bottom:1px solid #eef1f5; }
.steps li:last-child { border-bottom:none; }
.steps .n { flex:0 0 19px; height:19px; margin-top:1px; border-radius:50%; background:VAR_MAIN; color:#fff;
  font-size:8.4pt; font-weight:800; display:flex; align-items:center; justify-content:center; }
.steps .x { flex:0 0 19px; height:19px; margin-top:1px; border-radius:50%; background:#e2e8f0; color:#475569;
  font-size:10pt; font-weight:800; display:flex; align-items:center; justify-content:center; }
.steps .tx { flex:1; font-size:10pt; }
.steps .tx b { color:#0f1722; }
.steps .tx .m { color:#64748b; font-size:9pt; }
.chips { display:flex; gap:6px; flex-wrap:wrap; margin:2px 0 2px; }
.chip { padding:2px 10px; border-radius:999px; font-size:8.8pt; font-weight:700; color:#0f1722; }
.cmd { font-family:'Noto Sans CJK KR',monospace; background:#eef2f7; border:1px solid #dbe3ec;
  border-radius:5px; padding:1px 6px; font-weight:700; color:#1e293b; font-size:9.2pt; }
.foot { margin-top:14px; text-align:center; font-size:8.4pt; color:#94a3b8; }
"""

def render(items):
    out = []
    for it in items:
        if it[0] == "step":
            out.append(f'<li><span class="n">{it[1]}</span><span class="tx">{it[2]}</span></li>')
        elif it[0] == "bul":
            out.append(f'<li><span class="x">·</span><span class="tx">{it[1]}</span></li>')
    return "".join(out)

def section(title, items):
    return (f'<div class="sec"><div class="sh"><span class="ico"></span><h2>{title}</h2></div>'
            f'<ul class="steps">{render(items)}</ul></div>')

def build(fname, theme, ksub, h1, tag, lead, body_html):
    css = (BASE_CSS.replace("VAR_GRAD", theme["grad"]).replace("VAR_MAIN", theme["main"]))
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="cover"><div class="ksub">{ksub}</div><h1>{h1}</h1><span class="tag">{tag}</span>
<div class="lead">{lead}</div></div>
{body_html}
<div class="foot">한길련(KWGU) 레이드 관리 시스템 · 본 가이드는 실제 화면 기준으로 작성되었습니다</div>
</body></html>"""
    HTML(string=html).write_pdf(os.path.join(OUT, fname))
    print("written", fname)

WEB = {"grad":"linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)","main":"#5b50e6"}
DIS = {"grad":"linear-gradient(135deg,#5865F2 0%,#404eed 100%)","main":"#5865F2"}

DIFF_CHIPS = ('<div class="chips">'
  '<span class="chip" style="background:#fde9a9">신화 (금색)</span>'
  '<span class="chip" style="background:#cfe0fd">영웅 (파랑)</span>'
  '<span class="chip" style="background:#e4e8ee">일반 (회색)</span></div>')

# ① 일반 길드원 · 웹
b = ""
b += section("처음 시작 (로그인 · 가입)", [
  ("step","1",'사이트 접속 → <b>닉네임</b> 입력 <span class="m">(한글 2~7자 또는 영문 2~11자)</span>'),
  ("step","2",'처음이면 가입: <b>PIN 4자리</b> 설정 → <b>소속 길드</b> 선택 → <b>대표 캐릭터</b> 등록(서버·클래스·특성·아이템레벨)'),
  ("step","3",'다음부터는 <b>닉네임 + PIN</b> 으로 로그인'),
  ("bul",'<span class="m">※ 닉네임은 꼭 기억하세요. 분실 시 찾을 방법이 없습니다.</span>'),
])
b += section("레이드 보기", [
  ("bul",'메인 화면이 <b>길드 레이드 일정</b> — 오른쪽 위에서 <b>달력뷰 / 카드뷰</b> 전환'),
  ("bul",'<b>구분</b> 필터: 전체 · 연합 · 우리 길드'),
  ("bul",'<b>난이도</b> 필터 — 색으로 구분:' + DIFF_CHIPS),
  ("bul",'카드의 <b>탱 / 힐 / 딜</b> 숫자가 실시간 모집 현황입니다'),
])
b += section("신청하기", [
  ("step","1",'신청할 <b>레이드 카드</b>를 눌러 상세로 이동'),
  ("step","2",'<b>[신청]</b> → 참여 캐릭터 선택 → <b>이번 참여 특성</b> 선택 → 아이템레벨 확인'),
  ("step","3",'필요하면 <b>벤치(예비)</b>로 신청 — 결원 시 와줄 인원, 캐릭터 여러 개 선택 가능'),
  ("step","4",'신청 완료! 카드에 <b>“신청함 / 대기중”</b> 표시가 붙습니다'),
  ("bul",'<span class="m">우리 길드 레이드도 똑같은 방법으로 신청합니다.</span>'),
])
b += section("신청 변경 · 내 정보", [
  ("bul",'신청 <b>변경·취소</b>는 레이드 상세에서'),
  ("bul",'<b>프로필</b>: 캐릭터 추가/수정, <b>대표 캐릭터</b> 지정, PIN 변경'),
  ("bul",'<b>디스코드 연동</b>: 프로필에서 <b>연동 코드</b>(6자리)를 받은 뒤, 디스코드에서 <span class="cmd">/연동</span> 입력 → 뜨는 칸에 그 코드 입력'),
])
build("01_웹_일반길드원.pdf", WEB, "한.길.련 · 웹 가이드", "웹사이트 사용법", "일반 길드원용",
  "사이트에서 레이드를 보고 신청하는 모든 것 — 클릭 몇 번이면 끝납니다.", b)

# ② 운영진 · 웹
b = ""
b += section("레이드 만들기", [
  ("step","1",'카드뷰의 <b>+ 일정 추가</b> 또는 달력에서 날짜의 <b>+</b> 클릭'),
  ("step","2",'<b>구분</b> 선택 — 연합 또는 우리 길드'),
  ("step","3",'<b>난이도</b> 선택:' + DIFF_CHIPS),
  ("step","4",'<b>총원</b> 조정(10~31명), <b>힐러 수</b> 조정 → <b>딜러 수 자동 계산</b>'),
  ("step","5",'시간 · 공대장 · 제목 입력 후 저장'),
  ("bul",'<span class="m">연합 레이드의 “소속 없음 신청 허용”은 기본 꺼짐 — 필요할 때만 켜세요.</span>'),
])
b += section("명단 관리", [
  ("bul",'레이드 상세에서 신청자 <b>상태 변경</b>(참여/대기) 및 <b>벤치 이동</b>'),
  ("bul",'탱/힐/딜 정원과 시너지·스왑 현황을 한눈에 확인'),
])
b += section("길드 정보 관리 (길드장)", [
  ("bul",'프로필 → <b>길드 정보</b>에서 자기 길드의 <b>뱃지·소개글</b>을 직접 편집'),
  ("bul",'로고·깃발 이미지는 규격에 맞춰 만들어 관리자에게 전달하면 등록됩니다'),
])
build("02_웹_운영진.pdf", WEB, "한.길.련 · 웹 가이드", "웹사이트 운영", "운영진용",
  "레이드를 만들고 명단을 관리하는 운영진 전용 가이드입니다.", b)

# ③ 일반 길드원 · 디스코드
b = ""
b += section("시작 — 계정 연동 (딱 한 번)", [
  ("step","1",'<b>먼저 웹에서 코드를 받습니다.</b> 웹 프로필 → <b>연동 코드 생성</b> <span class="m">(6자리 숫자, 10분 유효)</span>'),
  ("step","2",'디스코드에서 <span class="cmd">/연동</span> 을 입력하면 <b>코드 칸</b>이 나타납니다'),
  ("step","3",'그 칸에 <b>웹에서 받은 6자리 코드</b>를 넣고 전송 → 연결 완료'),
  ("bul",'<span class="m">한 번만 연동하면 이후 모든 신청을 디스코드에서 할 수 있어요.</span>'),
])
b += section("레이드 보기", [
  ("bul",'<b>길드 레이드가 올라오는 채널을 확인하세요.</b> 라이브 카드가 자동으로 올라옵니다 <span class="m">(가까운 일정이 맨 아래)</span>'),
  ("bul",'카드에 <b>클래스 아이콘</b> · 탱힐딜 현황 · <b>시작 시간(내 시간대 자동 변환 + “○시간 후”)</b> 표시'),
])
b += section("신청 · 변경", [
  ("step","1",'카드의 <b>[신청]</b> 버튼 클릭'),
  ("step","2",'캐릭터 선택 → <b>역할 / 벤치 / 스왑</b> 선택'),
  ("bul",'또는 <span class="cmd">/신청</span> 으로 클릭 신청'),
  ("bul",'<span class="cmd">/내신청</span> 으로 변경·취소'),
  ("bul",'<span class="m">우리 길드 레이드는 해당 길드 채널에서 같은 방식으로.</span>'),
])
b += section("내 캐릭터 관리", [
  ("bul",'<span class="cmd">/내정보</span> → 캐릭터 선택 → <b>아이템레벨 수정</b> · <b>특성 변경</b>'),
  ("bul",'<span class="cmd">/핑</span> 봇이 살아있는지 확인'),
])
build("03_디스코드_일반길드원.pdf", DIS, "길레봇 · 디스코드 가이드", "디스코드 봇 사용법", "일반 길드원용",
  "디스코드 안에서 레이드 신청까지 전부 됩니다. 명령어 몇 개면 충분해요.", b)

# ④ 운영진 · 디스코드
b = ""
b += section("자동으로 되는 것들", [
  ("bul",'웹에서 <b>연합/길드 레이드</b>를 만들면 → 해당 <b>채널에 카드 자동 게시</b>'),
  ("bul",'신청 변동 시 <b>카드 실시간 갱신</b> (탱힐딜·명단)'),
  ("bul",'<b>시간순 자동 정렬</b> — 가까운 일정이 맨 아래'),
  ("bul",'레이드를 <b>완전 삭제</b>하면 디스코드 카드도 자동 제거'),
])
b += section("채널 구성 (필터링)", [
  ("bul",'<b>연합 채널 = 연합 레이드만</b>'),
  ("bul",'<b>길드 채널(예: 스타폴) = 그 길드 레이드만</b>'),
  ("bul",'서버가 달라도 동일하게 작동 — 봇이 양쪽 서버에 들어가 있으면 됩니다'),
  ("bul",'<span class="m">클래스 이모지는 봇이 속한 한 서버에 한 번만 올리면 모든 서버 카드에 표시됩니다.</span>'),
])
b += section("멤버 안내 · 운영 팁", [
  ("bul",'멤버는 <span class="cmd">/연동</span> 한 번이면 모든 신청을 디스코드에서 처리 가능'),
  ("bul",'주요 명령어: <span class="cmd">/일정</span> <span class="cmd">/신청</span> <span class="cmd">/내신청</span> <span class="cmd">/내정보</span> <span class="cmd">/연동</span> <span class="cmd">/핑</span>'),
  ("bul",'명령어를 추가/변경해 배포한 경우 <b>명령어 재등록 1회</b> 필요'),
  ("bul",'<span class="m">레이드 생성·명단 관리는 웹에서 — 디스코드는 자동으로 따라옵니다.</span>'),
])
build("04_디스코드_운영진.pdf", DIS, "길레봇 · 디스코드 가이드", "디스코드 봇 운영", "운영진용",
  "디스코드 카드·채널이 어떻게 자동으로 돌아가는지 정리한 운영진 가이드입니다.", b)

print("ALL DONE")
