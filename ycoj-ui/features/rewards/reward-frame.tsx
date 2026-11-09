import Image from 'next/image';

const FRAME_IDS = [
  'frame-tiger',
  'frame-pixel',
  'frame-racer',
  'frame-orbit',
  'frame-slime',
] as const;
type DecoratedFrameId = (typeof FRAME_IDS)[number];

export function isDecoratedFrame(id?: string): id is DecoratedFrameId {
  return FRAME_IDS.some((frame) => frame === id);
}

export default function RewardFrameDecoration({
  id,
}: {
  id: DecoratedFrameId;
}) {
  return (
    <Image
      src={`/rewards/frames/${id}.svg`}
      alt=""
      width={132}
      height={132}
      aria-hidden="true"
      data-reward-frame={id}
      className="pointer-events-none absolute -top-[16%] -left-[16%] z-10 size-[132%] max-w-none"
    />
  );
}
