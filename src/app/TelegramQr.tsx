import Image from 'next/image';

export const TELEGRAM_URL = 'https://t.me/FIRSTUZBEKISTAN';
export const TELEGRAM_HANDLE = '@FIRSTUZBEKISTAN';

/**
 * The event's Telegram channel, as a card the hall can scan from wherever it
 * happens to be looking — the public board, the projector, the admin pages.
 *
 * Always drawn as dark marks on a white card, whatever the page behind it: a
 * QR inverted or tinted to match a gradient is a QR that half the phones in
 * the room refuse to read. The handle is real text rather than part of the
 * image, so it stays sharp at every size and can be typed in by anyone whose
 * camera will not focus.
 *
 * `size` is the QR itself in pixels; the card sizes itself around it. On the
 * projector this is a plain number on the 1920×1080 canvas, so it scales with
 * everything else on screen.
 */
export default function TelegramQr({ size = 72, className = '' }: {
  size?: number;
  className?: string;
}) {
  const pad = Math.round(size * 0.09);
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex flex-col items-center bg-white shadow-sm shrink-0 ${className}`}
      style={{
        gap: Math.round(size * 0.06),
        padding: pad,
        borderRadius: Math.round(size * 0.16),
        lineHeight: 1,
        textDecoration: 'none',
      }}
    >
      <Image
        src="/telegram-qr.png"
        alt={`Telegram QR code for the ${TELEGRAM_HANDLE} channel`}
        width={size}
        height={size}
        style={{ width: size, height: size, display: 'block' }}
        unoptimized
      />
      <span
        style={{
          fontSize: Math.max(7, Math.round(size * 0.108)),
          fontWeight: 700,
          letterSpacing: '0.01em',
          color: 'rgb(55, 65, 81)',
          whiteSpace: 'nowrap',
        }}
      >
        {TELEGRAM_HANDLE}
      </span>
    </a>
  );
}
