import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="app">
      <div className="state" style={{ minHeight: '60vh' }}>
        <div className="state-in">
          <svg
            className="state-mark"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9.5a3 3 0 1 1 3.5 3v1.5M12.5 17.5v.5" />
          </svg>
          <h1 className="t-h2">That branch, rep or lead does not exist</h1>
          <p className="t-small">
            The dataset covers 5 branches, 30 sales reps and 510 leads for June to December 2025. Anything
            outside that has no record here.
          </p>
          <Link href="/" className="btn btn-primary">
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
