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
import { deleteCategory, fetchCategoryList, reorderCategories } from '../../api/categories';
import { useAuth } from '../../auth/AuthContext';
import { canManageTaxonomy } from '../../utils/roles';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';
import type { Category } from '../../api/types';

function SortableRow({ category, canManage, onDelete }: {
  category: Category;
  canManage: boolean;
  onDelete: (id: number, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <td style={{ width: 28 }}>
        {canManage && (
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', color: 'var(--text-muted)', touchAction: 'none' }}
            title="Drag to reorder"
          >
            ⠿
          </span>
        )}
      </td>
      <td>{canManage ? <Link to={`/categories/${category.id}`}>{category.name}</Link> : category.name}</td>
      <td>{category.slug}</td>
      <td>{category.is_active ? 'Yes' : 'No'}</td>
      {canManage && (
        <td>
          <button className="btn" onClick={() => onDelete(category.id, category.name)}>Delete</button>
        </td>
      )}
    </tr>
  );
}

export function CategoryListPage() {
  const { user } = useAuth();
  const canManage = canManageTaxonomy(user?.role);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data, isLoading } = useQuery({ queryKey: ['categories-admin'], queryFn: fetchCategoryList });
  const [items, setItems] = useState<Category[]>([]);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  async function handleDelete(id: number, name: string) {
    const ok = await confirm({ message: `Delete category "${name}"?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteCategory(id);
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
      toast.success(`Category "${name}" deleted.`);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete category.'));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    const previousOrders = new Map(items.map((c) => [c.id, c.order]));
    try {
      await reorderCategories(reordered.map((c) => c.id), previousOrders);
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
    } catch {
      setItems(items); // revert on failure
      toast.error('Failed to save the new order.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Categories</h1>
        {canManage && <Link to="/categories/new" className="btn btn-primary">+ New Category</Link>}
      </div>

      {isLoading || !data ? <p>Loading…</p> : (
        <>
          {canManage && <p className="field-hint" style={{ marginBottom: 10 }}>Drag ⠿ to reorder.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Active</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {items.map((c) => (
                    <SortableRow key={c.id} category={c} canManage={canManage} onDelete={handleDelete} />
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
