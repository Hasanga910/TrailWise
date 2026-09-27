import { useState } from 'react';
import { TourItineraryPage } from '../guide/TourItineraryPage';

export function OpsItineraryPage() {
  const [inputBookingId, setInputBookingId] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (inputBookingId.trim()) {
      setSelectedBookingId(inputBookingId.trim());
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900">Itinerary Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Create, view, and update day-by-day itineraries for tour bookings.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <form onSubmit={handleLookup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="lookupBookingId" className="block text-xs font-semibold text-slate-700 mb-1">
              Booking ID (UUID)
            </label>
            <input
              id="lookupBookingId"
              type="text"
              placeholder="e.g. 11111111-1111-1111-1111-111111111111"
              value={inputBookingId}
              onChange={(e) => setInputBookingId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-xs"
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
          >
            Load Itinerary
          </button>
        </form>
      </div>

      {selectedBookingId ? (
        <TourItineraryPage
          bookingIdProp={selectedBookingId}
          backUrl="/ops/itineraries"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Enter a booking ID above to load and manage its itinerary.
        </div>
      )}
    </div>
  );
}
