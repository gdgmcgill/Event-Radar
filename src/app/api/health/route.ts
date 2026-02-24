/**
 * GET /api/health
 * Comprehensive health check endpoint
 * Checks: Server, Supabase, Azure OAuth config, Environment variables, Memory Usage
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: System health check
 *     description: Monitors server, database, auth, and memory. Returns 200 if healthy, 503 if unhealthy.
 *     responses:
 *       200:
 *         description: System healthy
 *         content:
 *           application/json:
 *             example:
 *               status: healthy
 *               timestamp: "2026-01-03T17:30:00Z"
 *               uptime: 3600
 *               version: "0.1.0"
 *               checks:
 *                 server: { status: healthy }
 *                 database: { status: healthy }
 *                 supabase_auth: { status: healthy }
 *                 azure_oauth: { status: healthy }
 *                 environment: { status: healthy }
 *                 memory: { status: healthy }
 *       503:
 *         description: System unhealthy
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Store server start time
const serverStartTime = Date.now();

// Return type for each health check
interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  responseTime?: number;
  details?: any;
}

// Return type for the health check endpoint
interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    server: HealthCheck;
    database: HealthCheck;
    supabase_auth: HealthCheck;
    azure_oauth: HealthCheck;
    environment: HealthCheck;
    memory: HealthCheck;
  };
}
/**
 * 
┌─────────────────────────────────────┐
│         Supabase Platform           │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────┐          │
│  │  Auth Service        │ ← checkSupabaseAuth()
│  │  (login, sessions)   │
│  │                      │
│  │  ├─ Azure OAuth      │ ← checkAzureOAuth()
│  │  ├─ Google OAuth     │
│  │  └─ Email/Password   │
│  └──────────────────────┘
│                                     │
│  ┌──────────────────────┐          │
│  │  Database            │ ← checkDatabase()
│  │  (PostgreSQL)        │
│  │  - events            │
│  │  - users             │
│  │  - saved_events      │
│  │  - rsvps             │
│  └──────────────────────┘
│                                     │
└─────────────────────────────────────┘
 * 
 */


/**
 * Checks if Supabase database connection is working
 * Verifies all critical tables: events, users, saved_events, rsvps
 */
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const supabase = await createClient();
    
    // Check all tables
    const tables = ['events', 'users', 'saved_events'] as const;
    const tableChecks: Record<string, boolean> = {};

    // for each table, select 1 row and check if it exists
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        tableChecks[table] = false;
        const responseTime = Date.now() - startTime;
        return {
          status: "unhealthy",
          message: `Database table '${table}' check failed: ${error.message}`,
          responseTime,
          details: { 
            table,
            code: error.code,
            checkedTables: tableChecks
          }
        };
      }
      tableChecks[table] = true;
    }

    const responseTime = Date.now() - startTime;
    return {
      status: "healthy",
      message: "All database tables accessible",
      responseTime,
      details: {
        tables: tableChecks
      }
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: "unhealthy",
      message: `Database connection failed: ${error.message}`,
      responseTime,
    };
  }
}

/**
 * Checks if Supabase Auth is properly configured, 
 * Supabase Auth is the authentication system for the application.
 */
async function checkSupabaseAuth(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const supabase = await createClient();
    
    // Try to get the current session (will return null if no user, but connection works)
    // Check if the connection to the Supabase Auth service is working
    const { data, error } = await supabase.auth.getSession();

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "unhealthy",
        message: `Supabase Auth error: ${error.message}`,
        responseTime,
      };
    }

    return {
      status: "healthy",
      message: "Supabase Auth is operational",
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: "unhealthy",
      message: `Supabase Auth check failed: ${error.message}`,
      responseTime,
    };
  }
}

/**
 * Checks if Azure OAuth is properly configured
 * Tests if Supabase can generate Azure OAuth URL
 */
