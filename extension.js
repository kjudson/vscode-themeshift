const vscode = require("vscode");
const moment = require("moment");
const fetch = require("node-fetch");

const updateFrequency = 1000;
let config = {};
let lastCoordinatesUpdate = 0;
let realSunrise;
let realSunset;
let timerId;
let manualShiftTimestamp = 0;
let manualShifted = false;

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

  vscode.commands.registerCommand("extension.dayshift", () => {
    manualShift(config.daytheme);
  });

  vscode.commands.registerCommand("extension.nightshift", () => {
    manualShift(config.nighttheme);
  });
}
exports.activate = activate;

function deactivate() {
  reset();
}
exports.deactivate = deactivate;

function manualShift(theme) {
  updateTheme(theme);
  manualShiftTimestamp = Date.now();
  manualShifted = true;
}

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
  manualShifted = false;
  manualShiftTimestamp = 0;
}

function startPolling() {
  timerId = setInterval(checkTheme, updateFrequency);
}

function getConfig() {
  return vscode.workspace.getConfiguration();
}

function checkTheme() {
  getSunriseSunset(config).then(result => {
    const shiftMoment = moment(manualShiftTimestamp);
    const { sunrise, sunset } = result;
    const sunriseMoment = moment(sunrise, "HH:mm");
    const sunsetMoment = moment(sunset, "HH:mm");

    if (manualShifted && shiftMoment.dayOfYear() < moment().dayOfYear()) {
      manualShiftTimestamp = null;
      manualShifted = false;
    }

    if (sunriseMoment.isAfter()) {
      if (!manualShifted) {
        updateTheme(config.nighttheme);
      }
    } else if (sunriseMoment.isBefore() && sunsetMoment.isAfter()) {
      if (!manualShift || shiftMoment.isBefore(sunriseMoment)) {
        updateTheme(config.daytheme);
      }
    } else if (sunsetMoment.isBefore()) {
      if (!manualShift || shiftMoment.isBefore(sunsetMoment)) {
        updateTheme(config.nighttheme);
      }
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
