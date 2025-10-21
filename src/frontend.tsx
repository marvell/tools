import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Wrench, Package, Sparkles } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <Wrench className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">Tools</h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            A collection of various utilities and tools to simplify everyday tasks
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle>Coming Soon</CardTitle>
            </div>
            <CardDescription>
              This toolkit is currently under development
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              I'm building a personal collection of utilities to automate and simplify various aspects of my workflow.
              More tools will be added as the project evolves.
            </p>

            <div className="grid gap-3 mt-6">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <Package className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-sm">Tech Stack</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Built with Bun, React, TypeScript, Tailwind CSS, and shadcn/ui
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Personal project - more tools coming soon</p>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
