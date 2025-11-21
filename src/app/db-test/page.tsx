"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Database } from "lucide-react";

interface TestResult {
  name: string;
  status: "success" | "error" | "loading";
  message: string;
  data?: any;
}

export default function DatabaseTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const updateResult = (index: number, updates: Partial<TestResult>) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  };

  const runTests = async () => {
    setResults([]);
    setIsRunning(true);

    try {
      // Test 1: Connection Test
      addResult({
        name: "Database Connection",
        status: "loading",
        message: "Testing connection to Supabase...",
      });

      const connectionTest = await fetch("/api/db-test/connection");
      const connectionData = await connectionTest.json();

      updateResult(0, {
        status: connectionData.success ? "success" : "error",
        message: connectionData.message,
        data: connectionData.data,
      });

      if (!connectionData.success) {
        setIsRunning(false);
        return;
      }

      // Test 2: Check Tables
      addResult({
        name: "Table Structure",
        status: "loading",
        message: "Checking if tables exist...",
      });

      const tablesTest = await fetch("/api/db-test/tables");
      const tablesData = await tablesTest.json();

      updateResult(1, {
        status: tablesData.success ? "success" : "error",
        message: tablesData.message,
        data: tablesData.data,
      });

      // Test 3: Write Test (Create Club)
      addResult({
        name: "Write Operation",
        status: "loading",
        message: "Testing write to database...",
      });

      const writeTest = await fetch("/api/db-test/write", {
        method: "POST",
      });
      const writeData = await writeTest.json();

      updateResult(2, {
        status: writeData.success ? "success" : "error",
        message: writeData.message,
        data: writeData.data,
      });

      // Test 4: Read Test
      addResult({
        name: "Read Operation",
        status: "loading",
        message: "Testing read from database...",
      });

      const readTest = await fetch("/api/db-test/read");
      const readData = await readTest.json();

      updateResult(3, {
        status: readData.success ? "success" : "error",
        message: readData.message,
        data: readData.data,
      });

      // Test 5: Cleanup
    //   addResult({
    //     name: "Cleanup",
    //     status: "loading",
    //     message: "Cleaning up test data...",
    //   });

    //   const cleanupTest = await fetch("/api/db-test/cleanup", {
    //     method: "DELETE",
    //   });
    //   const cleanupData = await cleanupTest.json();

    //   updateResult(4, {
    //     status: cleanupData.success ? "success" : "error",
    //     message: cleanupData.message,
    //   });
    } catch (error) {
      addResult({
        name: "Test Error",
        status: "error",
        message: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Database className="h-8 w-8" />
          Database Test Suite
        </h1>
        <p className="text-muted-foreground">
          Test your Supabase connection and database operations
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run Database Tests</CardTitle>
          <CardDescription>
            This will test your database connection, check if tables exist, and
            perform read/write operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runTests} disabled={isRunning} size="lg">
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              "Run Tests"
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Test Results</h2>
          {results.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{result.name}</CardTitle>
                  {result.status === "loading" && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  )}
                  {result.status === "success" && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {result.status === "error" && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-2">{result.message}</p>
                {result.data && (
                  <div className="mt-4">
                    <Badge variant="secondary" className="mb-2">
                      Data
                    </Badge>
                    <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">📝 Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Make sure you have added your Supabase keys to{" "}
              <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code>
            </li>
            <li>
              Go to your Supabase dashboard → SQL Editor
            </li>
            <li>
              Run the SQL from{" "}
              <code className="bg-blue-100 px-2 py-1 rounded">schema.sql</code>{" "}
              to create tables
            </li>
            <li>Click "Run Tests" above to verify everything works</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

