// Readable（Polly・S3の応答ボディ等）を、末尾まで読んでBufferにする（issue #2185。handler.jsから分離）
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { streamToBuffer };
