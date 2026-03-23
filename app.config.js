require('dotenv/config');

module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          apiKey: process.env.Google_Maps_Api
        }
      }
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: process.env.Google_Maps_Api
      }
    }
  };
};
