/*jshint node:true*/
"use strict";

var TestHelpers;

exports = module.exports = TestHelpers = {
  getFFmpegCheck: function (cmd) {
    if (require("process").platform !== "win32") {
      // linux/mac, use which
      return "which ffmpeg";
    } else {
      // windows, use where (> windows server 2003 / windows 7)
      return "where /Q ffmpeg";
    }
  }
};
