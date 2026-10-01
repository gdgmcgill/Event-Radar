/** M3 P1-07: the SSRF-safe fetch that persists ingested Instagram images.
 * DNS and fetch are injected, so no network is touched. */
import {
  ImageFetchError,
  INGEST_IMAGE_HOSTS,
  fetchIngestImage,
  isPrivateAddress,
} from "../safeImageFetch";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
const IMAGE_URL = "https://scontent-yyz1-1.cdninstagram.com/v/t51/abc.jpg?stp=1";
const PUBLIC_IP = "157.240.3.63";

type Fetch = typeof fetch;
const publicLookup = async () => [PUBLIC_IP];

function respond(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

function fetchSequence(...responses: Array<Response | ((url: string) => Response)>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return typeof next === "function" ? next(url) : next;
  }) as unknown as Fetch;
  return { fetchImpl, calls };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ImageFetchError);
    return (error as ImageFetchError).code;
  }
  throw new Error("expected a rejection");
}

describe("fetchIngestImage", () => {
  it("http:// is disallowed_url, with no DNS or fetch", async () => {
    const lookup = jest.fn(publicLookup);
    const { fetchImpl } = fetchSequence();
    expect(await code(fetchIngestImage("http://scontent.cdninstagram.com/a.jpg", { lookup, fetchImpl }))).toBe("disallowed_url");
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a host outside the allow-list is disallowed_url", async () => {
    const { fetchImpl } = fetchSequence();
    expect(await code(fetchIngestImage("https://evil.test/a.jpg", { lookup: publicLookup, fetchImpl }))).toBe("disallowed_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["userinfo", "https://user:pass@scontent.cdninstagram.com/a.jpg"],
    ["a non-default port", "https://scontent.cdninstagram.com:8443/a.jpg"],
    ["a look-alike suffix", "https://cdninstagram.com.evil.test/a.jpg"],
    ["a look-alike prefix", "https://evilcdninstagram.com/a.jpg"],
    ["an IP literal", "https://127.0.0.1/a.jpg"],
    ["not a URL", "not a url"],
  ])("%s is disallowed_url", async (_label, url) => {
    const { fetchImpl } = fetchSequence();
    expect(await code(fetchIngestImage(url, { lookup: publicLookup, fetchImpl }))).toBe("disallowed_url");
  });

  it("an allowed host resolving to 10.0.0.5 is private_address, before any fetch", async () => {
    const { fetchImpl } = fetchSequence();
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: async () => ["10.0.0.5"], fetchImpl }))).toBe("private_address");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("an allowed host resolving to [public, 127.0.0.1] is private_address", async () => {
    const { fetchImpl } = fetchSequence();
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: async () => [PUBLIC_IP, "127.0.0.1"], fetchImpl }))).toBe("private_address");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a host that resolves to nothing is private_address (fails closed)", async () => {
    const { fetchImpl } = fetchSequence();
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: async () => [], fetchImpl }))).toBe("private_address");
  });

  it("a redirect to https://169.254.169.254/ is disallowed_url", async () => {
    const { fetchImpl, calls } = fetchSequence(respond(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe("disallowed_url");
    expect(calls).toHaveLength(1);
  });

  it("each hop is re-resolved: a redirect to an allowed host on a private address is private_address", async () => {
    const lookup = jest.fn(async (host: string) => (host.startsWith("evil") ? ["192.168.1.10"] : [PUBLIC_IP]));
    const { fetchImpl } = fetchSequence(respond(null, { status: 301, headers: { location: "https://evil.fbcdn.net/a.jpg" } }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup, fetchImpl }))).toBe("private_address");
    expect(lookup).toHaveBeenCalledWith("evil.fbcdn.net");
  });

  it("a relative redirect resolves against the current URL and is followed", async () => {
    const { fetchImpl, calls } = fetchSequence(
      respond(null, { status: 302, headers: { location: "/v/t51/other.png" } }),
      respond(PNG, { status: 200 })
    );
    const result = await fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl });
    expect(result.type).toBe("png");
    expect(calls.map((c) => c.url)).toEqual([IMAGE_URL, "https://scontent-yyz1-1.cdninstagram.com/v/t51/other.png"]);
    for (const call of calls) expect(call.init?.redirect).toBe("manual");
  });

  it("4 redirects is too_many_redirects", async () => {
    const hop = () => respond(null, { status: 302, headers: { location: IMAGE_URL } });
    const { fetchImpl, calls } = fetchSequence(hop(), hop(), hop(), hop(), hop());
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe("too_many_redirects");
    expect(calls).toHaveLength(4);
  });

  it("a redirect without Location is http_302", async () => {
    const { fetchImpl } = fetchSequence(respond(null, { status: 302 }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe("http_302");
  });

  it.each([403, 404, 410, 500])("a %i is http_<status>", async (status) => {
    const { fetchImpl } = fetchSequence(respond("nope", { status }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe(`http_${status}`);
  });

  it("a content-length over the cap is too_large", async () => {
    const { fetchImpl } = fetchSequence(respond(PNG, { status: 200, headers: { "content-length": String(6 * 1024 * 1024) } }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe("too_large");
  });

  it("a 6 MB streamed body without content-length is too_large, and the stream is cancelled", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    chunk.set(PNG);
    let pulled = 0;
    let cancelled = false;
    // Six 1 MB chunks and then no end: only the cap can stop the read.
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled <= 6) controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const { fetchImpl } = fetchSequence(respond(stream, { status: 200 }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe("too_large");
    expect(cancelled).toBe(true);
  });

  it("HTML bytes are not_image", async () => {
    const { fetchImpl } = fetchSequence(respond("<!doctype html><html><body>login</body></html>", { status: 200, headers: { "content-type": "image/jpeg" } }));
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl }))).toBe("not_image");
  });

  it("PNG bytes answer { type: 'png' } with the bytes, on an fbcdn host too", async () => {
    const { fetchImpl, calls } = fetchSequence(respond(PNG, { status: 200 }));
    const result = await fetchIngestImage("https://scontent.xx.fbcdn.net/v/p.png", { lookup: publicLookup, fetchImpl });
    expect(result.type).toBe("png");
    expect(Array.from(result.bytes)).toEqual(Array.from(PNG));
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("a fetch that outlives the timeout is timeout", async () => {
    const fetchImpl = jest.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })
    ) as unknown as Fetch;
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup: publicLookup, fetchImpl, timeoutMs: 20 }))).toBe("timeout");
  });

  it("a DNS lookup that never resolves is timeout, with no fetch (M3 final review)", async () => {
    const lookup = jest.fn(() => new Promise<string[]>(() => undefined));
    const fetchImpl = jest.fn() as unknown as Fetch;
    expect(await code(fetchIngestImage(IMAGE_URL, { lookup, fetchImpl, timeoutMs: 20 }))).toBe("timeout");
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("INGEST_IMAGE_HOSTS", () => {
  it.each([
    ["cdninstagram.com", true],
    ["scontent-yyz1-1.cdninstagram.com", true],
    ["SCONTENT.CDNINSTAGRAM.COM", true],
    ["scontent.xx.fbcdn.net", true],
    ["fbcdn.net", true],
    ["instagram.com", false],
    ["cdninstagram.com.evil.test", false],
    ["notfbcdn.net", false],
  ])("%s -> %s", (host, allowed) => {
    expect(INGEST_IMAGE_HOSTS.some((pattern) => pattern.test(host))).toBe(allowed);
  });
});

describe("isPrivateAddress", () => {
  it.each([
    ["0.0.0.0", true], ["0.255.255.255", true],
    ["10.0.0.1", true], ["10.255.255.255", true],
    ["100.64.0.1", true], ["100.127.255.254", true], ["100.63.255.255", false], ["100.128.0.0", false],
    ["127.0.0.1", true], ["127.255.255.255", true],
    ["169.254.169.254", true], ["169.254.0.1", true],
    ["172.16.0.1", true], ["172.31.255.255", true], ["172.15.255.255", false], ["172.32.0.0", false],
    ["192.0.0.1", true], ["192.0.0.255", true], ["192.0.1.1", false],
    ["192.168.0.1", true], ["192.168.255.255", true],
    ["198.18.0.1", true], ["198.19.255.255", true], ["198.20.0.0", false], ["198.17.255.255", false],
    ["224.0.0.1", true], ["239.255.255.255", true],
    ["240.0.0.1", true], ["255.255.255.255", true],
    ["8.8.8.8", false], ["1.1.1.1", false], [PUBLIC_IP, false],
    ["::", true], ["::1", true],
    ["fc00::1", true], ["fd12:3456::1", true],
    ["fe80::1", true], ["febf::1", true], ["fec0::1", false],
    ["ff02::1", true], ["ff00::", true],
    ["::ffff:127.0.0.1", true], ["::ffff:10.1.2.3", true], ["::ffff:7f00:1", true], ["::ffff:8.8.8.8", false],
    ["64:ff9b::1", true], ["64:ff9b::808:808", true],
    ["2001:4860:4860::8888", false], ["2a03:2880:f10c:83:face:b00c:0:25de", false],
    ["not an ip", true], ["", true], ["999.1.1.1", true],
  ])("%s -> %s", (ip, isPrivate) => {
    expect(isPrivateAddress(ip)).toBe(isPrivate);
  });
});
