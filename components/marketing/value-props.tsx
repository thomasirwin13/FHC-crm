import Image from 'next/image';
import styles from '@/styles/marketing.module.css';
import { ValuePropChatPreview } from './value-prop-chat-preview';
import { ConditionalGoCard } from './conditional-go-card';
const VALUE_PROPS = [
  {
    heading: 'Open source your locked knowledge',
    body: "SEs have a ton of info in their heads that never makes it to the rest of the team. Housing Advocacy CRM's AI chat assistant taps into your product library and tribal knowledge so anyone on the team can get expert-level answers instantly.",
    media: 'chat',
    reverse: false,
  },
  {
    heading: 'Know your pipeline inside and out',
    body: "Track every company, contact, and deal in one place. Housing Advocacy CRM gives your team a shared source of truth so nothing falls through the cracks and everyone stays aligned on what matters.",
    media: 'conditional-go',
    reverse: true,
  },
  {
    heading: 'Close like your best SEs',
    body: "Generic AI chatbot slop won't win deals. Housing Advocacy CRM lets your team leverage real product knowledge and past winning strategies to craft responses that actually resonate with prospects.",
    media: 'hero-demo',
    reverse: false,
  },
] as const;

export function ValueProps() {
  return (
    <section id="features" className={styles.valueProps}>
      <div className={styles.valuePropsInner}>
        {VALUE_PROPS.map((prop) => (
          <div
            key={prop.heading}
            className={prop.reverse ? styles.valuePropCardReverse : styles.valuePropCard}
          >
            <div className={styles.valuePropText}>
              <h2 className={styles.valuePropHeading}>{prop.heading}</h2>
              <p className={styles.valuePropBody}>{prop.body}</p>
            </div>
            <div className={styles.valuePropMedia}>
              {prop.media === 'chat' && (
                <>
                  <Image
                    src="/graphics/rolling-hills-bg.png"
                    alt=""
                    fill
                    className={styles.valuePropMediaBg}
                  />
                  <ValuePropChatPreview />
                </>
              )}
              {prop.media === 'conditional-go' && (
                <>
                  <Image
                    src="/graphics/sonoma-clouds-bg.png"
                    alt=""
                    fill
                    className={styles.valuePropMediaBg}
                  />
                  <ConditionalGoCard />
                </>
              )}
              {prop.media === 'hero-demo' && (
                <>
                  <Image
                    src="/graphics/windows-hills-bg.png"
                    alt=""
                    fill
                    className={styles.valuePropMediaBg}
                  />
                  <ValuePropChatPreview />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
