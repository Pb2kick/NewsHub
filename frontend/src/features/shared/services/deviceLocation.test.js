import { lookupGpsLocation, lookupIpLocation } from './deviceLocation';
import { reverseGeocode } from './locationApi';

jest.mock('./locationApi', () => ({
  ...jest.requireActual('./locationApi'),
  reverseGeocode: jest.fn(),
}));

const PALO = {
  area: 'Palo', region: 'Leyte', country: 'Philippines', countryCode: 'PH',
  label: 'Palo, Leyte, Philippines', latitude: 11.17, longitude: 125,
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockGeolocation(getCurrentPosition) {
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
}

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
  delete global.fetch;
});

describe('lookupGpsLocation', () => {
  test('gives up when the permission prompt is never answered', async () => {
    jest.useFakeTimers();
    mockGeolocation(() => {}); // the browser never calls back
    const result = lookupGpsLocation({ timeoutMs: 15000 });

    jest.advanceTimersByTime(15000);

    await expect(result).resolves.toBeNull();
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  test('reverse geocodes the position the browser returns', async () => {
    reverseGeocode.mockResolvedValue(PALO);
    mockGeolocation((success) => success({ coords: { latitude: 11.17, longitude: 125 } }));

    await expect(lookupGpsLocation()).resolves.toEqual(PALO);
    expect(reverseGeocode).toHaveBeenCalledWith({ latitude: 11.17, longitude: 125 });
  });

  test('resolves null when permission is denied', async () => {
    mockGeolocation((success, failure) => failure({ code: 1 }));

    await expect(lookupGpsLocation()).resolves.toBeNull();
  });
});

describe('lookupIpLocation', () => {
  test('uses the second service when ipapi.co is rate limited', async () => {
    reverseGeocode.mockResolvedValue(PALO);
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: true }))
      .mockResolvedValueOnce(jsonResponse(200, {
        city: 'Pawing', region: 'Eastern Visayas', country: 'Philippines',
        country_code: 'PH', latitude: '11.1700', longitude: '125.0000',
      }));

    await expect(lookupIpLocation()).resolves.toEqual(PALO);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://ipapi.co/json/', expect.anything());
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://get.geojs.io/v1/ip/geo.json', expect.anything());
    expect(reverseGeocode).toHaveBeenCalledWith(expect.objectContaining({ latitude: 11.17, longitude: 125 }));
  });

  test('keeps the IP service names when the backend cannot geocode', async () => {
    reverseGeocode.mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResponse(200, {
      city: 'Cebu City', region: 'Central Visayas', country_name: 'Philippines',
      country_code: 'PH', latitude: 10.3, longitude: 123.9,
    }));

    await expect(lookupIpLocation()).resolves.toEqual(expect.objectContaining({
      area: 'Cebu City', region: 'Central Visayas', country: 'Philippines', countryCode: 'PH',
    }));
  });

  test('resolves null when every service fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(lookupIpLocation()).resolves.toBeNull();
    expect(reverseGeocode).not.toHaveBeenCalled();
  });
});
