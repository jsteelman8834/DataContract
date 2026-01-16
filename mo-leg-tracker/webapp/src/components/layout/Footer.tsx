export function Footer() {
  return (
    <footer className="bg-mo-navy text-white py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-mo-gold font-semibold mb-3">
              Missouri Legislative Tracker
            </h3>
            <p className="text-gray-300 text-sm">
              A civic accountability tool making Missouri legislation accessible
              to all citizens. Track bills, committees, and your representatives.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-mo-gold font-semibold mb-3">Official Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://www.house.mo.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Missouri House of Representatives
                </a>
              </li>
              <li>
                <a
                  href="https://www.senate.mo.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Missouri Senate
                </a>
              </li>
              <li>
                <a
                  href="https://www.revisor.mo.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Missouri Revised Statutes
                </a>
              </li>
            </ul>
          </div>

          {/* Session Info */}
          <div>
            <h3 className="text-mo-gold font-semibold mb-3">Current Session</h3>
            <div className="text-sm text-gray-300">
              <p>2026 Second Regular Session</p>
              <p>103rd General Assembly</p>
              <p className="mt-2">
                <span className="inline-flex items-center px-2 py-1 bg-green-600 rounded-full text-xs">
                  Session Active
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-mo-blue text-center text-sm text-gray-400">
          <p>
            Data sourced from official Missouri General Assembly feeds.
            Not an official government website.
          </p>
          <p className="mt-1">
            &copy; {new Date().getFullYear()} Missouri Legislative Tracker.
            Built for civic engagement.
          </p>
        </div>
      </div>
    </footer>
  );
}
