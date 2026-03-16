// Tile fetch + parse worker — runs off main thread to avoid blocking frame render
self.onmessage = async ({ data: { url, key } }) => {
  try {
    const fetchStart = performance.now();
    const response = await fetch(url);
    const fetchTime = performance.now() - fetchStart;

    if (!response.ok) {
      self.postMessage({ key, error: response.status, fetchTime, parseTime: 0 });
      return;
    }

    const parseStart = performance.now();
    const ds = new DecompressionStream("gzip");
    const text = await new Response(response.body.pipeThrough(ds)).text();
    const data = JSON.parse(text);
    const parseTime = performance.now() - parseStart;

    self.postMessage({ key, data, fetchTime, parseTime, features: data.features?.length || 0 });
  } catch (err) {
    self.postMessage({ key, error: String(err), fetchTime: 0, parseTime: 0 });
  }
};
