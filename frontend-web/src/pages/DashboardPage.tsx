import { useEffect, useState } from 'react';
import { apiClient, extractErrorMessage } from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';

interface PackageTier {
  id: string;
  classType: string;
  includesFood: boolean;
  basePricePerPerson: number;
  requiresAC: boolean;
}

interface TourPackage {
  id: string;
  name: string;
  theme: string;
  durationDays: number;
  basePricePerPerson: number;
  maxGroupSize: number;
  tiers: PackageTier[];
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TourPackage[]>('/api/packages')
      .then((response) => setPackages(response.data))
      .catch((err) => setError(extractErrorMessage(err, 'Could not load tour packages.')));
  }, []);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>TrailWise Operations Console</h1>
          <p>
            Signed in as <strong>{user?.name}</strong> ({user?.role})
          </p>
        </div>
        <button onClick={logout}>Log out</button>
      </header>

      <section>
        <h2>Tour Packages</h2>
        {error && <p className="form-error">{error}</p>}
        {!error && packages === null && <p>Loading packages...</p>}
        {!error && packages !== null && packages.length === 0 && <p>No tour packages yet.</p>}
        {packages && packages.length > 0 && (
          <ul className="package-list">
            {packages.map((pkg) => (
              <li key={pkg.id}>
                <strong>{pkg.name}</strong> — {pkg.theme}, {pkg.durationDays} days, from $
                {pkg.basePricePerPerson.toFixed(2)}/person
                <ul>
                  {pkg.tiers.map((tier) => (
                    <li key={tier.id}>
                      {tier.classType} — ${tier.basePricePerPerson.toFixed(2)}
                      {tier.includesFood ? ' (food included)' : ''}
                      {tier.requiresAC ? ' · requires AC vehicle' : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
