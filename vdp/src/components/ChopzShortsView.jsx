import { useState } from "react";
import { createVideo, verifyLinkedProduct } from "../lib/chopzClient.js";
import { createProduct } from "../lib/chopzShopClient.js";

// VDP's real CHOPZ district -- a live client of CHOPZ's own real
// video/shoppable-link mechanic. No video or commerce logic here,
// every real video record, product record, and link-verification
// result comes back from CHOPZ's/CHOPZ SHOP's own servers. Spans both
// real apps deliberately -- a shoppable video is CHOPZ's own core
// pitch, and CHOPZ's own server has no local product list to fake one
// from (per videos.js's own header, linkedProductId is never validated
// against anything but CHOPZ SHOP's real live API).

export default function ChopzShortsView({ session }) {
  const [product, setProduct] = useState(null);
  const [video, setVideo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handlePostShoppableVideo = async () => {
    setBusy(true);
    setError(null);
    try {
      const newProduct = await createProduct({
        sellerId: session.userId, price: 24.99, affiliateCommissionPercent: 0.1, category: "apparel",
      });
      const newVideo = await createVideo({
        creatorId: session.userId, mediaUrl: "https://example.com/vdp-demo-short.mp4", linkedProductId: newProduct.id,
      });
      setProduct(newProduct);
      setVideo(newVideo);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const verified = await verifyLinkedProduct(video.id);
      setVideo(verified);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>CHOPZ — real shoppable video</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        A real CHOPZ SHOP product linked to a real CHOPZ video, verified live against CHOPZ SHOP's own API.
      </p>

      {!video && (
        <button onClick={handlePostShoppableVideo} disabled={busy}>Post a shoppable video (24.99 VCoin product)</button>
      )}

      {video && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Video #{video.id} — linked to product #{product.id} ({product.category}, {product.price} VCoin)
          </p>
          {!video.linkedProductVerified && (
            <button onClick={handleVerify} disabled={busy}>Verify linked product</button>
          )}
          {video.linkedProductVerified && (
            <p style={{ fontSize: 12, color: "#1a7d3c" }}>
              Verified live against CHOPZ SHOP — seller {video.linkedProductSellerId}, {video.linkedProductPrice} VCoin.
            </p>
          )}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
