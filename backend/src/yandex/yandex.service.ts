import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SUGGEST_URL = 'https://suggest-maps.yandex.ru/v1/suggest';
const GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';

export interface SuggestResultItem {
  title: string;
  subtitle?: string;
  address?: string;
  uri?: string;
}

export interface GeocodeResult {
  fullAddress: string;
  coordinates: { lat: number; lng: number };
}

@Injectable()
export class YandexService {
  private readonly suggestKey: string;
  private readonly geocodeKey: string;

  constructor(private readonly config: ConfigService) {
    this.suggestKey =
      this.config.get<string>('YA_SUGGEST_KEY') ||
      this.config.get<string>('YANDEX_SUGGEST_API_KEY') ||
      this.config.get<string>('YANDEX_MAPS_API_KEY') ||
      '';
    this.geocodeKey =
      this.config.get<string>('YA_GEOCODER_KEY') ||
      this.config.get<string>('YANDEX_MAPS_API_KEY') ||
      '';
  }

  async suggest(
    text: string,
    limit = 7,
    bbox?: string,
  ): Promise<{ results: SuggestResultItem[] }> {
    if (!this.suggestKey || !text?.trim()) {
      return { results: [] };
    }
    const params = new URLSearchParams({
      apikey: this.suggestKey,
      text: text.trim(),
      lang: 'ru',
      results: String(Math.min(limit, 10)),
      types: 'geo',
      print_address: '1',
    });
    if (bbox) params.set('bbox', bbox);
    const url = `${SUGGEST_URL}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Yandex suggest]', res.status, errText);
        return { results: [] };
      }
      const data = (await res.json()) as {
        results?: Array<{
          title?: { text?: string };
          subtitle?: { text?: string };
          address?: { formatted_address?: string };
          uri?: string;
        }>;
      };
      const results: SuggestResultItem[] = (data.results || []).map((r) => ({
        title: r.title?.text ?? r.address?.formatted_address ?? '',
        subtitle: r.subtitle?.text,
        address: r.address?.formatted_address ?? r.title?.text ?? '',
        uri: r.uri,
      }));
      return { results };
    } catch (err) {
      console.warn('[Yandex suggest]', (err as Error).message);
      return { results: [] };
    }
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!this.geocodeKey || !address?.trim()) return null;
    const params = new URLSearchParams({
      apikey: this.geocodeKey,
      geocode: address.trim(),
      lang: 'ru_RU',
      format: 'json',
    });
    const url = `${GEOCODER_URL}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Yandex geocode]', res.status, errText);
        return null;
      }
      const data = (await res.json()) as {
        response?: {
          GeoObjectCollection?: {
            featureMember?: Array<{
              GeoObject?: {
                metaDataProperty?: {
                  GeocoderMetaData?: { text?: string };
                };
                Point?: { pos?: string };
              };
            }>;
          };
        };
      };
      const member = data.response?.GeoObjectCollection?.featureMember?.[0];
      const geo = member?.GeoObject;
      if (!geo?.Point?.pos) return null;
      const [lng, lat] = geo.Point.pos.split(/\s+/).map(Number);
      const fullAddress =
        geo.metaDataProperty?.GeocoderMetaData?.text ?? address.trim();
      return {
        fullAddress,
        coordinates: { lat, lng },
      };
    } catch (err) {
      console.warn('[Yandex geocode]', (err as Error).message);
      return null;
    }
  }
}
