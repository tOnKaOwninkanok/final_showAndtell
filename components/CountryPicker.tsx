"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { DEFAULT_COUNTRY, resolveCountry } from "@/lib/countries";
import { getDevicePosition, locationErrorMessage, lookupLocation } from "@/lib/location";
import styles from "./CountryPicker.module.css";

type Props = { country: string; countries: { code: string; name: string }[]; autoLocate: boolean };

export default function CountryPicker({ country, countries, autoLocate }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(country);
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(autoLocate);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const automaticAttempted = useRef(false);

  useEffect(() => () => request.current?.abort(), []);

  const changeCountry = useCallback((nextCountry: string, replace = false) => {
    setSelected(nextCountry);
    startTransition(() => {
      const url = `/?country=${encodeURIComponent(nextCountry)}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  }, [router, startTransition]);

  const detectLocation = useCallback(async (automatic = false) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setLocation("");
    setLocating(true);
    function fallBackToUS(message: string) {
      setError(`Showing United States. ${message}`);
      changeCountry(DEFAULT_COUNTRY, true);
    }
    try {
      if (!window.isSecureContext) {
        fallBackToUS("Location needs HTTPS or localhost. You can still choose a country manually.");
        return;
      }
      if (!navigator.geolocation) {
        fallBackToUS("This browser does not support location. Please choose a country manually.");
        return;
      }
      const position = await getDevicePosition(navigator.geolocation, controller.signal);
      const result = await lookupLocation(position.coords, controller.signal);
      if (controller.signal.aborted) return;
      setLocation([result.locality, result.countryName].filter(Boolean).join(", "));
      if (resolveCountry(result.countryCode) === result.countryCode) changeCountry(result.countryCode, automatic);
      else fallBackToUS("A holiday calendar is not available for this location. Please choose a country manually.");
    } catch (cause) {
      if (!controller.signal.aborted) fallBackToUS(locationErrorMessage(cause));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLocating(false);
      }
    }
  }, [changeCountry]);

  useEffect(() => {
    if (!autoLocate || automaticAttempted.current) return;
    let automaticRequest: AbortController | null = null;
    // Defer the request so React Strict Mode's initial setup/cleanup cycle
    // cannot open duplicate permission requests. Manual selection wins too.
    const timer = window.setTimeout(() => {
      if (automaticAttempted.current) return;
      automaticAttempted.current = true;
      void detectLocation(true);
      automaticRequest = request.current;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      automaticRequest?.abort();
    };
  }, [autoLocate, detectLocation]);

  function cancelLocation() {
    automaticAttempted.current = true;
    request.current?.abort();
    request.current = null;
    setLocating(false);
  }

  return <div className={styles.picker} aria-busy={pending || locating}>
    <label htmlFor="calendar-country">Holiday calendar</label>
    <div className={styles.controls}>
      <div className={styles.selectWrap}>
        <select id="calendar-country" value={pending ? selected : country} disabled={pending}
          onChange={(event) => { cancelLocation(); setError(""); changeCountry(event.target.value); }}>
          {countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </div>
      <button className={styles.locateButton} type="button" disabled={pending || locating}
        onClick={() => void detectLocation()} aria-describedby="location-help">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
        </svg>
        {locating ? "Finding location..." : "Use my location"}
      </button>
      {locating && <button type="button" className={styles.cancelButton}
        onClick={() => { cancelLocation(); setError(""); changeCountry(DEFAULT_COUNTRY, true); }}>Use US instead</button>}
    </div>
    <p id="location-help" className={styles.help}>We use your location to choose a calendar, or United States if location is unavailable. With your permission, your coordinates are sent to <a href="https://www.bigdatacloud.com/privacy-policy" target="_blank" rel="noreferrer">BigDataCloud</a> to find your city and country.</p>
    <p role="status" className={styles.status}>{locating ? "Allow location in your browser to continue. You can also choose a country manually."
      : pending ? "Updating your holiday calendar..."
        : location ? `Approximate location: ${location}` : ""}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
