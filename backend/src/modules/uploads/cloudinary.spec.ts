import { belongsTo, imageUrl, signParams } from './cloudinary';

describe('Cloudinary signed uploads', () => {
  it('signs parameters the way Cloudinary documents it', () => {
    // Example from https://cloudinary.com/documentation/authentication_signatures
    expect(signParams({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 }, 'abcd')).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
  it('ignores empty parameters and sorts the rest', () => {
    expect(signParams({ timestamp: 1, folder: 'a' }, 's')).toBe(signParams({ folder: 'a', timestamp: 1, context: '' }, 's'));
  });
  it('only accepts images from the signed folder', () => {
    expect(belongsTo('anu/menu/v1/abc123', 'anu/menu/v1')).toBe(true);
    expect(belongsTo('anu/menu/v2/abc123', 'anu/menu/v1')).toBe(false);
    expect(belongsTo('anu/menu/v1/../v2/x', 'anu/menu/v1')).toBe(false);
  });
  it('builds a resized delivery URL', () => {
    expect(imageUrl('anu', 'anu/menu/v1/abc', 600)).toBe('https://res.cloudinary.com/anu/image/upload/c_limit,w_600,q_auto,f_auto/anu/menu/v1/abc');
  });
});

import { privateDownloadUrl } from './cloudinary';

describe('private document downloads', () => {
  const url = new URL(privateDownloadUrl({ cloudName: 'anu', apiKey: 'k', apiSecret: 's', publicId: 'anu/docs/excuses/u1/note', format: 'pdf', now: 1_700_000_000_000 }));
  it('is signed and expires after five minutes', () => {
    const p = url.searchParams;
    expect(url.pathname).toBe('/v1_1/anu/image/download');
    expect(p.get('type')).toBe('authenticated');
    expect(Number(p.get('expires_at')) - Number(p.get('timestamp'))).toBe(300);
    const { signature, api_key, ...signed } = Object.fromEntries(p.entries());
    expect(api_key).toBe('k');
    expect(signature).toBe(signParams(signed, 's'));
  });
});
