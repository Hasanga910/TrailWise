import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import { Badge, Button, Card, EmptyState, Skeleton, StatusBadge, type BadgeTone } from '../../components/ui';

const LIFECYCLE_TONES: Record<'Completed' | 'In Progress' | 'Not Started', BadgeTone> = {
  Completed: 'success',
  'In Progress': 'warning',
  'Not Started': 'neutral',
};

function getLifecycle(tour: AssignedTourDto): 'Completed' | 'In Progress' | 'Not Started' {
  if (tour.tourEndedAt || tour.completed) return 'Completed';
  if (tour.tourStartedAt) return 'In Progress';
  return 'Not Started';
}

export function AssignedToursPage() {
  
  const [tours, setTours] = useState<AssignedTourDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getMyAssignedTours()
      .then((data) => {
        setTours(data);
        setError(null);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load your assigned tours.')));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-danger-fg">
          <p className="text-body font-semibold">Error Loading Tours</p>
          <p className="mt-1 text-caption">{error}</p>
          <Button variant="danger" size="sm" className="mt-3" onClick={load}>
            Try Again
          </Button>
        </div>
      )}

      {!error && tours === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!error && tours !== null && tours.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState title="No tours assigned yet." />
        </Card>
      )}

      {!error && tours !== null && tours.length > 0 && (
        <div className="space-y-3">
          {tours.map((tour) => {
            const lifecycle = getLifecycle(tour);
            return (
              <Link key={tour.bookingId} to={`/guides/my-tours/${tour.bookingId}`} className="block rounded-card">
                <Card interactive className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-fg">
                      {tour.tourPackageName} — {tour.theme}
                    </p>
                    <p className="mt-0.5 text-body text-fg-muted">
                      {tour.startDate} to {tour.endDate} · {tour.groupSize} traveler{tour.groupSize === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tour.attended && <Badge tone="success" className="whitespace-nowrap">Attended</Badge>}
                    <Badge tone={LIFECYCLE_TONES[lifecycle]} className="whitespace-nowrap">
                      {lifecycle}
                    </Badge>
                    <StatusBadge status={tour.status} className="whitespace-nowrap" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
