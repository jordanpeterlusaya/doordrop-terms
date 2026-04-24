import { getPersistedItem } from '@/lib/persistent-storage';
import { type CargoIcon } from '@/constants/cargo-theme';

const SAVED_PLACES_KEY = 'doordrop.savedPlaces';

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  icon: CargoIcon;
};

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  try {
    const storedValue = await getPersistedItem(SAVED_PLACES_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue) as SavedPlace[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}
