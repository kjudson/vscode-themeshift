const vscode = require("vscode");
const moment = require("moment");
const fetch = require("node-fetch");

const updateFrequency = 60000;
let config = {};
let lastCoordinatesUpdate = 0;
let realSunrise;
let realSunset;
let timerId;

function activate(context) {
  restart();

  vscode.workspace.onDidChangeConfiguration(event => {
    const newConfig = getConfig().get("themeshift");
    const changedConfigs = Object.entries(newConfig).filter(entry => {
      return config[entry[0]] !== entry[1];
    });
    if (changedConfigs.length > 0) {
      restart();
    }
  });
}
exports.activate = activate;

function deactivate() {
  reset();
}
exports.deactivate = deactivate;

function restart() {
  reset();
  startPolling();
}

function reset() {
  config = getConfig().get("themeshift");
  clearInterval(timerId);
  lastCoordinatesUpdate = 0;
  realSunrise = realSunset = undefined;
  timerId = undefined;
}

function startPolling() {
  timerId = setInterval(checkTheme, updateFrequency);
}

function getConfig() {
  return vscode.workspace.getConfiguration();
}

function checkTheme() {
  getSunriseSunset(config).then(result => {
    const { sunrise, sunset } = result;
    if (
      moment(sunrise, "HH:mm").isAfter() || moment(sunset, "HH:mm").isBefore()
    ) {
      updateTheme(config.nighttheme);
    } else {
      updateTheme(config.daytheme);
    }
  });
}

function updateTheme(newTheme) {
  const wsConfig = getConfig();
  const currentTheme = wsConfig.get("workbench.colorTheme");
  if (newTheme !== currentTheme) {
    console.log(`Shifting to ${newTheme}`);
    wsConfig.update("workbench.colorTheme", newTheme, true);
  }
}

function getSunriseSunset(config) {
  const sunrise = config.sunrise;
  const sunset = config.sunset;
  if (sunrise === "auto" || sunset === "auto") {
    return getAndUpdateSunriseSunset().then(result => {
      return {
        sunrise: sunrise === "auto" ? realSunrise : sunrise,
        sunset: sunset === "auto" ? realSunset : sunset
      };
    });
  } else {
    return Promise.resolve({ sunrise, sunset });
  }
}

function getAndUpdateSunriseSunset() {
  if (Date.now() - lastCoordinatesUpdate > 60 * 60 * 1000) {
    lastCoordinatesUpdate = Date.now();
    return getCoordinates()
      .then(getSunriseSunsetFromWebService)
      .then(result => {
        realSunrise = moment(result.sunrise, "hh:mm:ss A").format("HH:mm");
        realSunset = moment(result.sunset, "hh:mm:ss A").format("HH:mm");
        return {
          sunrise: realSunrise,
          sunset: realSunset
        };
      })
      .catch(error => {
        console.error("Error getting sunrise/sunset information: " + error);
      });
  } else {
    return Promise.resolve({
      sunrise: realSunrise || config.sunrise,
      sunset: realSunset || config.sunset
    });
  }
}

function getCoordinates() {
  return fetch("http://ip-api.com/json")
    .then(result => {
      return result.json();
    })
    .then(json => {
      return {
        lat: json.lat,
        lon: json.lon
      };
    });
}

function getSunriseSunsetFromWebService(coordinates) {
  const { lat, lon } = coordinates;
  return fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}`)
    .then(result => {
      return result.json();
    })
    .then(json => {
      return json.results;
    });
}
