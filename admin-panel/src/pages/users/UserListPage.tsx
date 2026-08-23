import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { deactivateUser, fetchUserList, updateUser } from '../../api/users';
import { fetchAuthorList, updateAuthor } from '../../api/authors';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';
import { ROLE_LABELS } from '../../utils/roles';
import type { AdminUser, Author } from '../../api/types';

interface Row {
  user: AdminUser;
  author: Author | null;
}

function SortableRow({ row, onDeactivate }: { row: Row; onDeactivate: (row: Row) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.user.id });
  const fullName = `${row.user.first_name} ${row.user.last_name}`.trim() || row.user.username;

  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <td style={{ width: 28 }}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', touchAction: 'none' }} title="Drag to reorder">⠿</span>
      </td>
      <td style={{ width: 40 }}>
        {row.author?.avatar ? (
          <img src={row.author.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)' }} />
        )}
      </td>
      <td><Link to={`/users/${row.user.id}`}>{fullName}</Link></td>
      <td>{ROLE_LABELS[row.user.role]}</td>
      <td>{row.author?.show_on_about ? 'Yes' : 'No'}</td>
      <td><span className={`badge badge-${row.user.is_active ? 'published' : 'archived'}`}>{row.user.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button className="btn" onClick={() => onDeactivate(row)}>{row.user.is_active ? 'Deactivate' : 'Reactivate'}</button>
      </td>
    </tr>
  );
}

export function UserListPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users-admin'], queryFn: fetchUserList });
  const { data: authors, isLoading: authorsLoading } = useQuery({ queryKey: ['authors-admin'], queryFn: fetchAuthorList });

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!users || !authors) return;
    const merged = users.map((user) => ({ user, author: authors.find((a) => a.user === user.id) ?? null }));
    merged.sort((a, b) => (a.author?.order ?? 999) - (b.author?.order ?? 999));
    setRows(merged);
  }, [users, authors]);

  async function handleDeactivate(row: Row) {
    try {
      if (row.user.is_active) {
        const ok = await confirm({
          message: `Deactivate "${row.user.username}"? They won't be able to log in and their profile will be hidden from the About page.`,
          confirmLabel: 'Deactivate',
          danger: true,
        });
        if (!ok) return;
        await deactivateUser(row.user.id);
        toast.success(`"${row.user.username}" deactivated.`);
      } else {
        await updateUser(row.user.id, { is_active: true });
        toast.success(`"${row.user.username}" reactivated.`);
      }
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to update this user.'));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.user.id === active.id);
    const newIndex = rows.findIndex((r) => r.user.id === over.id);
    const reordered = arrayMove(rows, oldIndex, newIndex);
    setRows(reordered);

    const updates = reordered
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => row.author && row.author.order !== index);
    try {
      await Promise.all(updates.map(({ row, index }) => updateAuthor(row.author!.id, { order: index })));
      queryClient.invalidateQueries({ queryKey: ['authors-admin'] });
    } catch {
      setRows(rows);
      toast.error('Failed to save the new order.');
    }
  }

  const loading = usersLoading || authorsLoading;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Users</h1>
        <Link to="/users/new" className="btn btn-primary">+ New User</Link>
      </div>

      {loading ? <p>Loading…</p> : (
        <>
          <p className="field-hint" style={{ marginBottom: 10 }}>Drag ⠿ to reorder how journalists appear on the About page.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th></th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>On About page</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <SortableContext items={rows.map((r) => r.user.id)} strategy={verticalListSortingStrategy}>
                  {rows.map((row) => (
                    <SortableRow key={row.user.id} row={row} onDeactivate={handleDeactivate} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </>
      )}
    </div>
  );
}
