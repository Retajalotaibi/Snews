import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

type ImpactDirection = 'strong-up' | 'up' | 'neutral' | 'down' | 'strong-down' | string;

const directionMeta: Record<string, { label: string; className: string; Icon: typeof ArrowRight }> = {
  'strong-up': { label: 'Strong up', className: 'bg-teal-100 text-teal-800 border-teal-200', Icon: ArrowUpRight },
  up: { label: 'Up', className: 'bg-teal-50 text-teal-700 border-teal-200', Icon: ArrowUpRight },
  neutral: { label: 'Neutral', className: 'bg-stone-100 text-stone-600 border-stone-200', Icon: ArrowRight },
  down: { label: 'Down', className: 'bg-orange-50 text-orange-800 border-orange-200', Icon: ArrowDownRight },
  'strong-down': { label: 'Strong down', className: 'bg-orange-100 text-orange-900 border-orange-200', Icon: ArrowDownRight },
};

export function ImpactBadge({ asset, direction }: { asset: string; direction: ImpactDirection }) {
  const meta = directionMeta[direction] ?? directionMeta.neutral;
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${meta.className}`}
      data-testid={`badge-impact-${asset}-${direction}`}
    >
      <span>{asset}</span>
      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}