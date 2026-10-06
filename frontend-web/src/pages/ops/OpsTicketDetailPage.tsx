import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  assignSupportTicket,
  getSupportTicket,
  sendSupportReply,
  updateSupportPriority,
  updateSupportStatus,
  type SupportTicketDetailDto,
  type TicketPriority,
  type TicketStatus,
} from '../../api/support';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Input, Select, Skeleton, Textarea, type BadgeTone } from '../../components/ui';
import { notify } from '../../components/ui/notify';

const STATUS_TONES: Record<TicketStatus, BadgeTone> = {
  Open: 'info',
  InProgress: 'info',
  WaitingForCustomer: 'warning',
  Resolved: 'success',
  Closed: 'neutral',
};

const PRIORITY_TONES: Record<TicketPriority, BadgeTone> = {
  Low: 'neutral',
  Normal: 'info',
  High: 'warning',
  Urgent: 'danger',
};

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

export function OpsTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const backPath = location.pathname.startsWith('/admin') ? '/admin/support' : '/ops/support';

  const [ticket, setTicket] = useState<SupportTicketDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reply form state
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Priority update state
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // Assignment update state
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [customAssignId, setCustomAssignId] = useState('');
  const [showCustomAssign, setShowCustomAssign] = useState(false);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      setLoading(false);
      setError('Ticket ID is required.');
      return;
    }
    try {
      const data = await getSupportTicket(ticketId);
      setTicket(data);
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load support ticket.'));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Optional 30-second polling while detail page is open
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTicket();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTicket]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      await sendSupportReply(ticketId, replyMessage.trim());
      setReplyMessage('');
      await fetchTicket();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to send reply.'));
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticketId || ticket?.status === newStatus) return;

    setUpdatingStatus(true);
    try {
      const updated = await updateSupportStatus(ticketId, newStatus);
      setTicket(updated);
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to update ticket status.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticketId || ticket?.priority === newPriority) return;

    setUpdatingPriority(true);
    try {
      const updated = await updateSupportPriority(ticketId, newPriority);
      setTicket(updated);
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to update ticket priority.'));
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleAssignment = async (assignedToId: string | null) => {
    if (!ticketId) return;

    setUpdatingAssignment(true);
    try {
      const updated = await assignSupportTicket(ticketId, assignedToId);
      setTicket(updated);
      setShowCustomAssign(false);
      setCustomAssignId('');
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to update assignment.'));
    } finally {
      setUpdatingAssignment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-card border border-border bg-surface-raised" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-6 text-center">
        <p className="font-semibold text-danger-fg">{error || 'Ticket not found'}</p>
        <Link to={backPath} className="mt-4 inline-block text-body font-semibold text-brand-text hover:text-brand-fg">
          &larr; Back to support tickets
        </Link>
      </div>
    );
  }

  const isClosed = ticket.status === 'Closed';
  const cardTitle = 'text-caption font-semibold uppercase tracking-wider text-fg-muted';

  return (
    <div className="space-y-6">
      <div>
        <Link to={backPath} className="inline-flex items-center text-caption font-semibold text-fg-muted hover:text-fg">
          &larr; Back to all tickets
        </Link>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{ticket.category}</Badge>
              <Badge tone={STATUS_TONES[ticket.status]}>{ticket.status}</Badge>
              <Badge tone={PRIORITY_TONES[ticket.priority]}>{ticket.priority} Priority</Badge>
            </div>
            <h1 className="mt-2 font-heading text-h2 text-fg">{ticket.subject}</h1>
          </div>

          <Button variant="secondary" size="sm" onClick={fetchTicket}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className={cardTitle}>Initial Issue Description</h3>
            <p className="mt-3 whitespace-pre-wrap text-body leading-relaxed text-fg">{ticket.description}</p>

            {ticket.packageName && (
              <div className="mt-4 rounded-input border border-border bg-surface-sunken p-3 text-caption text-fg-muted">
                <span className="font-semibold text-fg">Linked Booking:</span> {ticket.packageName} ({ticket.bookingId})
              </div>
            )}
          </Card>

          <Card>
            <h3 className={`mb-4 ${cardTitle}`}>Conversation Thread ({ticket.messages.length})</h3>

            {ticket.messages.length === 0 ? (
              <div className="py-8 text-center text-body text-fg-muted">No replies in this thread yet.</div>
            ) : (
              <div className="space-y-4">
                {ticket.messages.map((msg) => {
                  const isStaff = msg.isStaff;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 text-caption text-fg-muted">
                        <span className="font-semibold text-fg">
                          {isStaff ? `${msg.senderDisplayName} (Staff)` : msg.senderDisplayName}
                        </span>
                        <span>·</span>
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div
                        className={`mt-1.5 max-w-[85%] rounded-2xl px-4 py-3 text-body leading-relaxed shadow-soft ${
                          isStaff
                            ? 'rounded-tr-none bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950'
                            : 'rounded-tl-none border border-border bg-surface-sunken text-fg'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 border-t border-border pt-5">
              {isClosed ? (
                <div className="rounded-input border border-border bg-surface-sunken p-4 text-center text-body text-fg-muted">
                  This support ticket is closed. Reopen the ticket to send a reply.
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="space-y-3">
                  <Textarea
                    id="staff-reply"
                    label="Send Reply as Staff"
                    rows={4}
                    placeholder="Type your response to the traveler..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    disabled={sendingReply}
                    required
                  />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-caption text-fg-muted">
                      Replies automatically transition ticket to Waiting for Customer.
                    </span>
                    <Button type="submit" disabled={sendingReply || !replyMessage.trim()}>
                      {sendingReply ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className={cardTitle}>Ticket Status</h3>
            <div className="mt-3">
              <Select
                id="status-select"
                label="Change Status"
                value={ticket.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              >
                <option value="Open">Open</option>
                <option value="InProgress">In Progress</option>
                <option value="WaitingForCustomer">Waiting for Customer</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </Select>
            </div>

            {isClosed && (
              <div className="mt-3">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => handleStatusChange('InProgress')} disabled={updatingStatus}>
                  Reopen Ticket
                </Button>
              </div>
            )}

            {ticket.resolvedAt && (
              <div className="mt-3 border-t border-border pt-2 text-caption text-fg-muted">
                Resolved: {formatDateTime(ticket.resolvedAt)}
              </div>
            )}
            {ticket.closedAt && (
              <div className="mt-1 text-caption text-fg-muted">Closed: {formatDateTime(ticket.closedAt)}</div>
            )}
          </Card>

          <Card>
            <h3 className={cardTitle}>Priority</h3>
            <div className="mt-3">
              <Select
                id="priority-select"
                label="Change Priority"
                value={ticket.priority}
                disabled={updatingPriority}
                onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </Select>
            </div>
          </Card>

          <Card>
            <h3 className={cardTitle}>Staff Assignment</h3>
            <div className="mt-3">
              <div className="text-body font-semibold text-fg">{ticket.assignedToName || 'Unassigned'}</div>
              {ticket.assignedToId && <div className="text-caption text-fg-muted">ID: {ticket.assignedToId}</div>}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {user?.id && ticket.assignedToId !== user.id && (
                <Button size="sm" onClick={() => handleAssignment(user.id)} disabled={updatingAssignment}>
                  Assign to Me
                </Button>
              )}

              {ticket.assignedToId && (
                <Button variant="secondary" size="sm" onClick={() => handleAssignment(null)} disabled={updatingAssignment}>
                  Unassign
                </Button>
              )}

              {!showCustomAssign ? (
                <Button variant="ghost" size="sm" onClick={() => setShowCustomAssign(true)}>
                  Assign to specific Staff ID...
                </Button>
              ) : (
                <div className="mt-2 space-y-2 rounded-input border border-border bg-surface-sunken p-2.5">
                  <Input
                    id="custom-assign-id"
                    type="text"
                    label="Staff User GUID"
                    placeholder="Enter staff GUID..."
                    value={customAssignId}
                    onChange={(e) => setCustomAssignId(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAssignment(customAssignId.trim() || null)}
                      disabled={updatingAssignment || !customAssignId.trim()}
                    >
                      Assign
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowCustomAssign(false);
                        setCustomAssignId('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="text-caption">
            <h3 className="font-semibold uppercase tracking-wider text-fg-muted">Ticket Details</h3>
            <div className="mt-3 space-y-2 text-fg-muted">
              <div>
                <span className="font-semibold text-fg">Traveler:</span> {ticket.travelerDisplayName}
              </div>
              <div>
                <span className="font-semibold text-fg">Traveler ID:</span>{' '}
                <span className="font-mono">{ticket.travelerId}</span>
              </div>
              <div>
                <span className="font-semibold text-fg">Created:</span> {formatDateTime(ticket.createdAt)}
              </div>
              <div>
                <span className="font-semibold text-fg">Last Updated:</span> {formatDateTime(ticket.updatedAt)}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
