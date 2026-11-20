const path = require('path');

/**
 * Tambahan untuk webpack bawaan Nest: alias `@app/common` ditulis langsung di sini,
 * karena tsconfig sengaja tanpa `baseUrl` (opsi itu dihapus di TypeScript 6/7)
 * sehingga plugin tsconfig-paths milik Nest tidak bisa membaca `paths`.
 */
module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    alias: { ...(options.resolve?.alias ?? {}), '@app/common': path.resolve(__dirname, 'libs/common/src') },
  },
});
