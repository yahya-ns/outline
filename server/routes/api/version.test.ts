import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("GET /api/version endpoints", () => {
  it.each([
    ["/api/version"],
    ["/api/version.info"],
  ])("%s returns current and supported versions", async (path) => {
    const res = await server.get(path);
    expect(res.status).toEqual(200);
    const body = (await res.json()) as {
      current: number;
      supported: number[];
    };
    expect(body.current).toBe(3);
    expect(body.supported).toEqual([3, 4]);
  });

  it.each([
    ["/api/version"],
    ["/api/version.info"],
  ])("%s is unauthenticated", async (path) => {
    // No user / no auth header — should still succeed.
    const res = await server.get(path);
    expect(res.status).toEqual(200);
  });
});
