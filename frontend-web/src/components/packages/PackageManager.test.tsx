import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addTier,
  createPackage,
  deletePackage,
  getPackages,
  updatePackage,
  uploadPackagePhoto,
  type TourPackage,
} from '../../api/packages';
import { searchLocations } from '../../api/locations';
import { PackageManager } from './PackageManager';

vi.mock('../../api/packages', () => ({
  getPackages: vi.fn(),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  addTier: vi.fn(),
  uploadPackagePhoto: vi.fn(),
}));

vi.mock('../../api/locations', () => ({
  searchLocations: vi.fn(),
}));

const mockedGetPackages = vi.mocked(getPackages);
const mockedCreatePackage = vi.mocked(createPackage);
const mockedUpdatePackage = vi.mocked(updatePackage);
const mockedDeletePackage = vi.mocked(deletePackage);
const mockedAddTier = vi.mocked(addTier);
const mockedUploadPackagePhoto = vi.mocked(uploadPackagePhoto);
const mockedSearchLocations = vi.mocked(searchLocations);

function samplePackage(overrides: Partial<TourPackage> = {}): TourPackage {
  return {
    id: 'pkg-1',
    name: 'Cultural Triangle Explorer',
    theme: 'Cultural',
    durationDays: 4,
    basePricePerPerson: 250,
    maxGroupSize: 12,
    photoUrl: null,
    tiers: [
      { id: 'tier-1', classType: 'Normal', includesFood: false, basePricePerPerson: 250, requiresAC: false },
    ],
    locations: [{ id: 'loc-1', name: 'Sigiriya' }],
    ...overrides,
  };
}

function renderManager() {
  render(<PackageManager />);
}

function apiError(title: string) {
  return { isAxiosError: true, response: { data: { title } } };
}

