import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { checkDatabaseConnection, type DatabaseStatus } from "@backend/server-actions";

export const Route = createFileRoute("/db-test")({
  loader: async (): Promise<DatabaseStatus> => {
    return checkDatabaseConnection();
  },
  component: DatabaseTestPage,
  head: () => ({
    meta: [
      { title: "DB Test — Filkom Merch UB" },
      { name: "description", content: "Database connectivity test for local MySQL" },
    ],
  }),
});

function DatabaseTestPage() {
  const status = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Test</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Halaman ini mengecek apakah aplikasi sudah terhubung ke MySQL lokal.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>Result from a live query to your local database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`rounded-lg border p-4 text-sm ${
                status.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <p className="font-semibold">{status.ok ? "Connected" : "Not connected"}</p>
              <p className="mt-1">{status.message}</p>
              {status.database && <p className="mt-1">Database: {status.database}</p>}
              {status.host && (
                <p className="mt-1">
                  Host: {status.host}:{status.port}
                </p>
              )}
              {status.user && <p className="mt-1">User: {status.user}</p>}
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-white/70 p-3 text-xs leading-relaxed text-slate-900">
                {JSON.stringify(status, null, 2)}
              </pre>
              {status.error && (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-white/70 p-3 text-xs leading-relaxed text-red-900">
                  {status.error}
                </pre>
              )}
            </div>

            <Button asChild>
              <a href="/db-test">Run check again</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What this checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Read DB config from .env.local</p>
            <p>2. Open MySQL pool with mysql2</p>
            <p>3. Run SELECT 1 to verify the connection</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
