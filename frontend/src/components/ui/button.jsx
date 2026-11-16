import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonStyles = cva('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      primary: 'bg-teal-600 text-white hover:bg-teal-700',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    },
    size: {
      default: 'h-10 px-4 text-sm',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-12 rounded-xl px-6 text-base',
      icon: 'h-10 w-10',
    },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
});

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
