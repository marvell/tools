import "./index.css";

export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground">
            Marvell Tools
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            A collection of developer utilities and productivity tools
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-sm space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-card-foreground">
            Coming Soon
          </h2>

          <p className="text-muted-foreground max-w-md mx-auto">
            We're currently building a suite of powerful tools to streamline your development workflow.
            Check back soon to discover what we have in store!
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Built with Bun and React</p>
        </div>
      </div>
    </div>
  );
}

export default App;
