import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { ApprovalItemDto, PricingEvidenceDto } from '../../../api/approvals';
import { formatDate } from '../../../utils/format';
import { Badge } from '../../ui';
import { formatMoney, parseBreakdown } from './approvalFormat';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card border border-border bg-surface p-4">
      <h4 className="mb-2 text-overline text-fg-muted">{title}</h4>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-body">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 text-danger" aria-hidden />
      )}
      <span>{children}</span>
      <span className="sr-only">{ok ? 'passed' : 'failed'}</span>
    </span>
  );
}

function Pricing({ pricing }: { pricing: PricingEvidenceDto }) {
  const breakdown = parseBreakdown(pricing.breakdown);
  const overBudget = pricing.totalCost > pricing.budgetCeiling;
  return (
    <>
      {breakdown ? (
        <table className="w-full text-body">
          <caption className="sr-only">Pricing breakdown</caption>
          <tbody>
            <tr><th scope="row" className="py-0.5 text-left font-normal text-fg-muted">Tier price</th><td className="text-right">{formatMoney(breakdown.tierBasePrice)}</td></tr>
            <tr><th scope="row" className="py-0.5 text-left font-normal text-fg-muted">Catering</th><td className="text-right">{formatMoney(breakdown.cateringCost)}</td></tr>
            <tr><th scope="row" className="py-0.5 text-left font-normal text-fg-muted">Add-ons</th><td className="text-right">{formatMoney(breakdown.addOnsCost)}</td></tr>
            <tr className="border-t border-border"><th scope="row" className="py-0.5 text-left font-normal text-fg-muted">Subtotal</th><td className="text-right">{formatMoney(breakdown.subtotal)}</td></tr>
            {breakdown.groupDiscount > 0 && (
              <tr>
                <th scope="row" className="py-0.5 text-left font-normal text-fg-muted">
                  Group discount{breakdown.discountDescription ? ` (${breakdown.discountDescription}, ${breakdown.discountPercentage}%)` : ''}
                </th>
                <td className="text-right">−{formatMoney(breakdown.groupDiscount)}</td>
              </tr>
            )}
            <tr className="border-t border-border font-semibold">
              <th scope="row" className="py-1 text-left">Total quotation</th>
              <td className="text-right">{formatMoney(breakdown.finalTotal)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="text-body text-fg">Total quotation {formatMoney(pricing.totalCost)}</p>
      )}
      <dl className="mt-2 border-t border-border pt-2">
        <Fact label="Traveler's total budget" value={formatMoney(pricing.totalBudget)} />
        <Fact label="Policy ceiling (budget + 15%)" value={formatMoney(pricing.budgetCeiling)} />
      </dl>
      {overBudget && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-body font-medium text-warning-fg">
          <AlertTriangle className="h-4 w-4" aria-hidden /> The quotation is above the policy ceiling.
        </p>
      )}
    </>
  );
}

