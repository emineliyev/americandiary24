import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteContactMessage, fetchContactMessage, markContactMessageRead } from '../../api/contactMessages';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';

export function ContactMessageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const { data: message } = useQuery({
    queryKey: ['contact-message', id],
    queryFn: () => fetchContactMessage(Number(id)),
  });

  useEffect(() => {
    if (message && !message.is_read) {
      markContactMessageRead(message.id, true).then(() => {
        queryClient.invalidateQueries({ queryKey: ['contact-messages'] });
      });
    }
    // Only fires once per loaded message — re-running on every `message`
    // identity change would re-PATCH after the invalidation above refetches it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.id]);

  async function handleDelete() {
    if (!message) return;
    const ok = await confirm({ message: `Delete the message from "${message.name}"?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteContactMessage(message.id);
      queryClient.invalidateQueries({ queryKey: ['contact-messages'] });
      toast.success('Message deleted.');
      navigate('/inquiries');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete this message.'));
    }
  }

  if (!message) {
    return <p>Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>{message.subject || 'Message'}</h1>
        <button className="btn" onClick={handleDelete}>Delete</button>
      </div>

      <div className="card">
        <p style={{ margin: '0 0 6px' }}><strong>{message.name}</strong> &lt;<a href={`mailto:${message.email}`}>{message.email}</a>&gt;</p>
        <p className="field-hint" style={{ marginBottom: 18 }}>{new Date(message.created_at).toLocaleString()}</p>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{message.message}</p>
      </div>
    </div>
  );
}
