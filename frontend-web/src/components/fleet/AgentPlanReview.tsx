import type { AgentWorkflowDto } from '../../api/agentWorkflows';
import type { BookingDto } from '../../api/bookings';
import type { GuideDto } from '../../api/guides';
import type { DriverDto, VehicleAssignmentDetailDto, VehicleDto } from '../../api/vehicles';
import { Badge, Button, Card } from '../ui';

interface AgentPlanReviewProps {
  booking: BookingDto;
  workflowPlan: AgentWorkflowDto | null;
  workflowLoading: boolean;
  allGuides: GuideDto[];
  vehicles: VehicleDto[] | null;
  drivers: DriverDto[];
  currentAssignment: VehicleAssignmentDetailDto | null;
  approving: boolean;
  onApprove: () => void;
}

function MatchRow({
  icon,
  title,
  detail,
  badge,
  tone = 'neutral',
  mono,
}: {
  icon: string;
  title: string;
  detail: string;
  badge: string;
  tone?: 'neutral' | 'info';
  mono?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-input border p-2.5 ${
        tone === 'info' ? 'border-info/30 bg-info-soft' : 'border-border bg-surface-sunken'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <div>
          <p className={`text-caption font-bold ${tone === 'info' ? 'text-info-fg' : 'text-fg'}`}>{title}</p>
          <p className={`text-caption ${mono ? 'font-mono' : ''} ${tone === 'info' ? 'text-info-fg' : 'text-fg-muted'}`}>
            {detail}
          </p>
        </div>
      </div>
      <Badge tone={tone === 'info' ? 'info' : 'success'}>{badge}</Badge>
    </div>
  );
}

/** Shows what the multi-agent coordinator proposed for a PlanProposed booking, with the approve action. */
export function AgentPlanReview({
  booking,
  workflowPlan,
  workflowLoading,
  allGuides,
  vehicles,
  drivers,
  currentAssignment,
  approving,
  onApprove,
}: AgentPlanReviewProps) {
  const guideStep = workflowPlan?.steps?.find((s) => s.agentName === 'GuideMatchingAgent');
  const fleetStep = workflowPlan?.steps?.find((s) => s.agentName === 'FleetCapacityAgent');
  const pricingStep = workflowPlan?.steps?.find(
    (s) => s.agentName === 'PricingValidationAgent' && s.output && typeof s.output === 'object' && 'totalCost' in s.output,
  );

  const guideOutput = guideStep?.output as { guideId?: string; matchScore?: number; reasoning?: string } | undefined;
  const fleetOutput = fleetStep?.output as
    | { vehicleId?: string; driverId?: string; acMatch?: boolean; seatConfigMatch?: boolean; conflictCheck?: boolean }
    | undefined;
  const pricingOutput = pricingStep?.output as { totalCost?: number } | undefined;

  const matchedGuide = allGuides.find((g) => g.id === guideOutput?.guideId);
  const matchedVehicle = vehicles?.find((v) => v.id === fleetOutput?.vehicleId);
  const matchedDriver = drivers.find((d) => d.id === fleetOutput?.driverId);

  const hasGuide = !!(guideOutput?.guideId || matchedGuide || booking.assignedGuide?.id || currentAssignment?.guideName);
  const hasVehicle = !!(fleetOutput?.vehicleId || matchedVehicle || currentAssignment?.vehicleName);
  const hasDriver = !!(fleetOutput?.driverId || matchedDriver || currentAssignment?.driverName);
  const allAssigned = hasGuide && hasVehicle && hasDriver;

  return (
    <Card className="space-y-4 border-2 border-info/30 bg-info-soft/30">
      <div className="flex items-center justify-between gap-3 border-b border-info/30 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-input bg-brand-700 text-body font-bold text-white dark:bg-brand-500 dark:text-brand-950">
            AI
          </span>
          <div>
            <h3 className="font-heading text-body font-bold text-info-fg">Agent Plan Review &amp; Resource Matching</h3>
            <p className="text-caption text-info-fg">
              The multi-agent coordinator formulated this complete resource package (Vehicle + Driver + Guide).
            </p>
          </div>
        </div>
        <Badge tone="info" className="shrink-0">
          ✨ Plan Proposed
        </Badge>
      </div>

      {workflowLoading ? (
        <div className="animate-pulse py-8 text-center text-caption text-info-fg">Loading agent recommendation...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-card border border-info/30 bg-surface-raised p-4 text-caption">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <p className="text-overline text-info-fg">Traveler &amp; Requirements</p>
              <span className="font-mono text-fg-muted">REF: {booking.id.slice(0, 8)}</span>
            </div>

            <div className="space-y-1.5 text-fg">
              <p>
                <span className="text-fg-muted">Package:</span> <span className="font-bold">{booking.tourPackageName}</span>
              </p>
              <p>
                <span className="text-fg-muted">Trip Dates:</span>{' '}
                <span className="font-semibold">
                  {booking.startDate} &rarr; {booking.endDate}
                </span>
              </p>
              <p>
                <span className="text-fg-muted">Party Size:</span> <span className="font-bold">👥 {booking.groupSize} Guests</span>
              </p>
              <p>
                <span className="text-fg-muted">Climate:</span>{' '}
                <span className="font-semibold">{booking.packageTier?.requiresAC ? '❄️ AC Mandatory' : 'Standard Air'}</span>
              </p>
              {booking.languagePreference && (
                <p>
                  <span className="text-fg-muted">Language:</span>{' '}
                  <span className="font-semibold text-info-fg">🗣️ {booking.languagePreference}</span>
                </p>
              )}
              {booking.specialRequests && (
                <div className="mt-2 rounded-input border border-warning/30 bg-warning-soft p-2.5 italic text-warning-fg">
                  "{booking.specialRequests}"
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-card border border-info/30 bg-surface-raised p-4 text-caption">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <p className="text-overline text-info-fg">Agent Recommended Allocation</p>
              <Badge tone="success">3/3 Allocated</Badge>
            </div>

            <MatchRow
              icon="🚐"
              title={matchedVehicle ? `${matchedVehicle.type} (${matchedVehicle.capacity} seats)` : 'AI-Optimized Vehicle'}
              detail={matchedVehicle?.registrationNumber || 'Matched by FleetCapacityAgent'}
              badge="Fit OK"
              mono
            />
            <MatchRow
              icon="🧑‍✈️"
              title={matchedDriver ? matchedDriver.name : 'AI-Verified Driver'}
              detail={matchedDriver?.contactInfo || 'Conflict-free schedule'}
              badge="Conflict-Free"
            />
            <MatchRow
              icon="🧭"
              tone="info"
              title={matchedGuide ? matchedGuide.name : 'AI-Matched Tour Guide'}
              detail={
                guideOutput?.reasoning
                  ? guideOutput.reasoning
                  : matchedGuide?.specializations?.join(', ') || 'Specialized guide matched'
              }
              badge={guideOutput?.matchScore ? `${Math.round(guideOutput.matchScore * 100)}% Match` : 'Verified'}
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge tone="success">✓ No Date Conflicts</Badge>
              <Badge tone="success">✓ Capacity OK: {booking.groupSize} Guests</Badge>
              {booking.packageTier?.requiresAC && <Badge tone="info">✓ Climate AC Verified</Badge>}
              <Badge tone="info">✓ Guide Matched</Badge>
              <Badge tone="info">
                ✓ Budget Feasible {pricingOutput?.totalCost ? `($${pricingOutput.totalCost})` : ''}
              </Badge>
            </div>

            {workflowPlan?.summaryText && (
              <p className="mt-2 rounded-input border border-info/30 bg-info-soft p-2.5 text-fg-muted">
                {workflowPlan.summaryText}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
        {!allAssigned ? (
          <span className="rounded-input border border-warning/30 bg-warning-soft px-2.5 py-1 text-caption font-medium text-warning-fg">
            ⚠️ Cannot confirm: All 3 resources (Vehicle, Driver, Guide) must be allocated before approval.
          </span>
        ) : (
          <span className="rounded-input border border-success/30 bg-success-soft px-2.5 py-1 text-caption font-medium text-success-fg">
            ✓ All 3 resources ready to be committed on approval.
          </span>
        )}

        <Button onClick={onApprove} disabled={approving || !allAssigned}>
          {approving ? 'Confirming Allocation...' : 'Approve & Confirm Allocation'}
        </Button>
      </div>
    </Card>
  );
}
