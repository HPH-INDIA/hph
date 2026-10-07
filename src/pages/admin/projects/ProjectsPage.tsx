import { useState, type FormEvent } from "react";
import { useCreateProjectMutation, useDeleteProjectMutation, useListProjectsQuery, useUpdateProjectMutation, type Project } from "@/api/projectsApi";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

export function ProjectsPage() {
  const { data: projects = [], isLoading, isError, refetch } = useListProjectsQuery();
  const { canWriteFeature } = useAuth();
  const canWrite = canWriteFeature("project_management");
  const [editor, setEditor] = useState<{ id?: number; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [create, { isLoading: creating }] = useCreateProjectMutation();
  const [update, { isLoading: updating }] = useUpdateProjectMutation();
  const [remove, { isLoading: deleting }] = useDeleteProjectMutation();
  const saving = creating || updating;
  const visible = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || !editor.name.trim() || !canWrite) return;
    try {
      const name = editor.name.trim();
      if (editor.id) await update({ id: editor.id, name }).unwrap();
      else await create({ name }).unwrap();
      setEditor(null);
    } catch { /* Shared API notifications show the server error and keep the form open. */ }
  }
  async function confirmDelete() {
    if (!pendingDelete || !canWrite) return;
    try { await remove(pendingDelete.id).unwrap(); setPendingDelete(null); }
    catch { /* Keep the dialog open for the server error. */ }
  }
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-lg font-semibold text-content-primary">Projects</h1>
        <p className="text-sm text-content-muted">Manage projects and view their assigned users.</p></div>
      {canWrite ? <Button onClick={() => setEditor({ name: "" })}>New project</Button> : <Badge tone="neutral">Read-only access</Badge>}
    </div>
    {canWrite && editor && <form onSubmit={save} className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold text-content-primary">{editor.id ? "Edit project" : "Create project"}</h2>
      <label className="flex flex-col gap-2 text-sm text-content-secondary">Project name
        <input autoFocus required maxLength={64} value={editor.name} disabled={saving} onChange={(e) => setEditor({ ...editor, name: e.target.value })}
          className="h-10 rounded-md border border-border bg-surface px-3 text-content-primary" />
      </label>
      <div className="mt-4 flex gap-2"><Button type="submit" isLoading={saving} disabled={!editor.name.trim()}>Save project</Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button></div>
    </form>}
    <label className="flex flex-col gap-2 text-sm text-content-secondary">Search projects
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" className="h-10 rounded-md border border-border bg-surface px-3 text-content-primary" />
    </label>
    {isLoading && <LoadingState label="Loading projects…" />}
    {isError && <ErrorState message="Couldn't load projects." onRetry={refetch} />}
    {!isLoading && !isError && visible.length === 0 && <EmptyState title={search ? "No matching projects" : "No projects yet"} />}
    {!isLoading && !isError && visible.length > 0 && <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm"><thead className="bg-surface-muted text-content-muted"><tr>
        <th className="px-4 py-3">Project</th><th className="px-4 py-3">Assigned users</th>{canWrite && <th className="px-4 py-3 text-right">Actions</th>}
      </tr></thead><tbody className="divide-y divide-border">{visible.map((p) => <tr key={p.id}>
        <td className="px-4 py-3 text-content-primary">{p.name} {p.is_system && <Badge tone="brand">System</Badge>}</td>
        <td className="px-4 py-3 text-content-secondary">{p.user_count}</td>
        {canWrite && <td className="px-4 py-3"><div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={p.is_system || saving || deleting} onClick={() => setEditor({ id: p.id, name: p.name })}>Edit</Button>
          <Button variant="danger" disabled={p.is_system || p.user_count > 0 || saving || deleting} onClick={() => setPendingDelete(p)}>Delete</Button>
        </div></td>}
      </tr>)}</tbody></table>
    </div>}
    <p className="text-xs text-content-muted">RCM and CODING are system projects used by reporting. Custom projects can be deleted once all users, including inactive users, are reassigned.</p>
    <ConfirmDialog open={pendingDelete !== null && canWrite} title="Delete project?" description={`Delete ${pendingDelete?.name ?? "this project"}? This cannot be undone.`}
      confirmLabel="Delete project" variant="danger" isLoading={deleting} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
  </div>;
}
