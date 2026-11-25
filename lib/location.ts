export type DetectedLocation = { countryCode: string; countryName: string; locality: string };

function locationField(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
}

export function parseLocation(value: unknown): DetectedLocation {
  if (!value || typeof value !== "object") throw new Error("Location lookup returned an invalid response.");
  const data = value as Record<string, unknown>;
  const countryCode = locationField(data.countryCode).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Your country could not be identified. Please choose it manually.");
  return {
    countryCode,
    countryName: locationField(data.countryName) || countryCode,
    locality: locationField(data.city) || locationField(data.localityName)
      || locationField(data.locality) || locationField(data.principalSubdivision),
  };
}

export function locationErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === 1) return "Location access was denied. Allow location in your browser's site settings to try again, or choose a country manually.";
  if (code === 2) return "Your device could not find its location. Check location services or choose a country manually.";
  if (code === 3) return "Finding your location took too long. Try again or choose a country manually.";
  return "Unable to look up your location. Please try again or choose a country manually.";
}

export function getDevicePosition(geolocation: Pick<Geolocation, "getCurrentPosition">, signal: AbortSignal): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    geolocation.getCurrentPosition((position) => {
      signal.removeEventListener("abort", abort);
      if (!signal.aborted) resolve(position);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      if (!signal.aborted) reject(error);
    }, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 });
  });
}

// Called only from the browser after the user permits location, either during
// the automatic first-visit lookup or after clicking Use my location.
// The provider's free endpoint requires live device coordinates, not IP guesses
// after denial, cached locations, or server-side geocoding.
export async function lookupLocation(coords: Pick<GeolocationCoordinates, "latitude" | "longitude">, signal: AbortSignal): Promise<DetectedLocation> {
  if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)
    || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
    throw new Error("Invalid device coordinates.");
  }
  const query = new URLSearchParams({
    latitude: String(coords.latitude), longitude: String(coords.longitude), localityLanguage: "en",
  });
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("Location lookup is unavailable.");
  return parseLocation(await response.json());
}
