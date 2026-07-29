import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: '아이디어는 여러 개 제출할 수 있나요?',
    answer:
      '몇 번이든 제출할 수 있지만, 한 번에 등록해 둘 수 있는 아이디어는 하나예요. 이미 등록한 프로젝트가 있으면 새로 등록할 수 없고, 기존 프로젝트를 삭제한 뒤에 다시 등록할 수 있어요. 팀을 모으지 못했다면 폐기하고 새 아이디어로 다시 승인받으면 됩니다.',
  },
  {
    question: '여러 프로젝트의 팀원으로 확정될 수 있나요?',
    answer:
      '한 크루는 하나의 확정 팀에만 참여할 수 있어요. 팀이 확정되면 다른 프로젝트에 보낸 지원은 자동으로 정리됩니다.',
  },
  {
    question: '같은 프로젝트에 다시 지원할 수 있나요?',
    answer:
      '팀 확정 전이라면 지원을 취소하고 다시 지원할 수 있어요. 분야와 스킬을 포함한 현재 프로필이 프로젝트 오너에게 전달됩니다.',
  },
  {
    question: '동시에 몇 개의 프로젝트에 지원할 수 있나요?',
    answer:
      '한 번에 최대 3개의 프로젝트에 지원할 수 있어요. 지원을 취소하거나 거절된 지원은 개수에 포함되지 않아서 다른 프로젝트에 다시 지원할 수 있습니다.',
  },
];

export default function Faq() {
  return (
    <main className="faq-page relative z-20">
      <header className="faq-page__header">
        <h1 className="page-title">팀을 찾기 전에<br />궁금한 것들</h1>
        <span>프로젝트 등록과 지원에 필요한 규칙만 정리했어요.</span>
      </header>

      <div className="faq-list">
        {faqs.map((faq, index) => (
          <details key={faq.question} className="faq-item" open={index === 0}>
            <summary>
              <span className="faq-item__number">{String(index + 1).padStart(2, '0')}</span>
              <span>{faq.question}</span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
