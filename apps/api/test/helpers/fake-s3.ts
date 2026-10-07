import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A tiny path-style S3 stand-in (PUT / HEAD / GET object) for integration tests. It ignores
 * signatures, which the AWS SDK and real presigned URLs exercise against the real service.
 */
export async function startFakeS3() {
  const objects = new Map<string, { body: Buffer; contentType: string }>();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://fake-s3");
    const key = decodeURIComponent(url.pathname.slice(1)); // "<bucket>/<key>"

    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      objects.set(key, { body: Buffer.concat(chunks), contentType: req.headers["content-type"] ?? "application/octet-stream" });
      res.writeHead(200, { ETag: '"fake"' });
      res.end();
      return;
    }

    const obj = objects.get(key);
    if (!obj) {
      res.writeHead(404, { "Content-Type": "application/xml" });
      res.end(req.method === "HEAD" ? undefined : "<Error><Code>NoSuchKey</Code></Error>");
      return;
    }
    res.writeHead(200, {
      "Content-Type": obj.contentType,
      "Content-Length": obj.body.length,
      ETag: '"fake"',
      "Last-Modified": new Date().toUTCString(),
    });
    res.end(req.method === "HEAD" ? undefined : obj.body);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { objects, endpoint: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}
