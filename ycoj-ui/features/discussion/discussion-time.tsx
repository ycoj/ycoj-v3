import dayjs from 'dayjs';
import { useFormatter } from 'next-intl';

type Props = {
  value: Date | string | number;
  className?: string;
};

/** Relative time with the exact date on hover. */
export default function DiscussionTime({ value, className }: Props) {
  const format = useFormatter();
  const date = dayjs(value);
  if (!date.isValid()) return null;
  const text = format.relativeTime(date.toDate(), new Date());

  return (
    <time
      dateTime={date.toISOString()}
      title={date.format('YYYY-MM-DD HH:mm')}
      data-llm-text={text}
      className={className}
      suppressHydrationWarning
    >
      {text}
    </time>
  );
}
