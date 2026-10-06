import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addTier,
  createPackage,
  deletePackage,
  deleteTier,
  getPackages,
  updatePackage,
  updateTier,
  uploadPackagePhoto,
  type TourPackage,
} from '../../api/packages';
import { searchLocations } from '../../api/locations';
import { notify } from '../ui/notify';
import { PackageManager } from './PackageManager';

vi.mock('../../api/packages', () => ({
  getPackages: vi.fn(),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  addTier: vi.fn(),
  updateTier: vi.fn(),
  deleteTier: vi.fn(),
  uploadPackagePhoto: vi.fn(),
}));

vi.mock('../../api/locations', () => ({ searchLocations: vi.fn() }));
vi.mock('../ui/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const mockedGetPackages = vi.mocked(getPackages);
const mockedCreatePackage = vi.mocked(createPackage);
const mockedUpdatePackage = vi.mocked(updatePackage);
const mockedDeletePackage = vi.mocked(deletePackage);
const mockedAddTier = vi.mocked(addTier);
const mockedUpdateTier = vi.mocked(updateTier);
const mockedDeleteTier = vi.mocked(deleteTier);
const mockedUploadPackagePhoto = vi.mocked(uploadPackagePhoto);
const mockedSearchLocations = vi.mocked(searchLocations);

const NORMAL = { id: 'tier-1', classType: 'Normal', includesFood: false, basePricePerPerson: 250, requiresAC: false } as const;
const FIRST = { id: 'tier-2', classType: 'First', includesFood: true, basePricePerPerson: 400, requiresAC: true } as const;

function samplePackage(overrides: Partial<TourPackage> = {}): TourPackage {
  return {
    id: 'pkg-1',
    name: 'Cultural Triangle Explorer',
    theme: 'Cultural',
    durationDays: 4,
    basePricePerPerson: 250,
    maxGroupSize: 12,
    photoUrl: null,
    tiers: [{ ...NORMAL }],
    locations: [{ id: 'loc-1', name: 'Sigiriya' }],
    ...overrides,
  };
}

function apiError(title: string) {
  return { isAxiosError: true, response: { data: { title } } };
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Cultural Triangle Explorer');
  await user.click(screen.getByRole('button', { name: /^edit$/i }));
  return screen.getByRole('dialog');
}

describe('PackageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSearchLocations.mockResolvedValue([]);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  });

  describe('catalogue', () => {
    it('shows a loading state, then each package with its tiers and locations', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage({ tiers: [{ ...FIRST }, { ...NORMAL }] })]);
      render(<PackageManager />);

      expect(screen.getByRole('status', { name: 'Loading packages' })).toBeInTheDocument();

      expect(await screen.findByText('Cultural Triangle Explorer')).toBeInTheDocument();
      const tiers = within(screen.getByRole('list', { name: 'Cultural Triangle Explorer tiers' })).getAllByRole('listitem');
      // cheapest class first
      expect(tiers[0]).toHaveTextContent('Normal');
      expect(tiers[0]).toHaveTextContent('$250.00');
      expect(tiers[1]).toHaveTextContent('First');
      expect(tiers[1]).toHaveTextContent('Food');
      expect(tiers[1]).toHaveTextContent('AC');
      expect(tiers[1]).toHaveTextContent('$400.00');
      expect(screen.getByText('Sigiriya')).toBeInTheDocument();
    });

    it('shows an empty state with a call to action', async () => {
      mockedGetPackages.mockResolvedValue([]);
      render(<PackageManager />);

      expect(await screen.findByText('No tour packages yet.')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'New package' })).toHaveLength(2);
    });

    it('shows a load error with a working retry', async () => {
      mockedGetPackages.mockRejectedValueOnce(apiError('Could not load packages.')).mockResolvedValueOnce([samplePackage()]);
      const user = userEvent.setup();
      render(<PackageManager />);

      expect(await screen.findByText('Could not load packages.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('Cultural Triangle Explorer')).toBeInTheDocument();
    });
  });

  describe('create', () => {
    async function openCreate(user: ReturnType<typeof userEvent.setup>) {
      mockedGetPackages.mockResolvedValue([]);
      render(<PackageManager />);
      await screen.findByText('No tour packages yet.');
      await user.click(screen.getAllByRole('button', { name: 'New package' })[0]);
      return screen.getByRole('dialog');
    }

    async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Name'), 'New Package');
      await user.type(screen.getByLabelText('Theme'), 'Adventure');
      await user.clear(screen.getByLabelText('Duration (days)'));
      await user.type(screen.getByLabelText('Duration (days)'), '5');
      await user.clear(screen.getByLabelText('Max group size'));
      await user.type(screen.getByLabelText('Max group size'), '10');
      await user.clear(screen.getByLabelText('Base price per person'));
      await user.type(screen.getByLabelText('Base price per person'), '199');
      await user.clear(screen.getByLabelText('Price per person'));
      await user.type(screen.getByLabelText('Price per person'), '120');
    }

    it('submits the package with a tier and a location, then closes and reloads', async () => {
      mockedCreatePackage.mockResolvedValue(samplePackage({ id: 'new-pkg' }));
      const user = userEvent.setup();
      await openCreate(user);
      await fillRequiredFields(user);

      await user.type(screen.getByPlaceholderText('Search for a location...'), 'Galle');
      await user.click(await screen.findByRole('button', { name: /add "galle" as typed/i }));
      mockedGetPackages.mockResolvedValue([samplePackage({ name: 'New Package' })]);
      await user.click(screen.getByRole('button', { name: /create package/i }));

      expect(mockedCreatePackage).toHaveBeenCalledWith({
        name: 'New Package',
        theme: 'Adventure',
        durationDays: 5,
        maxGroupSize: 10,
        basePricePerPerson: 199,
        locationNames: ['Galle'],
        tiers: [{ classType: 'Normal', includesFood: false, basePricePerPerson: 120, requiresAC: false }],
      });
      expect(await screen.findByText('New Package')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(notify.success).toHaveBeenCalledWith('Package created.', 'Cultural Triangle Explorer');
    });

    it('uploads a selected photo after the package is created', async () => {
      mockedCreatePackage.mockResolvedValue(samplePackage({ id: 'new-pkg' }));
      mockedUploadPackagePhoto.mockResolvedValue(samplePackage({ id: 'new-pkg' }));
      const user = userEvent.setup();
      await openCreate(user);
      await fillRequiredFields(user);
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText('Photo'), file);
      await user.click(screen.getByRole('button', { name: /create package/i }));

      await vi.waitFor(() => expect(mockedUploadPackagePhoto).toHaveBeenCalledWith('new-pkg', file));
    });

    it('warns (not errors) when the photo upload fails after creation, and still closes', async () => {
      mockedCreatePackage.mockResolvedValue(samplePackage({ id: 'new-pkg' }));
      mockedUploadPackagePhoto.mockRejectedValue(apiError('Photo too large.'));
      const user = userEvent.setup();
      await openCreate(user);
      await fillRequiredFields(user);
      await user.upload(screen.getByLabelText('Photo'), new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }));
      await user.click(screen.getByRole('button', { name: /create package/i }));

      await vi.waitFor(() => expect(notify.warning).toHaveBeenCalledWith('Photo too large.'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the form open and shows the error when creating fails', async () => {
      mockedCreatePackage.mockRejectedValue(apiError('A package with this name already exists.'));
      const user = userEvent.setup();
      await openCreate(user);
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /create package/i }));

      expect(await screen.findByText('A package with this name already exists.')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toHaveValue('New Package');
    });

    it('adds and removes draft tier rows without calling the API', async () => {
      const user = userEvent.setup();
      await openCreate(user);

      expect(screen.getAllByLabelText('Class type')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Add tier' }));
      expect(screen.getAllByLabelText('Class type')).toHaveLength(2);
      await user.click(screen.getByRole('button', { name: 'Remove tier 1' }));
      expect(screen.getAllByLabelText('Class type')).toHaveLength(1);
      expect(mockedCreatePackage).not.toHaveBeenCalled();
    });

    it('refuses two tiers with the same class and food option, but allows the same class with different food', async () => {
      mockedCreatePackage.mockResolvedValue(samplePackage());
      const user = userEvent.setup();
      await openCreate(user);
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: 'Add tier' }));
      const prices = screen.getAllByLabelText('Price per person');
      await user.clear(prices[1]);
      await user.type(prices[1], '140');

      await user.click(screen.getByRole('button', { name: /create package/i }));
      expect(await screen.findByText('Two tiers cannot share the same class and food option.')).toBeInTheDocument();
      expect(mockedCreatePackage).not.toHaveBeenCalled();

      await user.click(screen.getAllByLabelText('Food included')[1]);
      await user.click(screen.getByRole('button', { name: /create package/i }));
      await vi.waitFor(() => expect(mockedCreatePackage).toHaveBeenCalledTimes(1));
    });
  });

  describe('edit details', () => {
    it('pre-fills the form and saves through updatePackage', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUpdatePackage.mockResolvedValue(samplePackage({ name: 'Updated Name' }));
      const user = userEvent.setup();
      render(<PackageManager />);
      const dialog = within(await openEditor(user));

      const form = dialog.getByRole('form', { name: 'Package details' });
      expect(within(form).getByLabelText('Name')).toHaveValue('Cultural Triangle Explorer');
      await user.clear(within(form).getByLabelText('Name'));
      await user.type(within(form).getByLabelText('Name'), 'Updated Name');
      await user.click(within(form).getByRole('button', { name: 'Save details' }));

      expect(mockedUpdatePackage).toHaveBeenCalledWith('pkg-1', expect.objectContaining({ name: 'Updated Name' }));
      expect(await screen.findByText('Updated Name', { selector: 'h3' })).toBeInTheDocument();
      expect(notify.success).toHaveBeenCalledWith('Package details saved.');
    });

    it('flags locations that are not on the map and keeps existing coordinates when saving', async () => {
      mockedGetPackages.mockResolvedValue([
        samplePackage({
          locations: [
            { id: 'a', name: 'Sigiriya', latitude: 7.957, longitude: 80.76 },
            { id: 'b', name: 'Atlantis', latitude: null, longitude: null },
          ],
        }),
      ]);
      mockedUpdatePackage.mockResolvedValue(samplePackage());
      const user = userEvent.setup();
      render(<PackageManager />);
      const dialog = within(await openEditor(user));

      expect(dialog.getAllByText('Not on map')).toHaveLength(1);
      await user.click(dialog.getByRole('button', { name: 'Remove Atlantis' }));
      await user.click(dialog.getByRole('button', { name: 'Save details' }));

      expect(mockedUpdatePackage).toHaveBeenCalledWith(
        'pkg-1',
        expect.objectContaining({
          locationNames: ['Sigiriya'],
          locationCoordinates: [{ name: 'Sigiriya', latitude: 7.957, longitude: 80.76 }],
        }),
      );
    });

    it('closes without saving, and shows an error when saving fails', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUpdatePackage.mockRejectedValue(apiError('Could not update package.'));
      const user = userEvent.setup();
      render(<PackageManager />);
      const dialog = within(await openEditor(user));

      await user.click(dialog.getByRole('button', { name: 'Save details' }));
      expect(await dialog.findByText('Could not update package.')).toBeInTheDocument();

      await user.click(dialog.getByRole('button', { name: 'Close panel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('uploads a photo for the package and shows an error scoped to the editor when it fails', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUploadPackagePhoto.mockResolvedValueOnce(samplePackage({ photoUrl: '/uploads/p.jpg' })).mockRejectedValueOnce(apiError('Photo must be 5MB or smaller.'));
      const user = userEvent.setup();
      render(<PackageManager />);
      const dialog = within(await openEditor(user));

      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(dialog.getByLabelText('Upload photo'), file);
      expect(mockedUploadPackagePhoto).toHaveBeenCalledWith('pkg-1', file);

      await user.upload(await dialog.findByLabelText('Replace photo'), file);
      expect(await dialog.findByText('Photo must be 5MB or smaller.')).toBeInTheDocument();
    });
  });

  describe('tier configuration', () => {
    async function openTiers(user: ReturnType<typeof userEvent.setup>, pkg = samplePackage({ tiers: [{ ...NORMAL }, { ...FIRST }] })) {
      mockedGetPackages.mockResolvedValue([pkg]);
      render(<PackageManager />);
      const dialog = within(await openEditor(user));
      return within(dialog.getByRole('region', { name: 'Tiers' }));
    }

    it('adds a tier with the package id and payload', async () => {
      mockedAddTier.mockResolvedValue(samplePackage({ tiers: [{ ...NORMAL }, { id: 'tier-3', classType: 'Normal', includesFood: true, basePricePerPerson: 75, requiresAC: false }] }));
      const user = userEvent.setup();
      const tiers = await openTiers(user, samplePackage());

      await user.click(tiers.getByRole('button', { name: 'Add tier' }));
      const form = within(tiers.getByRole('form', { name: 'New tier' }));
      await user.clear(form.getByLabelText('Price per person'));
      await user.type(form.getByLabelText('Price per person'), '75');
      await user.click(form.getByLabelText('Food included'));
      await user.click(form.getByRole('button', { name: 'Add this tier' }));

      expect(mockedAddTier).toHaveBeenCalledWith('pkg-1', { classType: 'Normal', includesFood: true, basePricePerPerson: 75, requiresAC: false });
      expect(notify.success).toHaveBeenCalledWith('Tier added.');
      expect(tiers.queryByRole('form', { name: 'New tier' })).not.toBeInTheDocument();
    });

    it('shows the API conflict when a duplicate tier is added', async () => {
      mockedAddTier.mockRejectedValue(apiError('This package already has a Normal tier without food.'));
      const user = userEvent.setup();
      const tiers = await openTiers(user, samplePackage());

      await user.click(tiers.getByRole('button', { name: 'Add tier' }));
      const form = within(tiers.getByRole('form', { name: 'New tier' }));
      await user.clear(form.getByLabelText('Price per person'));
      await user.type(form.getByLabelText('Price per person'), '75');
      await user.click(form.getByRole('button', { name: 'Add this tier' }));

      expect(await tiers.findByText('This package already has a Normal tier without food.')).toBeInTheDocument();
    });

    it('edits a tier in place', async () => {
      mockedUpdateTier.mockResolvedValue(samplePackage({ tiers: [{ ...NORMAL, basePricePerPerson: 275 }, { ...FIRST }] }));
      const user = userEvent.setup();
      const tiers = await openTiers(user);

      await user.click(tiers.getByRole('button', { name: 'Edit Normal tier' }));
      const form = within(tiers.getByRole('form', { name: 'Edit Normal tier' }));
      expect(form.getByLabelText('Price per person')).toHaveValue(250);
      await user.clear(form.getByLabelText('Price per person'));
      await user.type(form.getByLabelText('Price per person'), '275');
      await user.click(form.getByRole('button', { name: 'Save tier' }));

      expect(mockedUpdateTier).toHaveBeenCalledWith('pkg-1', 'tier-1', { classType: 'Normal', includesFood: false, basePricePerPerson: 275, requiresAC: false });
      expect(await tiers.findByText('$275.00')).toBeInTheDocument();
    });

    it('asks for confirmation before deleting a tier', async () => {
      mockedDeleteTier.mockResolvedValue(samplePackage());
      const user = userEvent.setup();
      const tiers = await openTiers(user);

      await user.click(tiers.getByRole('button', { name: 'Delete First tier' }));
      expect(mockedDeleteTier).not.toHaveBeenCalled();
      await user.click(tiers.getByRole('button', { name: 'Confirm delete' }));

      expect(mockedDeleteTier).toHaveBeenCalledWith('pkg-1', 'tier-2');
      expect(await tiers.findByText('$250.00')).toBeInTheDocument();
      expect(tiers.queryByText('$400.00')).not.toBeInTheDocument();
    });

    it('shows why a tier could not be deleted', async () => {
      mockedDeleteTier.mockRejectedValue(apiError('This tier has existing bookings and cannot be deleted.'));
      const user = userEvent.setup();
      const tiers = await openTiers(user);

      await user.click(tiers.getByRole('button', { name: 'Delete First tier' }));
      await user.click(tiers.getByRole('button', { name: 'Confirm delete' }));

      expect(await tiers.findByText('This tier has existing bookings and cannot be deleted.')).toBeInTheDocument();
      expect(tiers.getByText('$400.00')).toBeInTheDocument();
    });
  });

  describe('delete package', () => {
    it('confirms, deletes and refreshes the list', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedDeletePackage.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<PackageManager />);
      await screen.findByText('Cultural Triangle Explorer');

      await user.click(screen.getByRole('button', { name: /^delete$/i }));
      expect(mockedDeletePackage).not.toHaveBeenCalled();
      mockedGetPackages.mockResolvedValue([]);
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete package' }));

      expect(mockedDeletePackage).toHaveBeenCalledWith('pkg-1');
      expect(await screen.findByText('No tour packages yet.')).toBeInTheDocument();
    });

    it('shows the reason inside the dialog when the package cannot be deleted', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedDeletePackage.mockRejectedValue(apiError('This package has existing bookings.'));
      const user = userEvent.setup();
      render(<PackageManager />);
      await screen.findByText('Cultural Triangle Explorer');

      await user.click(screen.getByRole('button', { name: /^delete$/i }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete package' }));

      expect(await within(screen.getByRole('dialog')).findByText('This package has existing bookings.')).toBeInTheDocument();
      expect(screen.getByText('Cultural Triangle Explorer')).toBeInTheDocument();
    });
  });
});
