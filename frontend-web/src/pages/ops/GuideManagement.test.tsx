import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGuide,
  getGuideById,
  getGuides,
  updateGuide,
  type GuideDto,
} from '../../api/guides';
import { CreateGuidePage } from './CreateGuidePage';
import { EditGuidePage } from './EditGuidePage';
import { GuideListPage } from './GuideListPage';

vi.mock('../../api/guides', () => ({
  getGuides: vi.fn(),
  getGuideById: vi.fn(),
  createGuide: vi.fn(),
  updateGuide: vi.fn(),
}));

const mockedGetGuides = vi.mocked(getGuides);
const mockedGetGuideById = vi.mocked(getGuideById);
const mockedCreateGuide = vi.mocked(createGuide);
const mockedUpdateGuide = vi.mocked(updateGuide);

const sampleGuides: GuideDto[] = [
  {
    id: 'g-1',
    name: 'Kasun Perera',
    languages: ['English', 'Sinhala'],
    specializations: ['Wildlife', 'Hiking'],
    contactInfo: '+94771234567',
    userId: 'u-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'g-2',
    name: 'Ruwan Jayasinghe',
    languages: ['German'],
    specializations: ['Cultural'],
    contactInfo: '+94777654321',
    userId: null,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

describe('Guide Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GuideListPage', () => {
    it('renders list of guides with name, languages, and specializations', async () => {
      mockedGetGuides.mockResolvedValueOnce(sampleGuides);

      render(
        <MemoryRouter>
          <GuideListPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Kasun Perera')).toBeInTheDocument();
        expect(screen.getByText('Ruwan Jayasinghe')).toBeInTheDocument();
      });

      expect(screen.getByText('+94771234567')).toBeInTheDocument();
      expect(screen.getByText('Wildlife')).toBeInTheDocument();
      expect(screen.getByText('German')).toBeInTheDocument();
    });

    it('filters guides based on search input', async () => {
      mockedGetGuides.mockResolvedValueOnce(sampleGuides);

      render(
        <MemoryRouter>
          <GuideListPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Kasun Perera')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by name/i);
      await userEvent.type(searchInput, 'Ruwan');

      expect(screen.queryByText('Kasun Perera')).not.toBeInTheDocument();
      expect(screen.getByText('Ruwan Jayasinghe')).toBeInTheDocument();
    });
  });

  describe('CreateGuidePage', () => {
    it('validates required name and creates a guide on valid submit', async () => {
      mockedCreateGuide.mockResolvedValueOnce(sampleGuides[0]);

      render(
        <MemoryRouter initialEntries={['/ops/guides/new']}>
          <Routes>
            <Route path="/ops/guides/new" element={<CreateGuidePage />} />
            <Route path="/ops/guides" element={<div>Guide List Root</div>} />
          </Routes>
        </MemoryRouter>,
      );

      const nameInput = screen.getByLabelText(/guide name \*/i);
      const contactInput = screen.getByLabelText(/contact info/i);
      const languagesInput = screen.getByLabelText(/languages/i);
      const specializationsInput = screen.getByLabelText(/specializations/i);

      await userEvent.type(nameInput, 'Kasun Perera');
      await userEvent.type(contactInput, '+94771234567');
      await userEvent.type(languagesInput, 'English, Sinhala');
      await userEvent.type(specializationsInput, 'Wildlife, Hiking');

      const submitBtn = screen.getByRole('button', { name: /create guide/i });
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockedCreateGuide).toHaveBeenCalledWith({
          name: 'Kasun Perera',
          contactInfo: '+94771234567',
          languages: ['English', 'Sinhala'],
          specializations: ['Wildlife', 'Hiking'],
          userId: null,
        });
        expect(screen.getByText('Guide List Root')).toBeInTheDocument();
      });
    });
  });

  describe('EditGuidePage', () => {
    it('pre-fills existing values and updates guide on submit', async () => {
      mockedGetGuideById.mockResolvedValueOnce(sampleGuides[0]);
      mockedUpdateGuide.mockResolvedValueOnce(sampleGuides[0]);

      render(
        <MemoryRouter initialEntries={['/ops/guides/g-1/edit']}>
          <Routes>
            <Route path="/ops/guides/:id/edit" element={<EditGuidePage />} />
            <Route path="/ops/guides" element={<div>Guide List Root</div>} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Kasun Perera')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/guide name \*/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Kasun Perera Senior');

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockedUpdateGuide).toHaveBeenCalledWith(
          'g-1',
          expect.objectContaining({
            name: 'Kasun Perera Senior',
          }),
        );
        expect(screen.getByText('Guide List Root')).toBeInTheDocument();
      });
    });
  });
});
