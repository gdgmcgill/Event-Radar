import { GET } from "./route";
import { verifyAdmin } from "@/lib/admin";

jest.mock("@/lib/admin", () => ({
  verifyAdmin: jest.fn(),
}));

describe("GET /api/admin/analytics/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when user is not admin", async () => {
    (verifyAdmin as jest.Mock).mockResolvedValue({
      supabase: {},
      isAdmin: false,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns analytics data for admin users", async () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const mockUsers = [
      { created_at: fiveDaysAgo.toISOString() },
      { created_at: fiveDaysAgo.toISOString() },
      { created_at: threeDaysAgo.toISOString() },
    ];

    let callCount = 0;

    const mockSupabase = {
      from: jest.fn().mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // allUsers query - returns rows
          return {
            select: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockUsers,
                  error: null,
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          // activeUsers - count only
          return {
            select: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                count: 5,
                data: null,
                error: null,
              }),
            }),
          };
        }

        if (callCount === 3) {
          // engagedUsers - count only
          return {
            select: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                count: 2,
                data: null,
                error: null,
              }),
            }),
          };
        }

        // totalUsersResult - count only
        return {
          select: jest.fn().mockResolvedValue({
            count: 10,
            data: null,
            error: null,
          }),
        };
      }),
    };

    (verifyAdmin as jest.Mock).mockResolvedValue({
      supabase: mockSupabase,
      isAdmin: true,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);

    // Should have all required fields
    expect(body).toHaveProperty("dailySignups");
    expect(body).toHaveProperty("cumulativeGrowth");
    expect(body).toHaveProperty("activeUsersLast7Days");
    expect(body).toHaveProperty("engagedUsers");
    expect(body).toHaveProperty("totalUsers");

    // Daily signups should cover 31 days (30 days ago through today)
    expect(body.dailySignups.length).toBeGreaterThanOrEqual(30);

    // Each entry should have date and count
    for (const day of body.dailySignups) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("count");
      expect(typeof day.date).toBe("string");
      expect(typeof day.count).toBe("number");
    }

    // Cumulative growth should match dailySignups length
    expect(body.cumulativeGrowth).toHaveLength(body.dailySignups.length);

    // Each cumulative entry should have date and total
    for (const day of body.cumulativeGrowth) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("total");
      expect(typeof day.total).toBe("number");
    }

    // Cumulative should be non-decreasing
    for (let i = 1; i < body.cumulativeGrowth.length; i++) {
      expect(body.cumulativeGrowth[i].total).toBeGreaterThanOrEqual(
        body.cumulativeGrowth[i - 1].total
      );
    }

    // The last cumulative total should equal totalUsers
    expect(
      body.cumulativeGrowth[body.cumulativeGrowth.length - 1].total
    ).toBe(body.totalUsers);

    expect(body.activeUsersLast7Days).toBe(5);
    expect(body.engagedUsers).toBe(2);
    expect(body.totalUsers).toBe(10);
  });

  it("handles empty user data gracefully", async () => {
    let callCount = 0;

    const mockSupabase = {
      from: jest.fn().mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (callCount <= 3) {
          return {
            select: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                count: 0,
                data: null,
                error: null,
              }),
            }),
          };
        }

        return {
          select: jest.fn().mockResolvedValue({
            count: 0,
            data: null,
            error: null,
          }),
        };
      }),
    };

    (verifyAdmin as jest.Mock).mockResolvedValue({
      supabase: mockSupabase,
      isAdmin: true,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalUsers).toBe(0);
    expect(body.activeUsersLast7Days).toBe(0);
    expect(body.engagedUsers).toBe(0);

    // All daily signups should be 0
    for (const day of body.dailySignups) {
      expect(day.count).toBe(0);
    }

    // All cumulative values should be 0
    for (const day of body.cumulativeGrowth) {
      expect(day.total).toBe(0);
    }
  });
});
