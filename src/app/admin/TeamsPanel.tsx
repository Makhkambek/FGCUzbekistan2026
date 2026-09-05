'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TeamRow { id: number; name: string; region: string | null }

export default function TeamsPanel({ teams }: { teams: TeamRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [deleteAllDone, setDeleteAllDone] = useState('');
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRegion, setEditRegion] = useState('');
  // What the row held when editing started, so "discard changes?" is only
  // asked when something was actually changed.
  const [editOriginal, setEditOriginal] = useState({ name: '', region: '' });
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  async function add() {
    if (!name.trim() || adding) return;
    setAddError('');
    setAdding(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, region: region || undefined }),
      });
      if (res.ok) {
        setName(''); setRegion('');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error ?? 'Something went wrong');
      }
    } finally {
      setAdding(false);
    }
  }

  const edited = editName !== editOriginal.name || editRegion !== editOriginal.region;

  function startEdit(t: TeamRow) {
    // Switching rows mid-edit used to drop whatever had been typed without a
    // word. Untouched rows are switched away from silently — a prompt on every
    // stray click is a prompt that gets clicked through without reading.
    if (editId !== null && editId !== t.id && edited
      && !window.confirm('Discard the unsaved changes to the other team?')) return;
    setEditId(t.id);
    setEditName(t.name);
    setEditRegion(t.region ?? '');
    setEditOriginal({ name: t.name, region: t.region ?? '' });
    setRowError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setRowError(null);
  }

  async function saveEdit(id: number) {
    // Save on an emptied name used to do nothing at all, with no hint that the
    // name was the reason.
    if (!editName.trim()) {
      setRowError({ id, message: 'A team needs a name' });
      return;
    }
    // Nothing typed, nothing to send — but the row still has to leave edit
    // mode, or Save looks broken on an untouched row.
    if (!edited) {
      cancelEdit();
      return;
    }
    // Without a busy flag the row's Save and Delete stayed live during the
    // request, so an impatient second click sent the same change twice.
    setRowError(null);
    setRowBusy(id);
    try {
      const res = await fetch(`/api/admin/teams?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(), region: editRegion.trim() || undefined,
        }),
      });
      if (res.ok) {
        // Cleared with the row: a rename that failed once and then succeeded
        // used to leave its red line sitting under the corrected name.
        cancelEdit();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setRowError({ id, message: data.error ?? `Could not save (status ${res.status})` });
      }
    } catch {
      setRowError({ id, message: 'Could not save — check the connection and try again' });
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this team?')) return;
    setRowError(null);
    setRowBusy(id);
    try {
      const res = await fetch(`/api/admin/teams?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRowError({ id, message: data.error ?? `Could not delete (status ${res.status})` });
        return;
      }
      router.refresh();
    } catch {
      setRowError({ id, message: 'Could not delete — check the connection and try again' });
    } finally {
      setRowBusy(null);
    }
  }

  async function removeAll() {
    if (!window.confirm(`Delete all ${teams.length} teams? This cannot be undone.`)) return;
    if (!window.confirm('Are you absolutely sure?')) return;
    setDeleteAllError('');
    setDeleteAllDone('');
    setDeletingAll(true);
    try {
      const res = await fetch('/api/admin/teams?all=true', { method: 'DELETE' });
      // A 409 answers with the reason; a crash answers with an HTML page, and
      // parsing that as JSON is what used to leave the operator staring at a
      // button that simply did nothing.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteAllError(data.error ?? `Could not delete the teams (status ${res.status})`);
        return;
      }
      setDeleteAllDone(`Deleted ${data.deleted ?? teams.length} teams`);
      router.refresh();
    } catch {
      setDeleteAllError('Could not delete the teams — check the connection and try again');
    } finally {
      setDeletingAll(false);
    }
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? teams.filter((t) => t.name.toLowerCase().includes(q) || (t.region ?? '').toLowerCase().includes(q))
    : teams;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 space-y-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Teams ({teams.length})</h2>
          {teams.length > 0 && (
            <button onClick={removeAll} disabled={deletingAll}
              className="px-3 py-1.5 rounded-md text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50">
              {deletingAll ? 'Deleting…' : `Delete all (${teams.length})`}
            </button>
          )}
        </div>
        {/* Its own full-width row: the reason names what has to be cleared
            first, which does not fit beside the button. */}
        {deleteAllError && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
            {deleteAllError}
          </p>
        )}
        {deleteAllDone && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2" role="status">
            {deleteAllDone}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input className="flex-1 min-w-[10rem] px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            placeholder="Name" value={name} maxLength={120}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            onChange={(e) => setName(e.target.value)} />
          <input className="w-40 px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            placeholder="Region" value={region} maxLength={120}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            onChange={(e) => setRegion(e.target.value)} />
          <button onClick={add} disabled={adding || !name.trim()}
            className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </div>

      {teams.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">No teams yet</p>
      ) : (
        <>
          <div className="p-3 border-b border-gray-100">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team or region…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          {visible.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">No teams match &ldquo;{query}&rdquo;</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                    <th className="text-left px-3 sm:px-4 py-2 w-10">#</th>
                    <th className="text-left px-3 sm:px-4 py-2">Team</th>
                    <th className="text-left px-3 sm:px-4 py-2">Region</th>
                    <th className="px-3 sm:px-4 py-2 w-32" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-400">{t.id}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                        {editId === t.id
                          ? <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                              maxLength={120}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(t.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-100" />
                          : <span className="text-gray-900">{t.name}</span>}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                        {editId === t.id
                          ? <input value={editRegion} onChange={(e) => setEditRegion(e.target.value)} placeholder="—"
                              maxLength={120}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(t.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-100" />
                          : <span className="text-gray-500">{t.region || '—'}</span>}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right whitespace-nowrap">
                        {editId === t.id ? (
                          <>
                            <button onClick={() => saveEdit(t.id)} disabled={rowBusy === t.id}
                              className="text-xs font-bold text-amber-600 hover:text-amber-700 disabled:opacity-50">
                              {rowBusy === t.id ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-700 ml-3">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(t)} className="text-xs text-gray-500 hover:text-gray-900">Edit</button>
                            <button onClick={() => remove(t.id)} disabled={rowBusy === t.id}
                              className="text-xs text-red-500 hover:text-red-700 ml-3 disabled:opacity-50">
                              {rowBusy === t.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </>
                        )}
                        {rowError?.id === t.id && <p className="text-xs text-red-600 mt-1">{rowError.message}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
