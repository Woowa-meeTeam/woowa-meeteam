import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 프로젝트 설명용 마크다운 렌더러.
 * react-markdown 은 기본적으로 raw HTML 을 실행하지 않아 XSS 에 안전합니다.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] text-white/70 leading-[1.75] space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h2 className="text-xl font-semibold text-white mt-8 mb-3" {...p} />,
          h2: (p) => <h3 className="text-lg font-semibold text-white mt-7 mb-2.5" {...p} />,
          h3: (p) => <h4 className="text-base font-semibold text-white mt-6 mb-2" {...p} />,
          p: (p) => <p className="text-white/70" {...p} />,
          strong: (p) => <strong className="font-semibold text-white" {...p} />,
          em: (p) => <em className="italic text-white/80" {...p} />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7db4ff] underline underline-offset-2 hover:text-[#A4F4FD] transition-colors"
            >
              {children}
            </a>
          ),
          ul: (p) => <ul className="list-disc pl-5 space-y-1.5 marker:text-white/50" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 space-y-1.5 marker:text-white/50" {...p} />,
          li: (p) => <li className="text-white/70 pl-1" {...p} />,
          blockquote: (p) => (
            <blockquote
              className="border-l-2 border-[#3182F6]/50 pl-4 text-white/55 italic"
              {...p}
            />
          ),
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className ?? '');
            if (isBlock) {
              return (
                <code
                  className="block text-[13px] font-mono text-[#A4F4FD] leading-relaxed"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-[13px] font-mono text-[#A4F4FD]"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (p) => (
            <pre
              className="rounded-xl bg-black/40 border border-white/10 p-4 overflow-x-auto"
              {...p}
            />
          ),
          hr: () => <hr className="border-white/10 my-6" />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" {...p} />
            </div>
          ),
          th: (p) => (
            <th
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left font-semibold text-white"
              {...p}
            />
          ),
          td: (p) => <td className="border border-white/10 px-3 py-2 text-white/70" {...p} />,
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ''} className="rounded-xl max-w-full border border-white/10" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