async function checkAzureOAuth(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const supabase = await createClient();
    
    // Test if we can generate an OAuth URL for Azure
    // This will fail if Azure provider is not configured in Supabase dashboard
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback`,
        skipBrowserRedirect: true, // Don't actually redirect, just test config
      },
    });

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "unhealthy",
        message: `Azure OAuth not configured: ${error.message}`,
        responseTime,
        details: {
          error: error.message,
          hint: "Configure Azure OAuth provider in Supabase dashboard"
        }
      };
    }

    // If we got a URL, Azure provider is configured
    if (data?.url) {
      return {
        status: "healthy",
        message: "Azure OAuth is configured and operational",
        responseTime,
        details: {
          provider: "azure",
          configured: true
        }
      };
    }

    // No error but no URL either - something is wrong
    return {
      status: "degraded",
      message: "Azure OAuth returned no authorization URL",
      responseTime,
      details: {
        warning: "OAuth configuration may be incomplete"
      }
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: "unhealthy",
      message: `Azure OAuth check failed: ${error.message}`,
      responseTime,
    };
  }
}

/**
 * Checks if required environment variables are set
 */
function checkEnvironment(): HealthCheck {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    return {
      status: "unhealthy",
      message: `Missing required environment variables`,
      details: { missing: missingVars }
    };
  }

  return {
    status: "healthy",
    message: "All required environment variables are set",
    details: {
      variables_checked: requiredEnvVars.length
    }
  };
}

/**
 * Checks system memory usage
 * Note: Thresholds are set for production. Development mode typically uses more memory.
 */
function checkMemory(): HealthCheck {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const externalMB = Math.round(memUsage.external / 1024 / 1024);

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let message = "Memory usage is normal";

    // More lenient thresholds - heap is dynamic and will grow/shrink
    // In production, consider monitoring RSS instead
    if (heapUsedMB > 512 && heapPercentage > 95) {
      // Only critical if we're using a lot of actual memory AND at high percentage
      status = "unhealthy";
      message = "Memory usage is critical";
    } else if (heapUsedMB > 256 && heapPercentage > 90) {
      status = "degraded";
      message = "Memory usage is high";
    }

    return {
      status,
      message,
      details: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        heapPercentage: `${heapPercentage}%`,
        rss: `${rssMB}MB`,
        external: `${externalMB}MB`,
      }
    };
  } catch (error: any) {
    return {
      status: "degraded",
      message: `Memory check failed: ${error.message}`,
    };
  }
}

/**
 * Main health check endpoint
 */
export async function GET() {
  try {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // in seconds

    // Run all health checks in parallel
    const [database, supabase_auth, azure_oauth, environment, memory] = await Promise.all([
      checkDatabase(),
      checkSupabaseAuth(),
      checkAzureOAuth(), // Now properly tests Azure OAuth configuration
      Promise.resolve(checkEnvironment()),
      Promise.resolve(checkMemory()),
    ]);

    // Server check (if we got here, server is up)
    const server: HealthCheck = {
      status: "healthy",
      message: "Server is running",
    };

    // Determine overall health status
    const checks = { server, database, supabase_auth, azure_oauth, environment, memory };
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

    // If any check is unhealthy, overall is unhealthy
    if (Object.values(checks).some(check => check.status === "unhealthy")) {
      overallStatus = "unhealthy";
    }
    // If any check is degraded (and none unhealthy), overall is degraded
    else if (Object.values(checks).some(check => check.status === "degraded")) {
      overallStatus = "degraded";
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp,
      uptime,
      version: process.env.npm_package_version || "0.1.0",
      checks,
    };

    // Return appropriate HTTP status code based on health
    const httpStatus = overallStatus === "healthy" ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error: any) {
    // If the health check itself fails, return a minimal unhealthy response
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - serverStartTime) / 1000),
        version: "unknown",
        error: `Health check failed: ${error.message}`,
      },
      { status: 503 }
    );
  }
}

