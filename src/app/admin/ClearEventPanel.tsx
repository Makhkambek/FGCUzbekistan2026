'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearEventConfirmed, CLEAR_EVENT_PHRASE } from '@/lib/event/clear';

/**
 * The one button that starts the event over.
 *
 * Until now that took four screens in a fixed order — clear every scored
 * result, delete the bracket, delete the alliances, reset the schedule —
 * and any other order answered 409. Teams stay. It asks for the word to be
 * typed rather than a second "Are you sure?": two confirms in a row get
 * clicked through, a typed word does not.
 */
export default function ClearEventPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function clear() {
    const typed = window.prompt(
      `This deletes every match (played or not), the playoff bracket, the alliances and the skills `
      + `attempts. Teams are kept. Rollback points are saved first.\n\nType ${CLEAR_EVENT_PHRASE} to continue.`,
    );
    if (!clearEventConfirmed(typed)) return;

    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/event?confirm=${encodeURIComponent(CLEAR_EVENT_PHRASE)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok
        ? { kind: 'ok', text: data.summary ?? 'Event cleared' }
        : { kind: 'error', text: data.error ?? `Could not clear the event (status ${res.status})` });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Could not clear the event — check the connection and try again' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-lg p-6 space-y-3 border border-red-200 shadow-sm">
      <h2 className="text-lg font-semibold text-red-700">Danger zone</h2>
      <p className="text-sm text-gray-600">
        Start the event over: deletes all qualification and playoff matches with their results,
        the alliances and the skills attempts. Teams are kept, so a new schedule can be generated
        straight away.
      </p>
      <button onClick={clear} disabled={busy}
        className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50">
        {busy ? 'Clearing…' : 'Clear event'}
      </button>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          className={`text-sm rounded-md border px-3 py-2 ${message.kind === 'error'
            ? 'text-red-800 bg-red-50 border-red-200'
            : 'text-green-800 bg-green-50 border-green-200'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
