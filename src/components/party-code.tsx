import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PartyCode({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(value, { margin: 1, width: 320, errorCorrectionLevel: "M" }).then(setSrc);
  }, [value]);
  if (!src) return <div className="mx-auto size-56 rounded-2xl bg-bg" />;
  return <img src={src} alt="Handoff code for this counter" className="mx-auto size-56 rounded-2xl bg-white p-2" />;
}
