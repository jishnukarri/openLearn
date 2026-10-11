// The openLearn app-icon mark (rounded square, italic serif "O"), used
// wherever the brand speaks: tutor avatars, auth, empty states.
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.58 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[22%] bg-primary font-[family-name:var(--font-display)] font-semibold italic leading-none text-white ${className}`}
    >
      O
    </span>
  );
}
