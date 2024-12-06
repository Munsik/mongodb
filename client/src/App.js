import React, { useState } from "react";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("lexical");
  const [results, setResults] = useState([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTime, setSearchTime] = useState(null); // client search time
  const [serverTime, setServerTime] = useState(null); // server search time

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    setAnswer("");
    setSearchTime(null);
    setServerTime(null);

    const startTime = performance.now(); // client search start time

    try {
      const response = await fetch("http://localhost:3000/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        if (mode === "rag") setAnswer(data.answer || "No answer provided.");
        setServerTime(data.serverTime); // server search time
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      const endTime = performance.now(); // end time
      setSearchTime((endTime - startTime).toFixed(2)); // client search time(ms)
      setLoading(false);
    }
  };

  // Enter 키로 검색 실행
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSearch();
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Movie Search</h1>
        <div className="container">
          <div className="search-container">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your query..."
              className="search-box"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="search-button"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          <div className="search-modes">
            <label>
              <input
                type="radio"
                value="lexical"
                checked={mode === "lexical"}
                onChange={(e) => setMode(e.target.value)}
              />
              Text Search
            </label>
            <label>
              <input
                type="radio"
                value="hybrid"
                checked={mode === "hybrid"}
                onChange={(e) => setMode(e.target.value)}
              />
              Hybrid Search
            </label>
            <label>
              <input
                type="radio"
                value="rag"
                checked={mode === "rag"}
                onChange={(e) => setMode(e.target.value)}
              />
              RAG Search
            </label>
          </div>
        </div>

        {searchTime !== null && (
          <p className="search-time">
            Search completed in {searchTime} ms (Server time: {serverTime}).
          </p>
        )}
        {error && <p className="error">{error}</p>}
        {mode === "rag" && answer && (
          <div>
            <h2>Generated Answer</h2>
            <div dangerouslySetInnerHTML={{ __html: answer }} />
          </div>
        )}
        {results.length > 0 && (
          <table className="results-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Plot</th>
                <th>Full Plot</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result._id}>
                  <td>{result.title}</td>
                  <td>{result.plot || "N/A"}</td>
                  <td>{result.fullplot || "N/A"}</td>
                  <td>
                    {result.similarity !== undefined
                      ? result.similarity.toFixed(4)
                      : result.score !== undefined
                      ? result.score.toFixed(4)
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </header>
    </div>
  );
}

export default App;
