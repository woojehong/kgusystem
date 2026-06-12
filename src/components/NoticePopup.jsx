import { useApp } from '../context/AppContext';
import { clearUserNotice } from '../lib/db';
import Modal from './Modal';

export default function NoticePopup() {
  const { userId, profile } = useApp();
  const notice = profile?.notice;
  if (!notice) return null;

  const close = () => {
    clearUserNotice(userId).catch(() => {});
  };

  return (
    <Modal open onClose={close} maxWidth="max-w-sm">
      <div className="text-center py-2">
        <div className="text-4xl mb-3">{notice.type === 'promoted' ? '🎉' : '📋'}</div>
        <p className="font-semibold leading-relaxed whitespace-pre-line">
          {notice.type === 'promoted'
            ? `[${notice.raidTitle}]\n대기에서 참가 확정으로 승격되었습니다!`
            : `[${notice.raidTitle}]\n참가 확정에서 대기 목록으로 이동되었습니다.`}
        </p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={close}>
          확인
        </button>
      </div>
    </Modal>
  );
}
