import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApprovalDecision, ApprovalItemDto } from '../../../api/approvals';
import { zodResolver } from '../../../forms/zodResolver';
import { Button, Modal, Textarea } from '../../ui';
import { DECISION_LABELS, describeConsequence, noteRequired } from './approvalFormat';

const MAX_NOTE = 500;

function schemaFor(decision: ApprovalDecision) {
  return z.object({
    note: noteRequired(decision)
      ? z
          .string()
          .trim()
          .min(1, decision === 'Reject' ? 'Add a note explaining the rejection.' : 'Add a note telling the traveler what to change.')
          .max(MAX_NOTE, `Keep the note under ${MAX_NOTE} characters.`)
      : z.string().trim().max(MAX_NOTE, `Keep the note under ${MAX_NOTE} characters.`),
  });
}

type FormValues = { note: string };

export interface DecisionModalProps {
  item: ApprovalItemDto | null;
  decision: ApprovalDecision | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}

/** Confirms one decision. A note is required to reject or request a revision (design doc 8.3). */
export function DecisionModal({ item, decision, submitting, onCancel, onSubmit }: DecisionModalProps) {
  const open = item !== null && decision !== null;
  const resolverDecision: ApprovalDecision = decision ?? 'Approve';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schemaFor(resolverDecision)), defaultValues: { note: '' } });

  useEffect(() => {
    if (open) reset({ note: '' });
  }, [open, item?.id, decision, reset]);

  if (!open) return null;

  const required = noteRequired(decision);
  const label = DECISION_LABELS[decision];

  return (
    <Modal
      open
      onClose={submitting ? () => {} : onCancel}
      title={`${label}: ${item.booking.tourPackageName}`}
      description={`${item.booking.travelerName}, group of ${item.booking.groupSize}`}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="approval-decision-form"
            variant={decision === 'Reject' ? 'danger' : 'primary'}
            loading={submitting}
          >
            {label}
          </Button>
        </>
      }
    >
      <form id="approval-decision-form" onSubmit={handleSubmit((values) => onSubmit(values.note.trim()))} noValidate>
        <p className="mb-4 text-body text-fg-muted">{describeConsequence(item, decision)}</p>
        <Textarea
          label={required ? 'Note (required)' : 'Note (optional)'}
          hint={decision === 'RequestRevision' ? 'The traveler sees this note.' : undefined}
          rows={4}
          maxLength={MAX_NOTE + 50}
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Modal>
  );
}
