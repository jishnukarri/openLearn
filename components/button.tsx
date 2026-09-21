import Link from "next/link"; 
import { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react"; 

const VARIANT_STYLES = { 
  primary: "bg-primary text-white shadow-[0_4px_0_0_#39369a] disabled:active:shadow-[0_4px_0_0_#39369a]", 
  secondary: "bg-surface text-foreground shadow-[0_4px_0_0_var(--border)] disabled:active:shadow-[0_4px_0_0_var(--border)]", 
} as const; 

const SIZE_STYLES = { 
  default: "rounded-2xl px-6 py-3 text-sm", 
  compact: "rounded-xl px-4 py-2 text-sm", 
} as const; 

const BASE = "inline-flex items-center justify-center font-bold " + 
  "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 " + 
  "active:translate-y-1 active:shadow-none " + 
  "disabled:opacity-60 disabled:pointer-events-none " + 
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background " + 
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0"; 

type Variant = keyof typeof VARIANT_STYLES; 
type Size = keyof typeof SIZE_STYLES; 

interface SharedProps {
  variant?: Variant; 
  size?: Size;
}

export function Button({ 
  variant = "primary", 
  size = "default", 
  className = "", 
  ...props 
}: ButtonHTMLAttributes<HTMLButtonElement> & SharedProps) { 
  return ( 
    <button 
      className={`${BASE} ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`} 
      {...props} 
    /> 
  ); 
} 

export function ButtonLink({ 
  href, 
  variant = "primary", 
  size = "default", 
  className = "", 
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string } & SharedProps) { 
  return ( 
    <Link 
      href={href} 
      className={`${BASE} ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`} 
      {...props}
    > 
      {children} 
    </Link> 
  ); 
}
