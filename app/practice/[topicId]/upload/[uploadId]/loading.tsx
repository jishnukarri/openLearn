export default function UploadLoading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10 lg:py-14">
      <div className="h-9 w-2/3 animate-pulse rounded-lg bg-surface" />
      <div className="h-4 w-full animate-pulse rounded-lg bg-surface [animation-delay:100ms]" />
      <div className="h-14 w-full animate-pulse rounded-2xl bg-surface [animation-delay:200ms]" />
    </main>
  );
}
