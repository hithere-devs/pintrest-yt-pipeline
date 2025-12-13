import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-coral/50',
	{
		variants: {
			variant: {
				default:
					'bg-coral text-white shadow-sm hover:bg-coral/90 dark:bg-coral dark:hover:bg-coral/90',
				destructive:
					'bg-red-500 text-white shadow-sm hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700',
				outline:
					'border border-gray-200 bg-white shadow-sm hover:bg-gray-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-hover',
				secondary:
					'bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 dark:bg-dark-hover dark:text-white dark:hover:bg-dark-border',
				ghost: 'hover:bg-gray-100 dark:hover:bg-dark-hover',
				link: 'text-coral underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-9 rounded-lg px-3',
				lg: 'h-11 rounded-xl px-8',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button';
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
