const vscode = require("vscode");
const moment = require("moment");

const updateFrequency = 60000;
let timerId;

function activate(context) {
  timerId = setInterval(function() {
    const config = getConfig();
    const sunrise = config.get("themeshift.sunrise");
    const sunset = config.get("themeshift.sunset");
    const dayTheme = config.get("themeshift.daytheme");
    const nightTheme = config.get("themeshift.nighttheme");
    if (
      moment(sunrise, "HH:mm").isAfter() || moment(sunset, "HH:mm").isBefore()
    ) {
      updateTheme(config, nightTheme);
    } else {
      updateTheme(config, dayTheme);
    }
  }, updateFrequency);
}
exports.activate = activate;

function deactivate() {
  clearInterval(timerId);
}
exports.deactivate = deactivate;

function getConfig() {
  return vscode.workspace.getConfiguration();
}

function updateTheme(config, newTheme) {
  const currentTheme = config.get("workbench.colorTheme");
  if (newTheme !== currentTheme) {
    console.log(`Shifting to ${newTheme}`);
    config.update("workbench.colorTheme", newTheme, true);
  }
}
