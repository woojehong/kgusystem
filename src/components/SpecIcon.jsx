import { useState } from 'react';

/**
 * 특성 아이콘 (단일 소스). specId로 /spec/{specId}.png 를 불러오고,
 * 파일이 없거나 로드 실패 시 아이콘은 숨기고 2글자 이름만 폴백으로 보여준다.
 * 아이콘이 준비되기 전에도 화면이 깨지지 않는다.
 *
 * props:
 *  - specId  : 특성 id (없으면 이름만)
 *  - name    : 특성명 (2글자) — showName일 때 표시 / 폴백 표시
 *  - size    : 아이콘 px (기본 16)
 *  - showName: 아이콘 옆에 이름도 표시할지
 *  - color   : 이름 색 (보통 클래스 컬러)
 */
// 원본 이미지의 가운데 몇 %만 사용할지 (테두리 링을 잘라내기 위함).
// 0.8 = 가운데 80%만 보이도록 1/0.8 = 1.25배 확대 후 clip.
const VISIBLE = 0.8;
const ZOOM = 1 / VISIBLE;

export default function SpecIcon({ specId, name, size = 16, showName = false, color, className = '' }) {
  const [broken, setBroken] = useState(false);
  const hasIcon = !!specId && !broken;

  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      {hasIcon && (
        <span
          className="inline-block overflow-hidden rounded-full shrink-0 align-middle bg-transparent"
          style={{ width: size, height: size }}
        >
          <img
            src={`${import.meta.env.BASE_URL}spec/${specId}.png`}
            alt