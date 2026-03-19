const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add onnx as a recognizable asset extension
config.resolver.assetExts.push('onnx');

module.exports = config;
