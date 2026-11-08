// Expo's default Metro config already handles npm/pnpm workspaces, so @anu/shared resolves from the repo.
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
