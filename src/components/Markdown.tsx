import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

/**
 * 프로젝트 설명용 마크다운 렌더러.
 * react-markdown 은 기본적으로 raw HTML 을 실행하지 않아 XSS 에 안전합니다.
 *
 * remark-breaks 를 쓰는 이유:
 * 표준 마크다운은 줄 하나만 바꾼 건 무시하고 앞 문장에 이어 붙입니다.
 * 크루들은 그냥 textarea 에 엔터로 줄을 나눠 쓰기 때문에, 쓴 대로 보이도록
 * 소프트 줄바꿈을 <br> 로 살립니다. (목록 안에서 이어 쓴 줄도 마찬가지)
 *
 * 간격·목록 들여쓰기는 `.markdown-body` CSS 에 모아 뒀습니다.
 * 중첩 목록이나 `li > p` 같은 건 자손 선택자가 있어야 깔끔하게 잡혀요.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => <img src={src} alt={alt ?? ''} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
