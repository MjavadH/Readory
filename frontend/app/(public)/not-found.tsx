import Link from 'next/link';

// Global 404 error page component
export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h2 className="text-2xl font-bold">Page Not Found</h2>
            <p className="mt-2">Could not find requested resource</p>
            <Link
                href="./"
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
                Return Home
            </Link>
        </div>
    );
}