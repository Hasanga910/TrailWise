import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteMyGuideProfile,
  getMyGuideProfile,
  updateMyGuideProfile,
  type GuideProfileDto,
} from '../../api/guides';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { RequireRole } from '../../auth/RequireRole';
import type { CurrentUser } from '../../auth/types';
import { GuideProfilePage } from './GuideProfilePage';

vi.mock('../../api/guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/guides')>();
  return {
    ...actual,
    getMyGuideProfile: vi.fn(),
    updateMyGuideProfile: vi.fn(),
    deleteMyGuideProfile: vi.fn(),
  };
});

const mockedGetMyGuideProfile = vi.mocked(getMyGuideProfile);
const mockedUpdateMyGuideProfile = vi.mocked(updateMyGuideProfile);
const mockedDeleteMyGuideProfile = vi.mocked(deleteMyGuideProfile);

const sampleGuide: GuideProfileDto = {
  id: 'guide-123',
  userId: 'user-guide-1',
  name: 'Kasun Perera',
  email: 'kasun@example.com',
  contactInfo: '+94771234567',
  languages: ['English', 'Sinhala'],
  specializations: ['Wildlife', 'Cultural'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const tourGuideUser: CurrentUser = {
  id: 'user-guide-1',
  name: 'Kasun Perera',
  email: 'kasun@example.com',
  contactNumber: '+94771234567',
  role: 'TourGuide',
};

function renderPage(authOverrides: Partial<AuthContextValue> = {}) {
  const authValue: AuthContextValue = {
    user: tourGuideUser,
    status: 'authenticated',
    error: null,
    login: vi.fn().mockResolvedValue(true),
    register: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    updateUser: vi.fn(),
    ...authOverrides,
  };

  const renderResult = render(
    <MemoryRouter initialEntries={['/guides/profile']}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/guides/profile" element={<GuideProfilePage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return { ...renderResult, authValue };
}

describe('GuideProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMyGuideProfile.mockReset();
    mockedUpdateMyGuideProfile.mockReset();
    mockedDeleteMyGuideProfile.mockReset();
  });

  // 1. clicking language field opens searchable picker
  it('1. clicking language field opens searchable picker', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    expect(screen.queryByTestId('language-dropdown')).not.toBeInTheDocument();

    await user.click(searchInput);
    expect(screen.getByTestId('language-dropdown')).toBeInTheDocument();
  });

  // 2. empty search shows language list
  it('2. empty search shows language list', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.click(searchInput);

    const dropdown = screen.getByTestId('language-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Arabic/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /French/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /German/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Spanish/i })).toBeInTheDocument();
  });

  // 3. typing filters list
  it('3. typing filters list', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.type(searchInput, 'ger');

    expect(screen.getByRole('option', { name: /German/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /French/i })).not.toBeInTheDocument();
  });

  // 4. "sin" finds Sinhala
  it('4. "sin" finds Sinhala', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.type(searchInput, 'sin');

    expect(screen.getByRole('option', { name: /Sinhala/i })).toBeInTheDocument();
  });

  // 5. selecting Sinhala immediately adds chip
  it('5. selecting a language immediately adds chip', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue({
      ...sampleGuide,
      languages: ['English'],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.type(searchInput, 'sin');

    const sinhalaOption = screen.getByRole('option', { name: /Sinhala/i });
    await user.click(sinhalaOption);

    const chipsContainer = screen.getByTestId('language-chips');
    expect(chipsContainer).toHaveTextContent('Sinhala');
    expect(screen.getByRole('button', { name: 'Remove Sinhala' })).toBeInTheDocument();
    // Search input should be cleared
    expect(searchInput).toHaveValue('');
  });

  // 6. no Add button exists
  it('6. no separate Add button exists for languages', async () => {
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    // Ensure no button exists that adds languages
    expect(screen.queryByRole('button', { name: /Add Language/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Selected Language/i })).not.toBeInTheDocument();

    // Verify specialization Add button still exists
    expect(screen.getByRole('button', { name: 'Add Specialization Button' })).toBeInTheDocument();
  });

  // 7. selected language cannot duplicate
  it('7. selected language cannot duplicate', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide); // Already has English and Sinhala
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.type(searchInput, 'eng');

    const englishOption = screen.getByRole('option', { name: /English/i });
    expect(englishOption).toBeDisabled();

    await user.click(englishOption);

    // English chip should still appear exactly once
    const chipsContainer = screen.getByTestId('language-chips');
    const englishOccurrences = chipsContainer.textContent?.match(/English/g);
    expect(englishOccurrences?.length).toBe(1);
  });

  // 8. removing chip works
  it('8. removing chip works', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    const removeEnglishBtn = screen.getByRole('button', { name: 'Remove English' });
    await user.click(removeEnglishBtn);

    const chipsContainer = screen.getByTestId('language-chips');
    expect(chipsContainer).not.toHaveTextContent('English');
    expect(chipsContainer).toHaveTextContent('Sinhala');
  });

  // 9. no-match state shows correctly
  it('9. no-match state shows correctly', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.type(searchInput, 'xyznotalanguage');

    expect(screen.getByText('No languages found')).toBeInTheDocument();
  });

  // 10. save sends string[]
  it('10. save sends string[] array directly to updateMyGuideProfile', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    mockedUpdateMyGuideProfile.mockResolvedValue({
      ...sampleGuide,
      languages: ['Sinhala', 'German'],
      specializations: ['Wildlife', 'Hiking'],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    // Remove English chip
    await user.click(screen.getByRole('button', { name: 'Remove English' }));

    // Add German via searchable combobox
    const searchInput = screen.getByPlaceholderText('Search languages...');
    await user.type(searchInput, 'ger');
    await user.click(screen.getByRole('option', { name: /German/i }));

    // Add Hiking specialization
    const specInput = screen.getByTestId('specialization-input');
    await user.type(specInput, 'Hiking{enter}');

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockedUpdateMyGuideProfile).toHaveBeenCalledWith({
        name: 'Kasun Perera',
        email: 'kasun@example.com',
        contactInfo: '+94771234567',
        languages: ['Sinhala', 'German'],
        specializations: ['Wildlife', 'Cultural', 'Hiking'],
      });
    });

    expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument();
  });

  // Additional flow tests
  it('specialization input adds tag and blocks duplicates', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Wildlife')).toBeInTheDocument();
    });

    const specInput = screen.getByTestId('specialization-input');
    await user.type(specInput, 'wildlife{enter}');

    expect(screen.getByText('"wildlife" is already added.')).toBeInTheDocument();
  });

  it('displays duplicate email error when backend returns 409', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);

    const conflictError = new axios.AxiosError(
      'Request failed with status code 409',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          detail: 'A user with this email address already exists.',
        },
      },
    );
    mockedUpdateMyGuideProfile.mockRejectedValue(conflictError);

    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('kasun@example.com')).toBeInTheDocument();
    });

    const emailInput = screen.getByDisplayValue('kasun@example.com');
    await user.clear(emailInput);
    await user.type(emailInput, 'taken@example.com');

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText('A user with this email address already exists.'),
      ).toBeInTheDocument();
    });
  });

  it('delete confirmation appears and handles 409 conflict when active tours exist', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);

    const conflictError = new axios.AxiosError(
      'Request failed with status code 409',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          detail: 'Guide profile cannot be deleted while assigned tours exist.',
        },
      },
    );
    mockedDeleteMyGuideProfile.mockRejectedValue(conflictError);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Profile' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete Profile' }));
    expect(screen.getByText('Delete Profile Confirmation')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete' });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Guide profile cannot be deleted while assigned tours exist.'),
      ).toBeInTheDocument();
    });
  });

  it('successful deletion logs user out and navigates to /login', async () => {
    const user = userEvent.setup();
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    mockedDeleteMyGuideProfile.mockResolvedValue();

    const { authValue } = renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Profile' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete Profile' }));
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete' });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockedDeleteMyGuideProfile).toHaveBeenCalled();
      expect(authValue.logout).toHaveBeenCalled();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('profile nav links are visible for TourGuide', async () => {
    mockedGetMyGuideProfile.mockResolvedValue(sampleGuide);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/guides/profile',
    );
    expect(screen.getByRole('link', { name: 'My Tours' })).toHaveAttribute(
      'href',
      '/guides/my-tours',
    );
    expect(screen.getByRole('link', { name: 'Guide Availability' })).toHaveAttribute(
      'href',
      '/guides/availability',
    );
  });

  it('profile route blocked for Traveler', () => {
    const travelerUser: CurrentUser = {
      id: 'traveler-1',
      name: 'Traveler Jane',
      email: 'jane@example.com',
      contactNumber: '+94779999999',
      role: 'Traveler',
    };

    const authValue: AuthContextValue = {
      user: travelerUser,
      status: 'authenticated',
      error: null,
      login: vi.fn().mockResolvedValue(true),
      register: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      updateUser: vi.fn(),
    };

    render(
      <MemoryRouter initialEntries={['/guides/profile']}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route
              path="/guides/profile"
              element={
                <RequireRole allowedRoles={['TourGuide']}>
                  <GuideProfilePage />
                </RequireRole>
              }
            />
            <Route path="/traveler" element={<div>Traveler Home Dashboard</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Traveler Home Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Tour Guide Profile & Settings')).not.toBeInTheDocument();
  });
});
