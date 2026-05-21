import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium opacity-50 mb-2">404</p>
        <h2 className="text-2xl font-bold mb-3">Page not found</h2>
        <p className="text-sm opacity-70 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded border hover:opacity-80"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
