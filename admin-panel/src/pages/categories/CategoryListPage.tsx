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
import {
  deleteCategory, fetchCategoryList, reorderCategories, reorderHomepageCategories, updateCategory,
} from '../../api/categories';
import { useAuth } from '../../auth/AuthContext';
import { canManageTaxonomy } from '../../utils/roles';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';
import type { Category } from '../../api/types';

function SortableRow({ category, canManage, onToggleHomepage, onDelete }: {
  category: Category;
  canManage: boolean;
  onToggleHomepage: (category: Category) => void;
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
      <td>
        <input
          type="checkbox"
          checked={category.show_on_homepage}
          disabled={!canManage}
          onChange={() => onToggleHomepage(category)}
        />
      </td>
      {canManage && (
        <td>
          <button className="btn" onClick={() => onDelete(category.id, category.name)}>Delete</button>
        </td>
      )}
    </tr>
  );
}

function SortableHomepageRow({ category, rowNumber, isFirst, onToggleNewRow }: {
  category: Category;
  rowNumber: number;
  isFirst: boolean;
  onToggleNewRow: (category: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <td style={{ width: 28 }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted)', touchAction: 'none' }}
          title="Drag to reorder"
        >
          ⠿
        </span>
      </td>
      <td>{category.name}</td>
      <td style={{ color: 'var(--text-muted)' }}>Row {rowNumber}</td>
      <td>
        <input
          type="checkbox"
          checked={category.homepage_new_row}
          disabled={isFirst}
          onChange={() => onToggleNewRow(category)}
          title={isFirst ? 'The first section always starts a new row.' : 'Start a new row at this category'}
        />
      </td>
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
  const [homepageItems, setHomepageItems] = useState<Category[]>([]);

  useEffect(() => {
    if (data) {
      setItems(data);
      setHomepageItems(
        data.filter((c) => c.show_on_homepage).sort((a, b) => a.homepage_order - b.homepage_order),
      );
    }
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

  async function handleToggleHomepage(category: Category) {
    const nextValue = !category.show_on_homepage;
    setItems((prev) => prev.map((c) => (c.id === category.id ? { ...c, show_on_homepage: nextValue } : c)));
    try {
      await updateCategory(category.id, { show_on_homepage: nextValue });
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
    } catch (err: any) {
      setItems((prev) => prev.map((c) => (c.id === category.id ? { ...c, show_on_homepage: !nextValue } : c)));
      toast.error(errorMessage(err, 'Failed to update this category.'));
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

  async function handleToggleNewRow(category: Category) {
    const nextValue = !category.homepage_new_row;
    setHomepageItems((prev) => prev.map((c) => (c.id === category.id ? { ...c, homepage_new_row: nextValue } : c)));
    try {
      await updateCategory(category.id, { homepage_new_row: nextValue });
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
    } catch (err: any) {
      setHomepageItems((prev) => prev.map((c) => (c.id === category.id ? { ...c, homepage_new_row: !nextValue } : c)));
      toast.error(errorMessage(err, 'Failed to update this category.'));
    }
  }

  async function handleHomepageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = homepageItems.findIndex((c) => c.id === active.id);
    const newIndex = homepageItems.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(homepageItems, oldIndex, newIndex);
    setHomepageItems(reordered);

    const previousOrders = new Map(homepageItems.map((c) => [c.id, c.homepage_order]));
    try {
      await reorderHomepageCategories(reordered.map((c) => c.id), previousOrders);
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
    } catch {
      setHomepageItems(homepageItems); // revert on failure
      toast.error('Failed to save the new homepage order.');
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
          {canManage && <p className="field-hint" style={{ marginBottom: 10 }}>Drag ⠿ to reorder the navigation menu.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table" style={{ marginBottom: 32 }}>
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Active</th>
                  <th>Homepage</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {items.map((c) => (
                    <SortableRow
                      key={c.id}
                      category={c}
                      canManage={canManage}
                      onToggleHomepage={handleToggleHomepage}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>

          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Homepage Sections</h2>
          <p className="field-hint" style={{ marginBottom: 10 }}>
            Only categories checked "Homepage" above appear here. Drag ⠿ to set the order. Check "New Row"
            to start a fresh row at that category — un-check it to keep it side-by-side with the one above
            (up to 3 per row).
          </p>
          {homepageItems.length === 0 ? (
            <p className="field-hint">No categories are set to show on the homepage.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHomepageDragEnd}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Homepage Row</th>
                    <th>New Row</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={homepageItems.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {(() => {
                      let rowNumber = 0;
                      return homepageItems.map((c, index) => {
                        if (index === 0 || c.homepage_new_row) rowNumber += 1;
                        return (
                          <SortableHomepageRow
                            key={c.id}
                            category={c}
                            rowNumber={rowNumber}
                            isFirst={index === 0}
                            onToggleNewRow={handleToggleNewRow}
                          />
                        );
                      });
                    })()}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          )}
        </>
      )}
    </div>
  );
}
