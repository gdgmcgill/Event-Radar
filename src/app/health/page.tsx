"use client";

/**
 * Health Dashboard Page
 * Visual interface for monitoring system health
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Database, 
  Shield, 
  Key, 
  Settings, 
  MemoryStick,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Server,
  TrendingUp
} from "lucide-react";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  responseTime?: number;
  details?: any;
}

interface HealthData {
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

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/health");
      const data = await response.json();
      setHealthData(data);
      setLastChecked(new Date());
    } catch (err) {
      console.error("Error fetching health data:", err);
      setError("Failed to fetch health data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Degraded</Badge>;
      case "unhealthy":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unhealthy</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getCheckIcon = (checkName: string) => {
    switch (checkName) {
      case "server":
        return <Server className="h-5 w-5" />;
      case "database":
        return <Database className="h-5 w-5" />;
      case "supabase_auth":
        return <Shield className="h-5 w-5" />;
      case "azure_oauth":
        return <Key className="h-5 w-5" />;
      case "environment":
        return <Settings className="h-5 w-5" />;
      case "memory":
        return <MemoryStick className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getCheckTitle = (checkName: string) => {
    const titles: Record<string, string> = {
      server: "Server",
      database: "Database",
      supabase_auth: "Supabase Auth",
      azure_oauth: "Azure OAuth",
      environment: "Environment",
      memory: "Memory Usage"
    };
    return titles[checkName] || checkName;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 md:pt-32 md:pb-20 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Activity className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  System Health
                </h1>
              </div>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Monitor the status of all services and dependencies in real-time
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={fetchHealthData} 
                disabled={loading}
                className="gap-2 rounded-xl"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {lastChecked && (
                <p className="text-sm text-muted-foreground text-right">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Decorative Background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]"></div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 -mt-8 relative z-20">
        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-6 w-6" />
                Error Loading Health Data
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : loading && !healthData ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : healthData ? (
          <div className="space-y-8">
            {/* Overall Status Card */}
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {getStatusIcon(healthData.status)}
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                          healthData.status === 'healthy' ? 'bg-green-600' : 
                          healthData.status === 'degraded' ? 'bg-yellow-600' : 
                          'bg-red-600'
                        } opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          healthData.status === 'healthy' ? 'bg-green-600' : 
                          healthData.status === 'degraded' ? 'bg-yellow-600' : 
                          'bg-red-600'
                        }`}></span>
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-3xl">Overall Status</CardTitle>
                      <CardDescription className="mt-1">
                        {new Date(healthData.timestamp).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(healthData.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                    <Clock className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                      <p className="text-2xl font-bold">{formatUptime(healthData.uptime)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                    <TrendingUp className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="text-2xl font-bold">{healthData.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                    <Activity className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Services</p>
                      <p className="text-2xl font-bold">
                        {Object.values(healthData.checks).filter(c => c.status === 'healthy').length}/{Object.keys(healthData.checks).length}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Health Checks
            When admin is implemented, we can hide these checks from non-admin users
            */}
            <div>
              <h2 className="text-2xl font-bold mb-6 text-foreground">Service Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(healthData.checks).map(([checkName, check]) => (
                  <Card 
                    key={checkName}
                    className={`transition-all hover:shadow-lg ${
                      check.status === 'unhealthy' ? 'border-red-200 dark:border-red-900' :
                      check.status === 'degraded' ? 'border-yellow-200 dark:border-yellow-900' :
                      'border-green-200 dark:border-green-900'
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            check.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                            check.status === 'degraded' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' :
                            'bg-red-100 dark:bg-red-900/30 text-red-600'
                          }`}>
                            {getCheckIcon(checkName)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{getCheckTitle(checkName)}</CardTitle>
                            {check.responseTime !== undefined && (
                              <CardDescription className="text-xs mt-1">
                                {check.responseTime}ms
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        {getStatusIcon(check.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {check.message}
                      </p>
                      {check.details && (
                        <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                          <p className="text-xs font-mono text-muted-foreground">
                            {JSON.stringify(check.details, null, 2)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* API Endpoint Info */}
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">API Endpoint</CardTitle>
                <CardDescription>
                  Access health data programmatically for monitoring tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg font-mono text-sm">
                  <code className="flex-1">GET /api/health</code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/health`);
                    }}
                  >
                    Copy URL
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

