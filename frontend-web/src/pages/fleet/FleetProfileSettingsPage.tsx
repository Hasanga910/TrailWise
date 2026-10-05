import { ProfileSettings } from '../../components/profile/ProfileSettings';

export function FleetProfileSettingsPage() {
  return (
    <ProfileSettings
      roleLabel="Fleet Coordinator"
      roleDisplay="inline"
      showRoleField
      detailsHeading="Personal details"
      mismatchMessage="New passwords do not match."
      danger={{
        description: 'Permanently delete your Fleet Coordinator staff account and revoke all access.',
        buttonLabel: 'Delete Account',
        modalTitle: 'Delete Account',
        modalBody:
          'Are you sure you want to delete your account? This action is permanent and cannot be undone. You will be logged out immediately.',
        confirmLabel: 'Yes, Delete My Account',
        failureMessage: 'Failed to delete account.',
      }}
    />
  );
}
