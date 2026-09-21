'use client';

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'amber' | 'ghost' | 'emerald';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    loadingText?: string;
    icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    icon,
    disabled,
    children,
    type = 'button',
    ...props
}, ref) => {
    // Base styles
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none shadow-sm active:scale-[0.98]';

    // Variant mapping
    const variantClasses = {
        primary: 'bg-green-700 hover:bg-green-800 text-white focus:ring-green-600 border border-transparent shadow-green-700/20',
        emerald: 'bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-emerald-600 border border-transparent shadow-emerald-700/20',
        secondary: 'bg-slate-800 hover:bg-slate-900 text-white focus:ring-slate-700 border border-transparent',
        amber: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500 border border-transparent shadow-amber-600/20',
        outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-slate-400 hover:border-slate-400',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 border border-transparent shadow-red-600/20',
        ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-300 shadow-none'
    }[variant];

    // Size mapping
    const sizeClasses = {
        xs: 'px-2.5 py-1 text-xs gap-1',
        sm: 'px-3 py-1.5 text-xs gap-1.5',
        md: 'px-4 py-2 text-sm gap-2',
        lg: 'px-5 py-2.5 text-base gap-2.5 font-semibold'
    }[size];

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || isLoading}
            className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
            {...props}
        >
            {isLoading ? (
                <>
                    <Loader2 className="animate-spin flex-shrink-0" size={size === 'xs' || size === 'sm' ? 14 : 16} />
                    <span>{loadingText || children}</span>
                </>
            ) : (
                <>
                    {icon && <span className="flex-shrink-0">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
});

Button.displayName = 'Button';
export default Button;
