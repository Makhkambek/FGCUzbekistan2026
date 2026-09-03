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
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRegion, setEditRegion] = useState('');
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

  function startEdit(t: TeamRow) {
    // Switching rows mid-edit used to drop whatever had been typed without a
    // word.
    if (editId !== null && editId !== t.id
      && !window.confirm('Discard the unsaved changes to the other team?')) return;
    setEditId(t.id);
    setEditName(t.name);
    setEditRegion(t.region ?? '');
    setRowError(null);
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return;
    // Without a busy flag the row's Save and Delete stayed live during the
    // request, so an impatient second click sent the same change twice.
    setRowBusy(id);
    try {
      const res = await fetch(`/api/admin/teams?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, region: editRegion || undefined }),
      });
      if (res.ok) {
        setEditId(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setRowError({ id, message: data.error ?? 'Something went wrong' });
      }
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
        setRowError({ id, message: data.error ?? 'Something went wrong' });
        return;
      }
      router.refresh();
    } finally {
      setRowBusy(null);
    }
  }

  async function removeAll() {
    if (!window.confirm(`Delete all ${teams.length} teams? This cannot be undone.`)) return;
    if (!window.confirm('Are you absolutely sure?')) return;
    setDeleteAllError('');
    setDeletingAll(true);
    try {
      const res = await fetch('/api/admin/teams?all=true', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteAllError(data.error ?? 'Something went wrong');
      }
      router.refresh();
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
            <div className="flex items-center gap-2">
              {deleteAllError && (
                <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1" role="alert">
                  {deleteAllError}
                </span>
              )}
              <button onClick={removeAll} disabled={deletingAll}
                className="px-3 py-1.5 rounded-md text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50">
                {deletingAll ? 'Deleting…' : `Delete all (${teams.length})`}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="flex-1 min-w-[10rem] px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            placeholder="Name" value={name}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            onChange={(e) => setName(e.target.value)} />
          <input className="w-40 px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            placeholder="Region" value={region}
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
                              className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-100" />
                          : <span className="text-gray-900">{t.name}</span>}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                        {editId === t.id
                          ? <input value={editRegion} onChange={(e) => setEditRegion(e.target.value)} placeholder="—"
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
                            <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-700 ml-3">Cancel</button>
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