describe('PackageManager', () => {
  beforeEach(() => {
    mockedGetPackages.mockReset();
    mockedCreatePackage.mockReset();
    mockedUpdatePackage.mockReset();
    mockedDeletePackage.mockReset();
    mockedAddTier.mockReset();
    mockedUploadPackagePhoto.mockReset();
    mockedSearchLocations.mockReset();
    mockedSearchLocations.mockResolvedValue([]);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') });
  });

  describe('load/list states', () => {
    it('renders loading then the package name, tier price, and location pill', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      renderManager();

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      expect(await screen.findByText('Cultural Triangle Explorer')).toBeInTheDocument();
      expect(screen.getByText('$250.00')).toBeInTheDocument();
      expect(screen.getByText('Sigiriya')).toBeInTheDocument();
    });

    it('renders an empty state when there are no packages', async () => {
      mockedGetPackages.mockResolvedValue([]);
      renderManager();

      expect(await screen.findByText('No tour packages yet.')).toBeInTheDocument();
    });

    it('renders an error banner when loading fails', async () => {
      mockedGetPackages.mockRejectedValue(apiError('Could not load packages.'));
      renderManager();

      expect(await screen.findByText('Could not load packages.')).toBeInTheDocument();
    });
  });

  describe('create', () => {
    async function fillRequiredCreateFields(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Name'), 'New Package');
      await user.type(screen.getByLabelText('Theme'), 'Adventure');
      await user.clear(screen.getByLabelText('Duration (days)'));
      await user.type(screen.getByLabelText('Duration (days)'), '5');
      await user.clear(screen.getByLabelText('Max group size'));
      await user.type(screen.getByLabelText('Max group size'), '10');
      await user.clear(screen.getByLabelText('Base price per person'));
      await user.type(screen.getByLabelText('Base price per person'), '199');
      // The default tier's price input starts at 0, which is required + min=0.01 — an
      // invalid value that silently blocks native form submission if left unfilled.
      await user.clear(screen.getByPlaceholderText('Price'));
      await user.type(screen.getByPlaceholderText('Price'), '120');
    }

    it('submits with a tier and a location, and resets the form on success', async () => {
      mockedGetPackages.mockResolvedValue([]);
      mockedCreatePackage.mockResolvedValue(samplePackage({ id: 'new-pkg' }));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('No tour packages yet.');

      await fillRequiredCreateFields(user);

      await user.type(screen.getByPlaceholderText('Search for a location...'), 'Galle');
      const addAsTypedButton = await screen.findByRole('button', { name: /add "galle" as typed/i });
      await user.click(addAsTypedButton);

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

      expect(await screen.findByLabelText('Name')).toHaveValue('');
    });

    it('uploads a selected photo after successful creation', async () => {
      mockedGetPackages.mockResolvedValue([]);
      mockedCreatePackage.mockResolvedValue(samplePackage({ id: 'new-pkg' }));
      mockedUploadPackagePhoto.mockResolvedValue(samplePackage({ id: 'new-pkg' }));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('No tour packages yet.');

      await fillRequiredCreateFields(user);
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText('Photo'), file);

      await user.click(screen.getByRole('button', { name: /create package/i }));

      expect(await screen.findByLabelText('Name')).toHaveValue('');
      expect(mockedUploadPackagePhoto).toHaveBeenCalledWith('new-pkg', file);
    });

    it('shows a warning (not an error) when the post-create photo upload fails', async () => {
      mockedGetPackages.mockResolvedValue([]);
      mockedCreatePackage.mockResolvedValue(samplePackage({ id: 'new-pkg' }));
      mockedUploadPackagePhoto.mockRejectedValue(apiError('Photo too large.'));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('No tour packages yet.');

      await fillRequiredCreateFields(user);
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText('Photo'), file);

      await user.click(screen.getByRole('button', { name: /create package/i }));

      expect(await screen.findByText('Photo too large.')).toBeInTheDocument();
      // The package itself is still treated as created: the form still resets.
      expect(screen.getByLabelText('Name')).toHaveValue('');
    });

    it('shows an error and does not reset the form when createPackage fails', async () => {
      mockedGetPackages.mockResolvedValue([]);
      mockedCreatePackage.mockRejectedValue(apiError('A package with this name already exists.'));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('No tour packages yet.');

      await fillRequiredCreateFields(user);
      await user.click(screen.getByRole('button', { name: /create package/i }));

      expect(await screen.findByText('A package with this name already exists.')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toHaveValue('New Package');
    });

    it('adds and removes tier rows without calling the API', async () => {
      mockedGetPackages.mockResolvedValue([]);
      const user = userEvent.setup();
      renderManager();
      await screen.findByText('No tour packages yet.');

      expect(screen.getAllByLabelText('Class type')).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: /\+ add tier/i }));
      expect(screen.getAllByLabelText('Class type')).toHaveLength(2);

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]);
      expect(screen.getAllByLabelText('Class type')).toHaveLength(1);

      expect(mockedCreatePackage).not.toHaveBeenCalled();
    });
  });

  describe('edit', () => {
    it('pre-fills the inline form, saves via updatePackage, and exits edit mode', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUpdatePackage.mockResolvedValue(samplePackage({ name: 'Updated Name' }));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      await user.click(screen.getByRole('button', { name: /^edit$/i }));

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      const editForm = saveButton.closest('form')!;

      expect(within(editForm).getByLabelText('Name')).toHaveValue('Cultural Triangle Explorer');

      await user.clear(within(editForm).getByLabelText('Name'));
      await user.type(within(editForm).getByLabelText('Name'), 'Updated Name');
      await user.click(saveButton);

      expect(mockedUpdatePackage).toHaveBeenCalledWith(
        'pkg-1',
        expect.objectContaining({ name: 'Updated Name' }),
      );

      expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });

    it('cancels edit mode without calling updatePackage', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      await user.click(screen.getByRole('button', { name: /^edit$/i }));
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      expect(mockedUpdatePackage).not.toHaveBeenCalled();
    });

    it('shows an error and stays in edit mode when updatePackage fails', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUpdatePackage.mockRejectedValue(apiError('Could not update package.'));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      await user.click(screen.getByRole('button', { name: /^edit$/i }));
      await user.click(screen.getByRole('button', { name: /^save$/i }));

      expect(await screen.findByText('Could not update package.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('calls deletePackage and refreshes the list', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedDeletePackage.mockResolvedValue(undefined);

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      mockedGetPackages.mockResolvedValue([]);
      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(mockedDeletePackage).toHaveBeenCalledWith('pkg-1');
      expect(await screen.findByText('No tour packages yet.')).toBeInTheDocument();
    });

    it('shows a list-level error banner when deletePackage fails', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedDeletePackage.mockRejectedValue(apiError('This package has existing bookings.'));

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(await screen.findByText('This package has existing bookings.')).toBeInTheDocument();
    });
  });

  describe('add tier to existing package', () => {
    it('calls addTier with the package id and payload', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedAddTier.mockResolvedValue(samplePackage());

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      const priceInputs = screen.getAllByPlaceholderText('Price');
      const miniFormPrice = priceInputs[priceInputs.length - 1];
      await user.clear(miniFormPrice);
      await user.type(miniFormPrice, '75');

      const addTierButtons = screen.getAllByRole('button', { name: /\+ add tier/i });
      await user.click(addTierButtons[addTierButtons.length - 1]);

      expect(mockedAddTier).toHaveBeenCalledWith('pkg-1', {
        classType: 'Normal',
        includesFood: false,
        basePricePerPerson: 75,
        requiresAC: false,
      });
    });

    it('shows an error scoped to that package when addTier fails', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedAddTier.mockRejectedValue(apiError('Could not add tier.'));

      const user = userEvent.setup();
      renderManager();
      const article = (await screen.findByText('Cultural Triangle Explorer')).closest('article')!;

      const addTierButton = within(article).getByRole('button', { name: /\+ add tier/i });
      await user.click(addTierButton);

      expect(await within(article).findByText('Could not add tier.')).toBeInTheDocument();
    });
  });

  describe('photo upload for existing package', () => {
    it('calls uploadPackagePhoto for that package', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUploadPackagePhoto.mockResolvedValue(samplePackage());

      const user = userEvent.setup();
      renderManager();
      await screen.findByText('Cultural Triangle Explorer');

      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/upload photo/i), file);

      expect(mockedUploadPackagePhoto).toHaveBeenCalledWith('pkg-1', file);
    });

    it('shows an error scoped to that package when uploadPackagePhoto fails', async () => {
      mockedGetPackages.mockResolvedValue([samplePackage()]);
      mockedUploadPackagePhoto.mockRejectedValue(apiError('Photo must be 5MB or smaller.'));

      const user = userEvent.setup();
      renderManager();
      const article = (await screen.findByText('Cultural Triangle Explorer')).closest('article')!;

      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(within(article).getByLabelText(/upload photo/i), file);

      expect(await within(article).findByText('Photo must be 5MB or smaller.')).toBeInTheDocument();
    });
  });
});
