import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 text-gray-700">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="text-xl font-semibold">Page not found</p>
      <Link to="/instances" className="text-sm text-blue-600 hover:underline">
        ← Go back to instances
      </Link>
    </div>
  );
}