/** The evidence the Operations Manager reviews before deciding (design doc 8.2 step 7). */
export function ApprovalEvidence({ item }: { item: ApprovalItemDto }) {
  const { evidence, booking, refund } = item;
  const { guide, vehicle, pricing, validation } = evidence;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {item.reasons.length > 0 && (
        <div className="md:col-span-2">
          <Section title="Why approval is needed">
            <ul className="list-disc space-y-1 pl-5 text-body text-fg">
              {item.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <Section title="Request">
        <dl>
          <Fact label="Traveler" value={booking.travelerName} />
          <Fact label="Package" value={booking.tourPackageName} />
          <Fact label="Tier" value={`${booking.classType}${booking.includesFood ? ', with food' : ''}${booking.requiresAc ? ', AC' : ''}`} />
          <Fact label="Dates" value={`${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}`} />
          <Fact label="Group size" value={booking.groupSize} />
          <Fact label="Budget per person" value={formatMoney(booking.budgetPerPerson)} />
          {booking.languagePreference && <Fact label="Language" value={booking.languagePreference} />}
        </dl>
        {booking.specialRequests && (
          <p className="mt-2 border-t border-border pt-2 text-body text-fg-muted">
            <span className="font-medium text-fg">Special requests (traveler's own words): </span>
            {booking.specialRequests}
          </p>
        )}
      </Section>

      {refund && (
        <Section title="Cancellation request">
          <dl>
            <Fact label="Tour starts in" value={`${refund.daysUntilStart} day(s)`} />
            <Fact label="Standard window" value={`${refund.windowDays} days`} />
            <Fact label="Booking was" value={refund.previousBookingStatus ?? 'unknown'} />
            <Fact label="Approved payments" value={formatMoney(refund.approvedPaymentTotal)} />
          </dl>
          <p className="mt-2 border-t border-border pt-2 text-body text-fg-muted">
            <span className="font-medium text-fg">Traveler's reason: </span>
            {refund.travelerReason ?? 'No reason given.'}
          </p>
          {refund.payments.length > 0 && (
            <table className="mt-2 w-full text-body">
              <caption className="sr-only">Payments on this booking</caption>
              <thead>
                <tr className="text-left text-caption text-fg-muted">
                  <th className="py-1 font-medium">Method</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {refund.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-0.5">{payment.method}</td>
                    <td className="py-0.5">{payment.status}</td>
                    <td className="py-0.5 text-right">{formatMoney(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {!refund && (
        <>
          <Section title="Guide match">
            {guide ? (
              <>
                <dl>
                  <Fact label="Guide" value={guide.name ?? 'No guide matched'} />
                  <Fact label="Match score" value={guide.matchScore.toFixed(2)} />
                </dl>
                <p className="mt-2 text-body text-fg-muted">{guide.reasoning}</p>
              </>
            ) : (
              <p className="text-body text-fg-muted">No guide match was recorded.</p>
            )}
          </Section>

          <Section title="Vehicle assignment">
            {vehicle ? (
              <>
                <dl>
                  <Fact label="Vehicle" value={vehicle.registrationNumber ? `${vehicle.registrationNumber}${vehicle.type ? ` (${vehicle.type})` : ''}` : 'No vehicle matched'} />
                  <Fact label="Capacity" value={vehicle.capacity ?? '—'} />
                  <Fact label="Seats" value={vehicle.seatConfiguration || '—'} />
                  <Fact label="Driver" value={vehicle.driverName ?? '—'} />
                </dl>
                <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-body">
                  <Check ok={vehicle.acMatch}>AC requirement matched</Check>
                  <Check ok={vehicle.seatConfigMatch}>Seat configuration matched</Check>
                  <Check ok={!vehicle.conflictCheck}>No scheduling conflict</Check>
                </div>
              </>
            ) : (
              <p className="text-body text-fg-muted">No vehicle check was recorded.</p>
            )}
          </Section>

          <Section title="Pricing">
            {pricing ? <Pricing pricing={pricing} /> : <p className="text-body text-fg-muted">No quotation was recorded.</p>}
          </Section>

          <Section title="Validation">
            {validation ? (
              <>
                <p className="mb-1 text-body">
                  Result: <Badge tone={validation.decision === 'Approved' ? 'success' : 'warning'}>{validation.decision}</Badge>
                </p>
                {validation.reasons.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-body text-fg">
                    {validation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-body text-fg-muted">No validation result was recorded.</p>
            )}
          </Section>
        </>
      )}

      {(evidence.summaryText || evidence.advisoryFlags.length > 0) && (
        <div className="md:col-span-2">
          <Section title="Agent summary">
            {evidence.summaryText && <p className="text-body text-fg">{evidence.summaryText}</p>}
            {evidence.advisoryFlags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {evidence.advisoryFlags.map((flag) => (
                  <li key={flag}>
                    <Badge tone="info">{flag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
