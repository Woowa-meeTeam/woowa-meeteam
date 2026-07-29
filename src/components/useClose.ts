import { useNavigate } from 'react-router-dom';

/**
 * 닫기(X) 가 돌아갈 곳을 정합니다.
 *
 * 목적지를 새로 쌓으면 히스토리가 상세·수정으로 번갈아 늘어나서
 * 닫아도 제자리를 맴돕니다. 그래서 앱 안에서 열었으면 왔던 화면으로 되돌아가고,
 * 링크로 바로 들어와 돌아갈 곳이 없을 때만 fallback 으로 보냅니다.
 */
export default function useClose(fallback: string) {
  const navigate = useNavigate();
  return () => {
    // 라우터가 히스토리 항목마다 매겨 두는 순번입니다. 0 이면 이 세션의 첫 화면이라
    // 되돌아가면 사이트 밖으로 나가 버려요. location.key 는 replace 로 들어와도
    // 새로 발급돼서, 딥링크로 연 화면을 앱 안에서 온 것처럼 오해합니다.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
