'use client';
import { useEffect, useState } from 'react';

/**
 * The projector screen is opened by whoever happens to be at the laptop, so
 * it cannot depend on someone remembering F11. The button hides itself a few
 * seconds after the mouse stops moving — an operator control must not sit in
 * the middle of a broadcast screen.
 */
export default function FullscreenButton() {
  const [visible, setVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    const show = () => {
      setVisible(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 3000);
    };
    show();
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener('mousemove', show);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('mousemove', show);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <button
      onClick={toggle}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: 'oklch(0 0 0 / 0.55)', color: 'oklch(1 0 0)',
        fontSize: 13, fontWeight: 600,
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
    </button>
  );
}
