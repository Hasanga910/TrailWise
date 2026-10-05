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
import { notify } from '../../components/ui/notify';

const STATUS_BADGES: Record<TicketStatus, string> = {
  Open: 'bg-info-soft text-info-fg border-info/30',
  InProgress: 'bg-info-soft text-info-fg border-info/30',
  WaitingForCustomer: 'bg-warning-soft text-warning-fg border-warning/30',
  Resolved: 'bg-success-soft text-success-fg border-success/30',
  Closed: 'bg-neutral-soft text-fg-muted border-border',
};

const PRIORITY_BADGES: Record<TicketPriority, string> = {
  Low: 'bg-neutral-soft text-fg-muted',
  Normal: 'bg-info-soft text-info-fg',
  High: 'bg-warning-soft text-warning-fg',
  Urgent: 'bg-danger-soft text-danger-fg font-semibold',
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
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-soft" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface-raised" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-6 text-center">
        <p className="font-semibold text-danger-fg">{error || 'Ticket not found'}</p>
        <Link
          to={backPath}
          className="mt-4 inline-block text-sm font-semibold text-brand-text hover:text-brand-fg"
        >
          &larr; Back to support tickets
        </Link>
      </div>
    );
  }

  const isClosed = ticket.status === 'Closed';

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header */}
      <div>
        <Link
          to={backPath}
          className="inline-flex items-center text-xs font-semibold text-fg-muted hover:text-fg"
        >
          &larr; Back to all tickets
        </Link>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-neutral-soft px-2 py-0.5 text-xs font-medium text-fg">
                {ticket.category}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  STATUS_BADGES[ticket.status]
                }`}
              >
                {ticket.status}
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                  PRIORITY_BADGES[ticket.priority]
                }`}
              >
                {ticket.priority} Priority
              </span>
            </div>
            <h1 className="mt-2 font-heading text-2xl font-bold text-fg">{ticket.subject}</h1>
          </div>

          <button
            onClick={fetchTicket}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-fg shadow-sm transition hover:bg-surface-sunken"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Details & Conversation */}
        <div className="space-y-6 lg:col-span-2">
          {/* Initial Ticket Details Card */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Initial Issue Description
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {ticket.description}
            </p>

            {ticket.packageName && (
              <div className="mt-4 rounded-lg border border-border bg-surface-sunken p-3 text-xs text-fg-muted">
                <span className="font-semibold text-fg">Linked Booking:</span>{' '}
                {ticket.packageName} ({ticket.bookingId})
              </div>
            )}
          </div>

          {/* Messages Thread */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Conversation Thread ({ticket.messages.length})
            </h3>

            {ticket.messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-fg-muted">
                No replies in this thread yet.
              </div>
            ) : (
              <div className="space-y-4">
                {ticket.messages.map((msg) => {
                  const isStaff = msg.isStaff;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isStaff ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center space-x-2 text-xs text-fg-muted">
                        <span className="font-semibold text-fg">
                          {isStaff ? `${msg.senderDisplayName} (Staff)` : msg.senderDisplayName}
                        </span>
                        <span>·</span>
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div
                        className={`mt-1.5 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          isStaff
                            ? 'rounded-tr-none bg-brand-700 text-white'
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

            {/* Staff Reply Box */}
            <div className="mt-6 border-t border-border pt-5">
              {isClosed ? (
                <div className="rounded-lg border border-border bg-surface-sunken p-4 text-center text-sm text-fg-muted">
                  This support ticket is closed. Reopen the ticket to send a reply.
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="space-y-3">
                  <label htmlFor="staff-reply" className="block text-xs font-semibold text-fg">
                    Send Reply as Staff
                  </label>
                  <textarea
                    id="staff-reply"
                    rows={4}
                    placeholder="Type your response to the traveler..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    disabled={sendingReply}
                    className="block w-full rounded-lg border border-border p-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fg-muted">
                      Replies automatically transition ticket to Waiting for Customer.
                    </span>
                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50"
                    >
                      {sendingReply ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Management & Status Controls */}
        <div className="space-y-6">
          {/* Status Controls Card */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Ticket Status
            </h3>
            <div className="mt-3">
              <label htmlFor="status-select" className="text-xs text-fg-muted">
                Change Status
              </label>
              <select
                id="status-select"
                value={ticket.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm font-medium shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="Open">Open</option>
                <option value="InProgress">In Progress</option>
                <option value="WaitingForCustomer">Waiting for Customer</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {isClosed && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleStatusChange('InProgress')}
                  disabled={updatingStatus}
                  className="w-full rounded-lg border border-border bg-surface-raised py-1.5 text-xs font-semibold text-fg hover:bg-surface-sunken disabled:opacity-50"
                >
                  Reopen Ticket
                </button>
              </div>
            )}

            {ticket.resolvedAt && (
              <div className="mt-3 border-t border-border pt-2 text-xs text-fg-muted">
                Resolved: {formatDateTime(ticket.resolvedAt)}
              </div>
            )}
            {ticket.closedAt && (
              <div className="mt-1 text-xs text-fg-muted">
                Closed: {formatDateTime(ticket.closedAt)}
              </div>
            )}
          </div>

          {/* Priority Controls Card */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Priority
            </h3>
            <div className="mt-3">
              <label htmlFor="priority-select" className="text-xs text-fg-muted">
                Change Priority
              </label>
              <select
                id="priority-select"
                value={ticket.priority}
                disabled={updatingPriority}
                onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm font-medium shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Assignment Controls Card */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Staff Assignment
            </h3>
            <div className="mt-3">
              <div className="text-sm font-semibold text-fg">
                {ticket.assignedToName || 'Unassigned'}
              </div>
              {ticket.assignedToId && (
                <div className="text-xs text-fg-muted">ID: {ticket.assignedToId}</div>
              )}
            </div>

            <div className="mt-4 flex flex-col space-y-2">
              {user?.id && ticket.assignedToId !== user.id && (
                <button
                  type="button"
                  onClick={() => handleAssignment(user.id)}
                  disabled={updatingAssignment}
                  className="rounded-lg bg-fg py-1.5 text-xs font-semibold text-surface shadow-sm transition hover:bg-fg/90 disabled:opacity-50"
                >
                  Assign to Me
                </button>
              )}

              {ticket.assignedToId && (
                <button
                  type="button"
                  onClick={() => handleAssignment(null)}
                  disabled={updatingAssignment}
                  className="rounded-lg border border-border bg-surface-raised py-1.5 text-xs font-semibold text-fg shadow-sm transition hover:bg-surface-sunken disabled:opacity-50"
                >
                  Unassign
                </button>
              )}

              {!showCustomAssign ? (
                <button
                  type="button"
                  onClick={() => setShowCustomAssign(true)}
                  className="text-xs font-semibold text-brand-text hover:text-brand-fg"
                >
                  Assign to specific Staff ID...
                </button>
              ) : (
                <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-sunken p-2.5">
                  <label htmlFor="custom-assign-id" className="block text-xs font-semibold text-fg">
                    Staff User GUID
                  </label>
                  <input
                    id="custom-assign-id"
                    type="text"
                    placeholder="Enter staff GUID..."
                    value={customAssignId}
                    onChange={(e) => setCustomAssignId(e.target.value)}
                    className="w-full rounded border border-border px-2 py-1 text-xs"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handleAssignment(customAssignId.trim() || null)}
                      disabled={updatingAssignment || !customAssignId.trim()}
                      className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomAssign(false);
                        setCustomAssignId('');
                      }}
                      className="rounded border border-border bg-surface-raised px-2 py-1 text-xs font-semibold text-fg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Traveler & Audit Info Card */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 text-xs shadow-sm">
            <h3 className="font-semibold uppercase tracking-wider text-fg-muted">
              Ticket Details
            </h3>
            <div className="mt-3 space-y-2 text-fg-muted">
              <div>
                <span className="font-semibold text-fg">Traveler:</span>{' '}
                {ticket.travelerDisplayName}
              </div>
              <div>
                <span className="font-semibold text-fg">Traveler ID:</span>{' '}
                <span className="font-mono">{ticket.travelerId}</span>
              </div>
              <div>
                <span className="font-semibold text-fg">Created:</span>{' '}
                {formatDateTime(ticket.createdAt)}
              </div>
              <div>
                <span className="font-semibold text-fg">Last Updated:</span>{' '}
                {formatDateTime(ticket.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
