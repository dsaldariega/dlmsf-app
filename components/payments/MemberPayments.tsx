import { useState } from "react";
import { Search, ArrowLeft } from "lucide-react";

export default function Error404() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="error-page-wrapper">
      <div className="error-page-content">
        <div className="error-code">404</div>
        <div className="error-title">Oops! Page not found.</div>
        <div className="error-description">
          We could not find the page you were looking for.
        </div>

        {/* Search */}
        <form className="error-search" onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
