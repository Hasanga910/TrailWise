import { ProfileSettings } from '../../components/profile/ProfileSettings';

export function DriverProfileSettingsPage() {
  return (
    <ProfileSettings
      roleLabel="Professional Driver"
      roleDisplay="inline"
      detailsHeading="Personal Details"
      detailsHint="Keep your driver name, email address, and emergency contact number up to date."
      nameLabel="Full Name"
      emailLabel="Email Address"
      contactLabel="Contact / Mobile Number"
      saveLabel="Save Profile"
      profileSuccess="Profile updated successfully."
      passwordHeading="Change Password"
      passwordHint="Update your account password with at least 6 characters."
      currentPasswordLabel="Current Password"
      newPasswordLabel="New Password"
      confirmPasswordLabel="Confirm New Password"
      minPasswordLength={6}
      changePasswordLabel="Update Password"
      changingPasswordLabel="Updating..."
      passwordSuccess="Password changed successfully."
      danger={{
        description:
          'Deleting your driver account will permanently remove your login credentials and unlink your vehicle roster profile.',
        buttonLabel: 'Delete Driver Account',
        modalTitle: 'Delete Account Confirmation',
        modalBody:
          'Are you sure you want to delete your driver account? You will immediately be signed out and will lose access to the Driver Portal.',
        confirmLabel: 'Yes, Delete My Account',
        failureMessage: 'Could not delete account.',
      }}
    />
  );
}
