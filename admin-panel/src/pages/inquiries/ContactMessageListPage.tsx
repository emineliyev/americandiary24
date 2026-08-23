import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deleteContactMessage, fetchContactMessageList } from '../../api/contactMessages';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';

export function ContactMessageListPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const { data, isLoading } = useQuery({ queryKey: ['contact-messages'], queryFn: fetchContactMessageList });

  async function handleDelete(id: number, name: string) {
    const ok = await confirm({ message: `Delete the message from "${name}"?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteContactMessage(id);
      queryClient.invalidateQueries({ queryKey: ['contact-messages'] });
      toast.success('Message deleted.');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete this message.'));
    }
  }

  const unreadCount = data?.filter((m) => !m.is_read).length ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Inquiries</h1>
      </div>
      <p className="field-hint" style={{ marginBottom: 10 }}>
        Messages submitted through the site's Contact form.
        {unreadCount > 0 && ` ${unreadCount} unread.`}
      </p>

      {isLoading || !data ? <p>Loading…</p> : data.length === 0 ? (
        <p className="field-hint">No messages yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Received</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id} style={{ fontWeight: m.is_read ? 400 : 700 }}>
                <td>
                  {!m.is_read && <span className="badge badge-published">New</span>}
                </td>
                <td><Link to={`/inquiries/${m.id}`}>{m.name}</Link></td>
                <td>{m.email}</td>
                <td>{m.subject || <span className="field-hint">—</span>}</td>
                <td>{new Date(m.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn" onClick={() => handleDelete(m.id, m.name)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
