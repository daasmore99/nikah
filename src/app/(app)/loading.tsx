export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat" className="animate-pulse">
      <div className="h-3 w-24 bg-line-2" />
      <div className="mt-4 h-12 w-2/3 max-w-md bg-line-2" />
      <div className="mt-3 h-3 w-1/2 max-w-sm bg-line-2" />
      <div className="mt-10 space-y-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex justify-between border-b border-line-2 pb-4">
            <div className="h-3.5 bg-line-2" style={{ width: `${40 + ((i * 13) % 35)}%` }} />
            <div className="h-3.5 w-20 bg-line-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
