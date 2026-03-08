import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        destructive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        outline: 'border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
