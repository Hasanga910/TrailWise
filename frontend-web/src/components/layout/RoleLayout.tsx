import { FleetLayout } from '../fleet/FleetLayout';
import { GuideLayout } from '../guides/GuideLayout';
import { OpsLayout } from '../ops/OpsLayout';
import { useAuth } from '../../auth/AuthContext';

/** Renders pages shared between roles inside the viewer's own portal shell. */
export function RoleLayout() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'OperationsManager':
    case 'Admin':
      return <OpsLayout />;
    case 'FleetCoordinator':
      return <FleetLayout />;
    default:
      return <GuideLayout />;
  }
}
